type NotificationEvent =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_reschedule_requested"
  | "payment_succeeded"
  | "payment_failed"
  | "session_reminder"
  | "session_completed"
  | "workout_assigned"
  | "trainer_feedback_created"
  | "post_session_followup";

type NotificationPreference =
  | "booking_updates"
  | "session_reminders"
  | "workout_updates"
  | "feedback_updates"
  | "post_session_followups";

type NotificationRow = {
  id: string;
  event_type: NotificationEvent;
  recipient_id: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  locked_by: string;
};

type PushToken = {
  id: string;
  expo_push_token: string;
};

type DeliveryStatus =
  | "pending"
  | "accepted"
  | "retryable_failure"
  | "permanent_failure"
  | "invalid";

type DeliveryRecord = {
  id: string;
  notification_id: string;
  device_push_token_id: string | null;
  status: DeliveryStatus;
  attempt_count: number;
  expo_ticket_id: string | null;
  last_error: string | null;
  last_attempt_at: string | null;
  accepted_at: string | null;
};

type NotificationCopy = {
  title: string;
  body: string;
};

type WorkerDependencies = {
  getExpectedSecret: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
  getServiceRoleKey: () => string | undefined;
  createClient: (url: string, key: string) => any;
  randomUUID: () => string;
  fetchImpl?: typeof fetch;
  logError: (message: string, detail?: unknown) => void;
};

const BATCH_SIZE = 25;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

class NotificationLockRenewalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationLockRenewalError";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notification-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const preferenceByEvent: Record<
  NotificationEvent,
  NotificationPreference
> = {
  booking_requested: "booking_updates",
  booking_confirmed: "booking_updates",
  booking_declined: "booking_updates",
  booking_cancelled: "booking_updates",
  booking_reschedule_requested: "booking_updates",
  payment_succeeded: "booking_updates",
  payment_failed: "booking_updates",
  session_reminder: "session_reminders",
  session_completed: "workout_updates",
  workout_assigned: "workout_updates",
  trainer_feedback_created: "feedback_updates",
  post_session_followup: "post_session_followups",
};

const permanentExpoErrors = new Set([
  "MessageTooBig",
]);

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getNotificationCopy(
  eventType: NotificationEvent,
  payload: Record<string, unknown>,
): NotificationCopy {
  switch (eventType) {
    case "booking_requested":
      return {
        title: "New booking request",
        body: "You have received a new training session request.",
      };

    case "booking_confirmed":
      return {
        title: "Booking confirmed",
        body: "Your training session has been confirmed.",
      };

    case "booking_declined":
      return {
        title: "Booking update",
        body: "Your training session request was declined.",
      };

    case "booking_cancelled":
      return {
        title: "Booking cancelled",
        body: "A training session has been cancelled.",
      };

    case "booking_reschedule_requested":
      return {
        title: "Reschedule requested",
        body: "A new training session time has been requested.",
      };

    case "payment_succeeded":
      return {
        title: "Payment successful",
        body: "Your training session payment was successful.",
      };

    case "payment_failed":
      return {
        title: "Payment unsuccessful",
        body: "Your training session payment could not be completed.",
      };

    case "session_reminder": {
      const interval = payload.reminder_interval === "24h"
        ? "24 hours"
        : payload.reminder_interval === "1h"
        ? "1 hour"
        : "soon";

      return {
        title: "Training session reminder",
        body: `Your training session starts in ${interval}.`,
      };
    }

    case "session_completed":
      return {
        title: "Session completed",
        body: "Your training session has been marked as completed.",
      };

    case "workout_assigned":
      return {
        title: "New workout assigned",
        body: "Your trainer has assigned you a new workout plan.",
      };

    case "trainer_feedback_created":
      return {
        title: "New trainer feedback",
        body: "Your trainer has shared feedback on your progress.",
      };

    case "post_session_followup":
      return {
        title: "Time to review your workout",
        body: "Take a moment to reflect on your completed workout.",
      };
  }
}

async function completeAttempt(
  client: any,
  notification: NotificationRow,
  workerId: string,
  outcome: "accepted" | "retryable_failure" | "permanent_failure",
  ticketId?: string,
  error?: string,
): Promise<void> {
  const { error: rpcError } = await client.rpc(
    "complete_notification_attempt",
    {
      p_notification_id: notification.id,
      p_worker_id: workerId,
      p_outcome: outcome,
      p_expo_ticket_id: ticketId ?? null,
      p_error: error ?? null,
    },
  );

  if (rpcError) {
    throw new Error(
      `Could not complete notification ${notification.id}: ${rpcError.message}`,
    );
  }
}

async function deactivateInvalidToken(
  client: any,
  token: PushToken,
): Promise<void> {
  const { error } = await client
    .from("device_push_tokens")
    .update({
      is_active: false,
      last_error: "Expo reported DeviceNotRegistered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", token.id)
    .eq("is_active", true);

  if (error) {
    throw new Error(
      `Could not deactivate invalid push token: ${error.message}`,
    );
  }
}

async function cancelNotification(
  client: any,
  notification: NotificationRow,
  workerId: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "cancelled",
      locked_at: null,
      locked_by: null,
    })
    .eq("id", notification.id)
    .eq("status", "processing")
    .eq("locked_by", workerId);

  if (error) {
    throw new Error(
      `Could not cancel ${reason} notification: ${error.message}`,
    );
  }
}

async function processNotification(
  client: any,
  notification: NotificationRow,
  workerId: string,
  fetchImpl: typeof fetch,
): Promise<"sent" | "failed" | "skipped"> {
  const { data: lockRenewed, error: lockRenewalError } = await client.rpc(
    "renew_notification_lock",
    {
      p_notification_id: notification.id,
      p_worker_id: workerId,
    },
  );

  if (lockRenewalError) {
    throw new NotificationLockRenewalError(
      `Could not renew notification lock: ${lockRenewalError.message}`,
    );
  }

  if (lockRenewed !== true) {
    return "skipped";
  }

  let completionAttempted = false;

  const completeOnce = async (
    outcome: "accepted" | "retryable_failure" | "permanent_failure",
    ticketId?: string,
    error?: string,
  ): Promise<void> => {
    completionAttempted = true;

    return completeAttempt(
      client,
      notification,
      workerId,
      outcome,
      ticketId,
      error,
    );
  };

  try {
    const preference = preferenceByEvent[notification.event_type];

    if (!preference) {
      await completeOnce(
        "permanent_failure",
        undefined,
        `Unsupported notification event: ${notification.event_type}`,
      );

      return "failed";
    }

    // Validate delayed payment failures before creating history or sending push.
    if (notification.event_type === "payment_failed") {
      const paymentId = notification.payload?.payment_id;

      const isValidPaymentId = typeof paymentId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(paymentId);

      if (!isValidPaymentId) {
        await cancelNotification(
          client,
          notification,
          workerId,
          "invalid payment",
        );

        return "skipped";
      }

      const { data: payment, error: paymentError } = await client
        .from("booking_payments")
        .select("status, superseded_by")
        .eq("id", paymentId)
        .eq("gym_goer_id", notification.recipient_id)
        .maybeSingle();

      if (paymentError) {
        throw new Error(
          `Could not validate payment failure notification: ${paymentError.message}`,
        );
      }

      if (
        !payment ||
        payment.status !== "failed" ||
        payment.superseded_by !== null
      ) {
        await cancelNotification(
          client,
          notification,
          workerId,
          "obsolete payment failure",
        );

        return "skipped";
      }
    }

    // Generate the notification copy once for history and push.
    const copy = getNotificationCopy(
      notification.event_type,
      notification.payload ?? {},
    );

    // Create user-facing notification history independently of push delivery.
    // The unique outbox_id prevents duplicate history entries during retries.
    const { error: historyError } = await client
      .from("notifications")
      .upsert(
        {
          outbox_id: notification.id,
          user_id: notification.recipient_id,
          event_type: notification.event_type,
          title: copy.title,
          body: copy.body,
          entity_type: notification.entity_type,
          entity_id: notification.entity_id,
        },
        {
          onConflict: "outbox_id",
          ignoreDuplicates: true,
        },
      );

    if (historyError) {
      throw new Error(
        `Could not create notification history: ${historyError.message}`,
      );
    }

    // Push preferences control push delivery, not in-app notification history.
    const { data: preferences, error: preferenceError } = await client
      .from("notification_preferences")
      .select(preference)
      .eq("user_id", notification.recipient_id)
      .maybeSingle();

    if (preferenceError) {
      throw new Error(
        `Could not read notification preferences: ${preferenceError.message}`,
      );
    }

    // Missing preference rows use the database's default-enabled behaviour.
    if (preferences && preferences[preference] === false) {
      await cancelNotification(
        client,
        notification,
        workerId,
        "opted-out",
      );

      return "skipped";
    }

    // Retrieve active device tokens.
    const { data: tokens, error: tokenError } = await client
      .from("device_push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", notification.recipient_id)
      .eq("is_active", true);

    if (tokenError) {
      throw new Error(
        `Could not retrieve device tokens: ${tokenError.message}`,
      );
    }

    if (!tokens?.length) {
      await cancelNotification(
        client,
        notification,
        workerId,
        "no active push tokens are registered for this recipient",
      );

      return "skipped";
    }

    const tokenList = tokens as PushToken[];

    // Initialise delivery records without overwriting previous outcomes.
    const { error: deliveryUpsertError } = await client
      .from("notification_deliveries")
      .upsert(
        tokenList.map((token) => ({
          notification_id: notification.id,
          device_push_token_id: token.id,
          status: "pending",
        })),
        {
          onConflict: "notification_id,device_push_token_id",
          ignoreDuplicates: true,
        },
      );

    if (deliveryUpsertError) {
      throw new Error(
        `Could not initialise notification deliveries: ${deliveryUpsertError.message}`,
      );
    }

    // Retrieve the existing per-device delivery states.
    const { data: existingDeliveries, error: deliveryReadError } = await client
      .from("notification_deliveries")
      .select(
        "id, notification_id, device_push_token_id, status, attempt_count, expo_ticket_id, last_error, last_attempt_at, accepted_at",
      )
      .eq("notification_id", notification.id);

    if (deliveryReadError) {
      throw new Error(
        `Could not retrieve notification deliveries: ${deliveryReadError.message}`,
      );
    }

    const deliveryRecords = (existingDeliveries ?? []) as DeliveryRecord[];

    const deliveryByTokenId = new Map<string, DeliveryRecord>();

    for (const delivery of deliveryRecords) {
      if (delivery.device_push_token_id !== null) {
        deliveryByTokenId.set(
          delivery.device_push_token_id,
          delivery,
        );
      }
    }

    // Restrict processing to active tokens belonging to this recipient.
    // Existing delivery records for deleted or inactive devices are not
    // allowed to keep an event retrying indefinitely.
    const activeTokenIds = new Set(tokenList.map((token) => token.id));

    const eligibleTokens = tokenList.filter((token) => {
      const delivery = deliveryByTokenId.get(token.id);

      if (!delivery) {
        return false;
      }

      return delivery.status === "pending" ||
        delivery.status === "retryable_failure";
    });

    const acceptedRecords = deliveryRecords.filter(
      (record) =>
        record.status === "accepted" &&
        record.device_push_token_id !== null &&
        activeTokenIds.has(record.device_push_token_id),
    );

    let acceptedTicketId: string | undefined = acceptedRecords.find((record) =>
      record.expo_ticket_id !== null
    )
      ?.expo_ticket_id ?? undefined;

    const updateDelivery = async (
      token: PushToken,
      values: Partial<DeliveryRecord>,
    ): Promise<void> => {
      const { error } = await client
        .from("notification_deliveries")
        .update(values)
        .eq("notification_id", notification.id)
        .eq("device_push_token_id", token.id);

      if (error) {
        throw new Error(
          `Could not update delivery for device ${token.id}: ${error.message}`,
        );
      }

      const existing = deliveryByTokenId.get(token.id);

      if (existing) {
        Object.assign(existing, values);
      }
    };

    // Expo accepts a maximum of 100 messages per request.
    for (
      let offset = 0;
      offset < eligibleTokens.length;
      offset += 100
    ) {
      const tokenBatch = eligibleTokens.slice(offset, offset + 100);

      // Persist the attempt before making the external request.
      for (const token of tokenBatch) {
        const delivery = deliveryByTokenId.get(token.id);

        if (!delivery) {
          throw new Error(
            `Missing delivery record for device ${token.id}.`,
          );
        }

        await updateDelivery(token, {
          status: "pending",
          attempt_count: delivery.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: null,
        });
      }

      const messages = tokenBatch.map((token) => ({
        to: token.expo_push_token,
        sound: "default",
        title: copy.title,
        body: copy.body,
        data: {
          notificationId: notification.id,
          eventType: notification.event_type,
          entityType: notification.entity_type,
          entityId: notification.entity_id,
          payload: notification.payload ?? {},
        },
      }));

      let response: Response;

      try {
        response = await fetchImpl(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Expo network request failed.";

        for (const token of tokenBatch) {
          await updateDelivery(token, {
            status: "retryable_failure",
            last_error: message,
          });
        }

        continue;
      }

      if (!response.ok) {
        const responseText = await response.text();

        const message = `Expo API returned HTTP ${response.status}: ${
          responseText.slice(0, 500)
        }`;

        for (const token of tokenBatch) {
          await updateDelivery(token, {
            status: "retryable_failure",
            last_error: message,
          });
        }

        continue;
      }

      let result: { data?: unknown };

      try {
        result = await response.json();
      } catch {
        const message = "Expo returned malformed JSON.";

        for (const token of tokenBatch) {
          await updateDelivery(token, {
            status: "retryable_failure",
            last_error: message,
          });
        }

        continue;
      }

      const tickets = Array.isArray(result?.data)
        ? result.data
        : result?.data
        ? [result.data]
        : [];

      if (tickets.length !== messages.length) {
        const message = "Expo returned an unexpected number of push tickets.";

        for (const token of tokenBatch) {
          await updateDelivery(token, {
            status: "retryable_failure",
            last_error: message,
          });
        }

        continue;
      }

      // Expo tickets correspond to messages in the same batch and order.
      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index] as {
          status?: string;
          id?: string;
          message?: string;
          details?: {
            error?: string;
          };
        };

        const token = tokenBatch[index];

        if (
          ticket?.status === "ok" &&
          typeof ticket.id === "string"
        ) {
          await updateDelivery(token, {
            status: "accepted",
            expo_ticket_id: ticket.id,
            accepted_at: new Date().toISOString(),
            last_error: null,
          });

          acceptedTicketId ??= ticket.id;

          continue;
        }

        const expoError = ticket?.details?.error ??
          ticket?.message ??
          "Unknown Expo error";

        if (expoError === "DeviceNotRegistered") {
          await deactivateInvalidToken(client, token);

          await updateDelivery(token, {
            status: "invalid",
            last_error: String(expoError),
          });

          continue;
        }

        if (permanentExpoErrors.has(expoError)) {
          await updateDelivery(token, {
            status: "permanent_failure",
            last_error: String(expoError),
          });

          continue;
        }

        await updateDelivery(token, {
          status: "retryable_failure",
          last_error: String(expoError),
        });
      }
    }

    // Determine the overall result from the final active-device states.
    const activeDeliveries = tokenList.map((token) =>
      deliveryByTokenId.get(token.id)
    ).filter((record): record is DeliveryRecord => record !== undefined);

    const hasRetryableDeliveries = activeDeliveries.some(
      (record) =>
        record.status === "pending" ||
        record.status === "retryable_failure",
    );

    const hasAcceptedDeliveries = activeDeliveries.some(
      (record) => record.status === "accepted",
    );

    const hasPermanentOrInvalidDeliveries = activeDeliveries.some(
      (record) =>
        record.status === "permanent_failure" ||
        record.status === "invalid",
    );

    // Preserve the original per-device Expo errors for the outbox record
    // and completion RPC instead of replacing them with generic messages.
    const deliveryErrors = activeDeliveries
      .map((record) => record.last_error)
      .filter((message): message is string =>
        typeof message === "string" && message.length > 0
      );

    const deliveryErrorMessage = deliveryErrors.length > 0
      ? [...new Set(deliveryErrors)].join("; ")
      : undefined;

    if (hasRetryableDeliveries) {
      await completeOnce(
        "retryable_failure",
        acceptedTicketId,
        deliveryErrorMessage ??
          "One or more device deliveries require another attempt.",
      );

      return "failed";
    }

    if (hasAcceptedDeliveries) {
      await completeOnce(
        "accepted",
        acceptedTicketId,
      );

      return "sent";
    }

    if (hasPermanentOrInvalidDeliveries) {
      await completeOnce(
        "permanent_failure",
        undefined,
        deliveryErrorMessage ??
          "No registered device accepted the notification.",
      );

      return "failed";
    }

    await completeOnce(
      "retryable_failure",
      undefined,
      "No eligible device deliveries were available.",
    );

    return "failed";
  } catch (error) {
    if (completionAttempted) {
      throw error;
    }

    const message = error instanceof Error
      ? error.message
      : "Unknown notification error";

    await completeOnce(
      "retryable_failure",
      undefined,
      message,
    );

    return "failed";
  }
}

export async function handleNotificationWorkerRequest(
  request: Request,
  dependencies: WorkerDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const expectedSecret = dependencies.getExpectedSecret();
  const providedSecret = request.headers.get("x-notification-worker-secret");

  if (
    !expectedSecret ||
    !providedSecret ||
    providedSecret !== expectedSecret
  ) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = dependencies.getSupabaseUrl();
  const serviceRoleKey = dependencies.getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Worker configuration is incomplete." },
      500,
    );
  }

  try {
    const client = dependencies.createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const workerId = dependencies.randomUUID();
    const fetchImpl = dependencies.fetchImpl ?? fetch;

    const { error: recoveryError } = await client.rpc(
      "recover_stale_notification_locks",
      { p_batch_size: 100 },
    );

    if (recoveryError) {
      throw new Error(
        `Could not recover stale notification locks: ${recoveryError.message}`,
      );
    }

    const { data: notifications, error: claimError } = await client.rpc(
      "claim_notification_batch",
      {
        p_worker_id: workerId,
        p_batch_size: BATCH_SIZE,
      },
    );

    if (claimError) {
      throw new Error(
        `Could not claim notification batch: ${claimError.message}`,
      );
    }

    if (!Array.isArray(notifications)) {
      throw new Error(
        "Notification claim RPC returned an invalid response.",
      );
    }

    const summary = {
      claimed: notifications.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const notification of notifications as NotificationRow[]) {
      try {
        const outcome = await processNotification(
          client,
          notification,
          workerId,
          fetchImpl,
        );

        summary[outcome] += 1;
      } catch (error) {
        if (!(error instanceof NotificationLockRenewalError)) {
          throw error;
        }

        summary.failed += 1;

        dependencies.logError(
          `Could not renew lock for notification ${notification.id}.`,
          error,
        );
      }
    }

    return jsonResponse({
      success: true,
      workerId,
      ...summary,
    });
  } catch (error) {
    dependencies.logError(
      "Notification worker failed.",
      error,
    );

    return jsonResponse(
      {
        error: "Notification processing failed.",
      },
      500,
    );
  }
}
