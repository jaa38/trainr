import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";

import { handleNotificationWorkerRequest } from "./handler.ts";

const workerSecret = "test-notification-worker-secret";

function createNotification(overrides = {}) {
  return {
    id: "notification-1",
    event_type: "booking_confirmed",
    recipient_id: "user-1",
    entity_type: "booking",
    entity_id: "booking-1",
    payload: {},
    attempt_count: 1,
    max_attempts: 5,
    locked_by: "worker-1",
    ...overrides,
  };
}

function createDependencies(options: {
  notifications?: unknown[];
  preferences?: Record<string, unknown> | null;
  payment?: { status: string; superseded_by: string | null } | null;
  paymentError?: string;
  tokens?: { id: string; expo_push_token: string }[];
  rpcError?: string;
  completionRpcError?: string;
  historyError?: string;
  fetchResponse?: Response;
} = {}) {
  const calls: { name: string; args: unknown }[] = [];
  const updates: { table: string; values: unknown }[] = [];

  const historyWrites: {
    table: string;
    values: unknown;
    options: unknown;
  }[] = [];

  const fetchCalls: { url: string; messages: unknown[] }[] = [];

  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });

      if (name === "recover_stale_notification_locks") {
        return { data: 0, error: null };
      }

      if (name === "claim_notification_batch") {
        if (options.rpcError) {
          return {
            data: null,
            error: { message: options.rpcError },
          };
        }

        return {
          data: options.notifications ?? [],
          error: null,
        };
      }

      if (name === "complete_notification_attempt") {
        if (options.completionRpcError) {
          return {
            data: null,
            error: { message: options.completionRpcError },
          };
        }

        return { data: null, error: null };
      }

      return { data: null, error: null };
    },

    from: (table: string) => {
      let operation = "select";

      const query: any = {
        select: () => query,

        update: (values: unknown) => {
          operation = "update";
          updates.push({ table, values });
          return query;
        },

        upsert: (values: unknown, upsertOptions: unknown) => {
          operation = "upsert";

          historyWrites.push({
            table,
            values,
            options: upsertOptions,
          });

          return query;
        },

        eq: () => query,

        maybeSingle: async () => {
          if (table === "booking_payments") {
            return {
              data: options.payment ?? null,
              error: options.paymentError
                ? { message: options.paymentError }
                : null,
            };
          }

          return {
            data: options.preferences ?? null,
            error: null,
          };
        },

        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => {
          if (operation === "upsert" && table === "notifications") {
            return Promise.resolve({
              data: null,
              error: options.historyError
                ? { message: options.historyError }
                : null,
            }).then(resolve, reject);
          }

          const data = table === "device_push_tokens" &&
              operation === "select"
            ? options.tokens ?? []
            : null;

          return Promise.resolve({
            data,
            error: null,
          }).then(resolve, reject);
        },
      };

      return query;
    },
  };

  const dependencies = {
    getExpectedSecret: () => workerSecret,
    getSupabaseUrl: () => "https://example.supabase.co",
    getServiceRoleKey: () => "test-service-role-key",
    createClient: () => client,
    randomUUID: () => "worker-test-id",

    fetchImpl: async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const messages = JSON.parse(
        String(init?.body ?? "[]"),
      ) as unknown[];

      fetchCalls.push({
        url: String(input),
        messages,
      });

      if (options.fetchResponse) {
        return options.fetchResponse;
      }

      const requestNumber = fetchCalls.length;

      return new Response(
        JSON.stringify({
          data: messages.map((_, index) => ({
            status: "ok",
            id: `expo-ticket-${requestNumber}-${index + 1}`,
          })),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },

    logError: () => {},
  };

  return {
    dependencies,
    calls,
    updates,
    historyWrites,
    fetchCalls,
  };
}

function createRequest(
  method = "POST",
  includeSecret = true,
): Request {
  const headers = new Headers();

  if (includeSecret) {
    headers.set(
      "x-notification-worker-secret",
      workerSecret,
    );
  }

  return new Request(
    "https://example.com/process-notifications",
    {
      method,
      headers,
    },
  );
}

// ============================================================
// REQUEST VALIDATION
// ============================================================

Deno.test("rejects requests without the worker secret", async () => {
  const { dependencies } = createDependencies();

  const response = await handleNotificationWorkerRequest(
    createRequest("POST", false),
    dependencies,
  );

  assertEquals(response.status, 401);
  assertEquals(
    await response.json(),
    { error: "Unauthorized." },
  );
});

Deno.test("rejects unsupported HTTP methods", async () => {
  const { dependencies } = createDependencies();

  const response = await handleNotificationWorkerRequest(
    createRequest("GET"),
    dependencies,
  );

  assertEquals(response.status, 405);
});

// ============================================================
// QUEUE PROCESSING
// ============================================================

Deno.test("recovers stale locks and claims an empty batch", async () => {
  const { dependencies, calls } = createDependencies();

  const response = await handleNotificationWorkerRequest(
    createRequest(),
    dependencies,
  );

  assertEquals(response.status, 200);

  assertEquals(await response.json(), {
    success: true,
    workerId: "worker-test-id",
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  });

  assertEquals(
    calls.map((call) => call.name),
    [
      "recover_stale_notification_locks",
      "claim_notification_batch",
    ],
  );
});

Deno.test("returns a safe worker error when queue claiming fails", async () => {
  const { dependencies, calls } = createDependencies({
    rpcError: "Queue claim failed",
  });

  const response = await handleNotificationWorkerRequest(
    createRequest(),
    dependencies,
  );

  assertEquals(response.status, 500);

  const completionCalls = calls.filter(
    (call) => call.name === "complete_notification_attempt",
  );

  assertEquals(completionCalls.length, 0);
});

// ============================================================
// SUCCESSFUL PUSH DELIVERY
// ============================================================

Deno.test("sends a notification and completes the attempt", async () => {
  const { dependencies, calls } = createDependencies({
    notifications: [createNotification()],
    tokens: [
      {
        id: "token-1",
        expo_push_token: "ExponentPushToken[test-device]",
      },
    ],
  });

  const response = await handleNotificationWorkerRequest(
    createRequest(),
    dependencies,
  );

  assertEquals(response.status, 200);

  const result = await response.json();

  assertEquals(result.claimed, 1);
  assertEquals(result.sent, 1);
  assertEquals(result.failed, 0);

  const completion = calls.find(
    (call) => call.name === "complete_notification_attempt",
  );

  assertEquals(completion !== undefined, true);

  const args = completion?.args as Record<string, unknown>;

  assertEquals(args.p_outcome, "accepted");
  assertEquals(args.p_expo_ticket_id, "expo-ticket-1-1");
});

// ============================================================
// NOTIFICATION HISTORY
// ============================================================

Deno.test(
  "creates notification history when processing a notification",
  async () => {
    const {
      dependencies,
      historyWrites,
      fetchCalls,
    } = createDependencies({
      notifications: [createNotification()],
      tokens: [
        {
          id: "token-1",
          expo_push_token: "ExponentPushToken[test-device]",
        },
      ],
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);
    assertEquals(historyWrites.length, 1);

    const history = historyWrites[0].values as Record<string, unknown>;

    const upsertOptions = historyWrites[0].options as Record<
      string,
      unknown
    >;

    assertEquals(historyWrites[0].table, "notifications");
    assertEquals(history.outbox_id, "notification-1");
    assertEquals(history.user_id, "user-1");
    assertEquals(history.event_type, "booking_confirmed");
    assertEquals(history.title, "Booking confirmed");

    assertEquals(
      history.body,
      "Your training session has been confirmed.",
    );

    assertEquals(history.entity_type, "booking");
    assertEquals(history.entity_id, "booking-1");

    assertEquals(upsertOptions.onConflict, "outbox_id");
    assertEquals(upsertOptions.ignoreDuplicates, true);

    assertEquals(fetchCalls.length, 1);
  },
);

Deno.test(
  "creates notification history when the recipient opts out of push",
  async () => {
    const {
      dependencies,
      historyWrites,
      fetchCalls,
    } = createDependencies({
      notifications: [createNotification()],
      preferences: {
        booking_updates: false,
      },
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.skipped, 1);
    assertEquals(historyWrites.length, 1);
    assertEquals(fetchCalls.length, 0);
  },
);

Deno.test(
  "creates notification history when no active device token exists",
  async () => {
    const {
      dependencies,
      historyWrites,
      calls,
    } = createDependencies({
      notifications: [createNotification()],
      tokens: [],
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);
    assertEquals(historyWrites.length, 1);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");
  },
);

Deno.test(
  "retries notification processing when history creation fails",
  async () => {
    const {
      dependencies,
      calls,
      fetchCalls,
    } = createDependencies({
      notifications: [createNotification()],
      historyError: "Notification history insert failed",
      tokens: [
        {
          id: "token-1",
          expo_push_token: "ExponentPushToken[test-device]",
        },
      ],
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);
    assertEquals(result.sent, 0);
    assertEquals(fetchCalls.length, 0);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");

    assertStringIncludes(
      String(args.p_error),
      "Could not create notification history",
    );
  },
);

// ============================================================
// PUSH PREFERENCES
// ============================================================

Deno.test(
  "cancels notifications when the recipient opted out",
  async () => {
    const { dependencies } = createDependencies({
      notifications: [createNotification()],
      preferences: {
        booking_updates: false,
      },
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.skipped, 1);
    assertEquals(result.sent, 0);
  },
);

// ============================================================
// PAYMENT FAILURE VALIDATION
// ============================================================

const testPaymentId = "11111111-1111-4111-8111-111111111111";

Deno.test(
  "sends payment_failed notification when payment is still failed and not superseded",
  async () => {
    const {
      dependencies,
      historyWrites,
      fetchCalls,
    } = createDependencies({
      notifications: [
        createNotification({
          event_type: "payment_failed",
          payload: { payment_id: testPaymentId },
        }),
      ],
      payment: { status: "failed", superseded_by: null },
      tokens: [{
        id: "token-1",
        expo_push_token: "ExponentPushToken[test-device]",
      }],
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.sent, 1);
    assertEquals(historyWrites.length, 1);
    assertEquals(fetchCalls.length, 1);
  },
);

Deno.test(
  "cancels payment_failed notification when payment has been superseded",
  async () => {
    const { dependencies, historyWrites, fetchCalls, updates } =
      createDependencies({
        notifications: [
          createNotification({
            event_type: "payment_failed",
            payload: { payment_id: testPaymentId },
          }),
        ],
        payment: {
          status: "failed",
          superseded_by: "22222222-2222-4222-8222-222222222222",
        },
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.skipped, 1);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);

    const cancellation = updates.find(
      (update) => update.table === "notification_outbox",
    );
    assertEquals(
      (cancellation?.values as Record<string, unknown>)?.status,
      "cancelled",
    );
  },
);

Deno.test(
  "cancels payment_failed notification when payment is successful",
  async () => {
    const { dependencies, historyWrites, fetchCalls, updates } =
      createDependencies({
        notifications: [
          createNotification({
            event_type: "payment_failed",
            payload: { payment_id: testPaymentId },
          }),
        ],
        payment: { status: "successful", superseded_by: null },
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.skipped, 1);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);
    assertEquals(
      (updates.find((update) => update.table === "notification_outbox")
        ?.values as Record<string, unknown>)?.status,
      "cancelled",
    );
  },
);

Deno.test(
  "cancels payment_failed notification when payment is cancelled",
  async () => {
    const { dependencies, historyWrites, fetchCalls, updates } =
      createDependencies({
        notifications: [
          createNotification({
            event_type: "payment_failed",
            payload: { payment_id: testPaymentId },
          }),
        ],
        payment: { status: "cancelled", superseded_by: null },
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.skipped, 1);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);
    assertEquals(
      (updates.find((update) => update.table === "notification_outbox")
        ?.values as Record<string, unknown>)?.status,
      "cancelled",
    );
  },
);

Deno.test(
  "cancels payment_failed notification when payment record is missing",
  async () => {
    const { dependencies, historyWrites, fetchCalls, updates } =
      createDependencies({
        notifications: [
          createNotification({
            event_type: "payment_failed",
            payload: { payment_id: testPaymentId },
          }),
        ],
        payment: null,
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.skipped, 1);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);
    assertEquals(
      (updates.find((update) => update.table === "notification_outbox")
        ?.values as Record<string, unknown>)?.status,
      "cancelled",
    );
  },
);

Deno.test(
  "cancels payment_failed notifications with missing or invalid payment IDs",
  async () => {
    const { dependencies, historyWrites, fetchCalls, updates } =
      createDependencies({
        notifications: [
          createNotification({
            id: "notification-missing-payment-id",
            event_type: "payment_failed",
            payload: {},
          }),
          createNotification({
            id: "notification-invalid-payment-id",
            event_type: "payment_failed",
            payload: { payment_id: "not-a-uuid" },
          }),
        ],
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.skipped, 2);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);
    assertEquals(
      updates.filter((update) =>
        update.table === "notification_outbox" &&
        (update.values as Record<string, unknown>).status === "cancelled"
      ).length,
      2,
    );
  },
);

Deno.test(
  "retries payment_failed notification when payment lookup fails",
  async () => {
    const { dependencies, calls, historyWrites, fetchCalls } =
      createDependencies({
        notifications: [
          createNotification({
            event_type: "payment_failed",
            payload: { payment_id: testPaymentId },
          }),
        ],
        paymentError: "Payment lookup unavailable",
      });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.failed, 1);
    assertEquals(historyWrites.length, 0);
    assertEquals(fetchCalls.length, 0);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );
    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");
    assertStringIncludes(
      String(args.p_error),
      "Could not validate payment failure notification",
    );
  },
);

// ============================================================
// DEVICE TOKEN HANDLING
// ============================================================

Deno.test(
  "retries notifications when no active device token exists",
  async () => {
    const { dependencies, calls } = createDependencies({
      notifications: [createNotification()],
      tokens: [],
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");

    assertStringIncludes(
      String(args.p_error),
      "No active push tokens",
    );
  },
);

Deno.test(
  "deactivates push tokens reported as unregistered by Expo",
  async () => {
    const {
      dependencies,
      calls,
      updates,
    } = createDependencies({
      notifications: [createNotification()],
      tokens: [
        {
          id: "token-invalid",
          expo_push_token: "ExponentPushToken[invalid-device]",
        },
      ],
      fetchResponse: new Response(
        JSON.stringify({
          data: [
            {
              status: "error",
              message: "The recipient device is not registered.",
              details: {
                error: "DeviceNotRegistered",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);

    assertEquals(
      updates.some((update) =>
        update.table === "device_push_tokens" &&
        (update.values as Record<string, unknown>).is_active === false
      ),
      true,
    );

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "permanent_failure");
  },
);

// ============================================================
// EXPO DELIVERY ERRORS
// ============================================================

Deno.test(
  "retries notifications when Expo returns a temporary error",
  async () => {
    const { dependencies, calls } = createDependencies({
      notifications: [createNotification()],
      tokens: [
        {
          id: "token-1",
          expo_push_token: "ExponentPushToken[test-device]",
        },
      ],
      fetchResponse: new Response(
        JSON.stringify({
          data: [
            {
              status: "error",
              message: "Rate limit exceeded.",
              details: {
                error: "MessageRateExceeded",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");

    assertStringIncludes(
      String(args.p_error),
      "MessageRateExceeded",
    );
  },
);

Deno.test(
  "retries partial delivery when one device accepts and another fails temporarily",
  async () => {
    const { dependencies, calls } = createDependencies({
      notifications: [createNotification()],
      tokens: [
        {
          id: "token-1",
          expo_push_token: "ExponentPushToken[device-one]",
        },
        {
          id: "token-2",
          expo_push_token: "ExponentPushToken[device-two]",
        },
      ],
      fetchResponse: new Response(
        JSON.stringify({
          data: [
            {
              status: "ok",
              id: "expo-ticket-1",
            },
            {
              status: "error",
              message: "Rate limit exceeded.",
              details: {
                error: "MessageRateExceeded",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.failed, 1);
    assertEquals(result.sent, 0);

    const completion = calls.find(
      (call) => call.name === "complete_notification_attempt",
    );

    const args = completion?.args as Record<string, unknown>;

    assertEquals(args.p_outcome, "retryable_failure");
  },
);

// ============================================================
// COMPLETION AND WORKER ERROR HANDLING
// ============================================================

Deno.test(
  "does not retry completion when the completion RPC fails",
  async () => {
    const { dependencies, calls } = createDependencies({
      notifications: [createNotification()],
      tokens: [
        {
          id: "token-1",
          expo_push_token: "ExponentPushToken[test-device]",
        },
      ],
      completionRpcError: "Database completion failed",
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 500);

    const completionCalls = calls.filter(
      (call) => call.name === "complete_notification_attempt",
    );

    assertEquals(completionCalls.length, 1);
  },
);

// ============================================================
// EXPO BATCHING
// ============================================================

Deno.test(
  "splits more than 100 device tokens into separate Expo requests",
  async () => {
    const tokens = Array.from(
      { length: 101 },
      (_, index) => ({
        id: `token-${index + 1}`,
        expo_push_token: `ExponentPushToken[device-${index + 1}]`,
      }),
    );

    const {
      dependencies,
      fetchCalls,
    } = createDependencies({
      notifications: [createNotification()],
      tokens,
    });

    const response = await handleNotificationWorkerRequest(
      createRequest(),
      dependencies,
    );

    assertEquals(response.status, 200);

    const result = await response.json();

    assertEquals(result.claimed, 1);
    assertEquals(result.sent, 1);

    assertEquals(fetchCalls.length, 2);

    assertEquals(
      fetchCalls.map((call) => call.messages.length),
      [100, 1],
    );

    assertEquals(
      fetchCalls.reduce(
        (total, call) => total + call.messages.length,
        0,
      ),
      101,
    );
  },
);
