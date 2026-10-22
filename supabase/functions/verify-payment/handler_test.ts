import { assertEquals } from "jsr:@std/assert@^1";
import {
  handleVerifyPayment,
  type VerifyPaymentDependencies,
} from "./handler.ts";

const paymentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const replacementId = "33333333-3333-4333-8333-333333333333";

const basePayment = {
  id: paymentId,
  booking_id: "44444444-4444-4444-8444-444444444444",
  gym_goer_id: userId,
  amount: 1500,
  currency: "NGN",
  provider: "paystack",
  provider_reference: "trainr-test-reference",
  status: "pending",
  superseded_by: null,
};

function makeRequest(method = "POST", body?: unknown): Request {
  return new Request("https://example.test/verify-payment", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function makeContext(
  payment: Record<string, unknown> | null,
  options: {
    rpcError?: { message: string } | null;
    rpcResult?: unknown;
    latestPayment?: Record<string, unknown> | null;
  } = {},
) {
  const calls = {
    paystack: 0,
    rpc: 0,
    update: 0,
    rpcNames: [] as string[],
    rpcArgs: [] as Record<string, unknown>[],
  };

  const admin = {
    from(_table: string) {
      let operation = "select";
      let selectedColumns = "";

      const builder: any = {
        select(columns: string) {
          selectedColumns = columns;
          return builder;
        },
        eq(_column: string, _value: unknown) {
          return builder;
        },
        is(_column: string, _value: unknown) {
          return builder;
        },
        update(_values: unknown) {
          operation = "update";
          calls.update++;
          return builder;
        },
        async maybeSingle() {
          if (operation === "update") {
            return { data: null, error: null };
          }

          if (selectedColumns === "status, superseded_by") {
            return {
              data: options.latestPayment ?? payment,
              error: null,
            };
          }

          return { data: payment, error: null };
        },
      };

      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc++;
      calls.rpcNames.push(name);
      calls.rpcArgs.push(args);

      return {
        data: options.rpcResult ?? {
          payment_id: paymentId,
          payment_status: "successful",
          superseded_by: null,
        },
        error: options.rpcError ?? null,
      };
    },
  };

  return {
    ctx: { userClaims: { id: userId }, supabaseAdmin: admin },
    calls,
  };
}

function makeDependencies(
  fetchImpl: typeof fetch = async () =>
    Response.json({ status: true, data: {} }),
  secretKey: string | undefined = "test-secret",
): VerifyPaymentDependencies {
  return {
    getSecretKey: () => secretKey,
    fetch: fetchImpl,
    now: () => new Date("2026-10-21T00:00:00.000Z"),
  };
}

function paystackResponse(status: string) {
  return Response.json({
    status: true,
    data: {
      reference: "trainr-test-reference",
      status,
      amount: 150000,
      currency: "NGN",
    },
  });
}

Deno.test("rejects a superseded payment without calling Paystack", async () => {
  const { ctx, calls } = makeContext({
    ...basePayment,
    superseded_by: replacementId,
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => {
      calls.paystack++;
      return Response.json({});
    }),
  );

  assertEquals(response.status, 409);
  assertEquals((await response.json()).supersededBy, replacementId);
  assertEquals(calls.paystack, 0);
  assertEquals(calls.rpc, 0);
});

Deno.test("rejects requests with invalid payment IDs", async () => {
  const { ctx } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId: "not-a-uuid" }),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 400);
});

Deno.test("does not call Paystack when the secret is missing", async () => {
  const { ctx, calls } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
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
});

Deno.test("returns 503 when Paystack cannot be reached", async () => {
  const { ctx, calls } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => {
      calls.paystack++;
      throw new Error("network unavailable");
    }),
  );

  assertEquals(response.status, 503);
  assertEquals(calls.paystack, 1);
  assertEquals(calls.rpc, 0);
});

Deno.test("does not confirm when Paystack transaction details do not match", async () => {
  const { ctx, calls } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () =>
      Response.json({
        status: true,
        data: {
          reference: "different-reference",
          status: "success",
          amount: 150000,
          currency: "NGN",
        },
      })
    ),
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 0);
});

Deno.test("confirms only after the database RPC returns successful", async () => {
  const { ctx, calls } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("success")),
  );

  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, "successful");
  assertEquals(calls.rpc, 1);
  assertEquals(calls.rpcNames[0], "confirm_booking_payment");
});

Deno.test("rejects methods other than POST", async () => {
  const { ctx } = makeContext(basePayment);

  const response = await handleVerifyPayment(
    makeRequest("GET"),
    ctx,
    makeDependencies(),
  );

  assertEquals(response.status, 405);
});

Deno.test("does not report success when the confirmation RPC fails", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcError: { message: "Database confirmation failed" },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("success")),
  );

  assertEquals(response.status, 500);
  assertEquals(calls.rpc, 1);
  assertEquals((await response.json()).status, undefined);
});

Deno.test("rejects an unexpected confirmation RPC result", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcResult: {
      payment_id: replacementId,
      payment_status: "successful",
    },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("success")),
  );

  assertEquals(response.status, 409);
  assertEquals(calls.rpc, 1);
});

Deno.test("records a verified Paystack failure through the atomic RPC", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcResult: [{
      payment_id: paymentId,
      payment_status: "failed",
      superseded_by: null,
    }],
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("failed")),
  );

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(result.status, "failed");
  assertEquals(calls.rpc, 1);
  assertEquals(calls.update, 0);
  assertEquals(calls.rpcNames[0], "record_verified_payment_failure");
  assertEquals(calls.rpcArgs[0], {
    p_payment_id: paymentId,
    p_expected_reference: "trainr-test-reference",
    p_expected_amount: 1500,
    p_expected_currency: "NGN",
  });
});

Deno.test("reports successful when the failure RPC finds a concurrent success", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcResult: {
      payment_id: paymentId,
      payment_status: "successful",
      superseded_by: null,
    },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("failed")),
  );

  const result = await response.json();

  assertEquals(response.status, 200);
  assertEquals(result.status, "successful");
  assertEquals(calls.rpc, 1);
  assertEquals(calls.update, 0);
});

Deno.test("does not report failure when the failure RPC errors", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcError: { message: "Database unavailable" },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("failed")),
  );

  const result = await response.json();

  assertEquals(response.status, 500);
  assertEquals(result.status, undefined);
  assertEquals(calls.rpc, 1);
  assertEquals(calls.update, 0);
});

Deno.test("rejects a malformed failure RPC result", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcResult: {
      payment_id: replacementId,
      payment_status: "failed",
      superseded_by: null,
    },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("failed")),
  );

  assertEquals(response.status, 500);
  assertEquals(calls.rpc, 1);
  assertEquals(calls.update, 0);
});

Deno.test("does not overwrite a payment superseded during verification", async () => {
  const { ctx, calls } = makeContext(basePayment, {
    rpcResult: {
      payment_id: paymentId,
      payment_status: "pending",
      superseded_by: replacementId,
    },
  });

  const response = await handleVerifyPayment(
    makeRequest("POST", { paymentId }),
    ctx,
    makeDependencies(async () => paystackResponse("failed")),
  );

  const result = await response.json();

  assertEquals(response.status, 409);
  assertEquals(result.supersededBy, replacementId);
  assertEquals(calls.update, 0);
  assertEquals(calls.rpc, 1);
});
