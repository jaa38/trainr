import { assertEquals } from "jsr:@std/assert@^1";
import { handleRetryPayment } from "./handler.ts";

const paymentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const bookingId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "55555555-5555-4555-8555-555555555555";
const replacementId = "33333333-3333-4333-8333-333333333333";
const reference = "trainr-test-reference";

const basePayment = {
  id: paymentId,
  booking_id: bookingId,
  gym_goer_id: userId,
  amount: 1500,
  currency: "NGN",
  provider: "paystack",
  provider_reference: reference,
  status: "pending",
  superseded_by: null,
};

function makeRequest(method = "POST", body?: unknown): Request {
  return new Request("https://example.test/retry-payment", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function makeContext(
  payment: Record<string, unknown> | null = basePayment,
  options: {
    lookupError?: { message: string } | null;
    rpcError?: { message: string } | null;
    rpcResult?: unknown;
  } = {},
) {
  const calls = {
    paystack: 0,
    rpc: 0,
    rpcArgs: null as Record<string, unknown> | null,
  };

  const admin = {
    from(table: string) {
      assertEquals(table, "booking_payments");

      const builder: any = {
        select(_columns: string) {
          return builder;
        },
        eq(_column: string, _value: unknown) {
          return builder;
        },
        async maybeSingle() {
          return {
            data: payment,
            error: options.lookupError ?? null,
          };
        },
      };

      return builder;
    },

    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc++;
      calls.rpcArgs = args;
      assertEquals(name, "retry_failed_booking_payment");

      return {
        data: options.rpcResult ?? [{
          payment_id: replacementId,
          booking_id: bookingId,
          provider_reference: "trainr-replacement-reference",
          payment_status: "pending",
          was_created: true,
        }],
        error: options.rpcError ?? null,
      };
    },
  };

  return {
    ctx: {
      userClaims: { id: userId },
      supabaseAdmin: admin,
    },
    calls,
  };
}

function makeDependencies(
  providerStatus = "failed",
  options: {
    secretKey?: string;
    responseStatus?: boolean;
    httpStatus?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    fetchError?: boolean;
    onFetch?: () => void;
  } = {},
) {
  return {
    getSecretKey: () => options.secretKey ?? "test-secret",
    fetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      options.onFetch?.();

      if (options.fetchError) {
        throw new Error("network unavailable");
      }

      return Response.json(
        {
          status: options.responseStatus ?? true,
          message: "Verification result",
          data: {
            reference: options.reference ?? reference,
            status: providerStatus,
            amount: options.amount ?? 150000,
            currency: options.currency ?? "NGN",
          },
        },
        { status: options.httpStatus ?? 200 },
      );
    },
  };
}

async function submitRetry(
  payment: Record<string, unknown> | null = basePayment,
  providerStatus = "failed",
  contextOptions: Parameters<typeof makeContext>[1] = {},
  dependencyOptions: Parameters<typeof makeDependencies>[1] = {},
) {
  const { ctx, calls } = makeContext(payment, contextOptions);

  const response = await handleRetryPayment(
    makeRequest("POST", { paymentId, idempotencyKey }),
    ctx,
    makeDependencies(providerStatus, {
      ...dependencyOptions,
      onFetch: () => {
        calls.paystack++;
        dependencyOptions.onFetch?.();
      },
    }),
  );

  return { response, calls };
}

Deno.test("rejects methods other than POST", async () => {
  const { ctx } = makeContext();

  const response = await handleRetryPayment(
    makeRequest("GET"),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 405);
});

Deno.test("rejects malformed JSON", async () => {
  const { ctx } = makeContext();

  const response = await handleRetryPayment(
    new Request("https://example.test/retry-payment", {
      method: "POST",
      body: "{",
    }),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 400);
});

Deno.test("rejects invalid payment UUID", async () => {
  const { ctx, calls } = makeContext();

  const response = await handleRetryPayment(
    makeRequest("POST", {
      paymentId: "invalid",
      idempotencyKey,
    }),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 400);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects invalid idempotency UUID", async () => {
  const { ctx, calls } = makeContext();

  const response = await handleRetryPayment(
    makeRequest("POST", {
      paymentId,
      idempotencyKey: "invalid",
    }),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 400);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("requires an authenticated user", async () => {
  const ctx = {
    userClaims: null as { id: string } | null,
    supabaseAdmin: {
      from() {
        throw new Error("Database must not be queried.");
      },
      rpc() {
        throw new Error("RPC must not be called.");
      },
    },
  };

  const response = await handleRetryPayment(
    makeRequest("POST", { paymentId, idempotencyKey }),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 401);
});

Deno.test("does not call Paystack when the secret is missing", async () => {
  const { ctx, calls } = makeContext();

  const response = await handleRetryPayment(
    makeRequest("POST", { paymentId, idempotencyKey }),
    ctx,
    {
      getSecretKey: () => undefined,
      fetch: async () => {
        calls.paystack++;
        return Response.json({});
      },
    },
  );

  assertEquals(response.status, 500);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("returns 404 for an inaccessible payment", async () => {
  const { response, calls } = await submitRetry(null);

  assertEquals(response.status, 404);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("returns 500 when the payment lookup fails", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    { lookupError: { message: "Database unavailable" } },
  );

  assertEquals(response.status, 500);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects superseded payments before contacting Paystack", async () => {
  const { response, calls } = await submitRetry({
    ...basePayment,
    superseded_by: replacementId,
  });

  assertEquals(response.status, 409);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

for (
  const providerStatus of [
    "abandoned",
    "pending",
    "success",
    "processing",
    "unknown",
  ]
) {
  Deno.test(
    `does not retry a Paystack transaction with status ${providerStatus}`,
    async () => {
      const { response, calls } = await submitRetry(
        basePayment,
        providerStatus,
      );

      assertEquals(response.status, 409);
      assertEquals(calls.paystack, 1);
      assertEquals(calls.rpc, 0);
    },
  );
}

Deno.test("does not retry when Paystack verification is unavailable", async () => {
  const { ctx, calls } = makeContext();

  const response = await handleRetryPayment(
    makeRequest("POST", { paymentId, idempotencyKey }),
    ctx,
    {
      getSecretKey: () => "test-secret",
      fetch: async () => {
        calls.paystack++;
        throw new Error("network unavailable");
      },
    },
  );

  assertEquals(response.status, 503);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects a non-successful Paystack API response", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    {},
    { responseStatus: false },
  );

  assertEquals(response.status, 502);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects mismatched transaction references", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    {},
    { reference: "another-reference" },
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects mismatched transaction amounts", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    {},
    { amount: 100000 },
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects mismatched transaction currency", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    {},
    { currency: "USD" },
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 0);
});

Deno.test(
  "calls the atomic retry RPC only for a matching failed transaction",
  async () => {
    const { response, calls } = await submitRetry();

    assertEquals(response.status, 200);
    assertEquals(calls.paystack, 1);
    assertEquals(calls.rpc, 1);
    assertEquals(calls.rpcArgs?.p_old_payment_id, paymentId);
    assertEquals(calls.rpcArgs?.p_gym_goer_id, userId);
    assertEquals(calls.rpcArgs?.p_expected_reference, reference);
    assertEquals(calls.rpcArgs?.p_expected_amount, 1500);
    assertEquals(calls.rpcArgs?.p_expected_currency, "NGN");
    assertEquals(calls.rpcArgs?.p_verified_provider_status, "failed");
    assertEquals(calls.rpcArgs?.p_new_idempotency_key, idempotencyKey);

    const body = await response.json();
    assertEquals(body.paymentId, replacementId);
    assertEquals(body.wasCreated, true);
    assertEquals(body.status, "pending");
  },
);

Deno.test("does not report a created retry when the RPC fails", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    { rpcError: { message: "Database unavailable" } },
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 1);
});

Deno.test("rejects an invalid RPC result", async () => {
  const { response, calls } = await submitRetry(
    basePayment,
    "failed",
    {
      rpcResult: [{
        payment_id: "not-a-uuid",
        booking_id: bookingId,
        provider_reference: "trainr-replacement-reference",
        payment_status: "pending",
        was_created: true,
      }],
    },
  );

  assertEquals(response.status, 500);
  assertEquals(calls.rpc, 1);
});

Deno.test(
  "accepts an idempotent RPC replay when it returns a valid replacement",
  async () => {
    const { response, calls } = await submitRetry(
      basePayment,
      "failed",
      {
        rpcResult: [{
          payment_id: replacementId,
          booking_id: bookingId,
          provider_reference: "trainr-replacement-reference",
          payment_status: "pending",
          was_created: false,
        }],
      },
    );

    assertEquals(response.status, 200);
    assertEquals(calls.rpc, 1);

    const body = await response.json();
    assertEquals(body.paymentId, replacementId);
    assertEquals(body.wasCreated, false);
    assertEquals(body.status, "pending");
  },
);
