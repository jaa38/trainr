import {
  handlePaystackWebhook,
  verifyPaystackSignature,
  type WebhookProcessor,
} from "./handler.ts";

const secret = "test_paystack_secret";

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function mockProcessor(
  result: unknown = [{
    event_status: "processed",
    duplicate: false,
    message: "Event recorded",
  }],
  failure: { message: string } | null = null,
): WebhookProcessor {
  return async () => ({ data: result, error: failure });
}

function dependencies(processEvent: WebhookProcessor = mockProcessor()) {
  return {
    getSecretKey: () => secret,
    processEvent,
  };
}

Deno.test("accepts a valid Paystack HMAC signature", async () => {
  const body = '{"event":"charge.success","data":{"reference":"test-ref"}}';
  const signature = await sign(body);

  if (!(await verifyPaystackSignature(body, signature, secret))) {
    throw new Error("Expected the signature to be valid");
  }
});

Deno.test("rejects a signature generated for a different body", async () => {
  const signature = await sign('{"event":"charge.success"}');

  if (
    await verifyPaystackSignature(
      '{"event":"charge.failed"}',
      signature,
      secret,
    )
  ) {
    throw new Error("Expected the signature to be rejected");
  }
});

Deno.test("rejects missing and malformed signatures", async () => {
  if (await verifyPaystackSignature("{}", null, secret)) {
    throw new Error("Missing signature must be rejected");
  }

  if (await verifyPaystackSignature("{}", "invalid", secret)) {
    throw new Error("Malformed signature must be rejected");
  }
});

Deno.test("rejects requests that are not POST", async () => {
  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", { method: "GET" }),
    dependencies(),
  );

  if (response.status !== 405) {
    throw new Error(`Expected 405, got ${response.status}`);
  }
});

Deno.test("rejects a request with an invalid signature", async () => {
  let processorCalled = false;

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": "invalid" },
      body: "{}",
    }),
    dependencies(async () => {
      processorCalled = true;
      return { data: null, error: null };
    }),
  );

  if (response.status !== 401 || processorCalled) {
    throw new Error("Invalid signatures must be rejected before processing");
  }
});

Deno.test("sends a valid signed event to the processor", async () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 12345,
      reference: "trainr_test_reference",
      status: "success",
      amount: 2000000,
      currency: "NGN",
    },
  });

  const signature = await sign(body);
  let received: Record<string, unknown> | undefined;

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": signature },
      body,
    }),
    dependencies(async (args) => {
      received = args as unknown as Record<string, unknown>;
      return {
        data: [{
          event_status: "processed",
          duplicate: false,
          message: "Event recorded",
        }],
        error: null,
      };
    }),
  );

  const result = await response.json();

  if (response.status !== 200 || result.received !== true) {
    throw new Error("Expected the signed event to be acknowledged");
  }

  if (
    received?.eventKey !== "charge.success:12345" ||
    received?.reference !== "trainr_test_reference" ||
    received?.amountKobo !== 2000000
  ) {
    throw new Error("Expected the event details to reach the processor");
  }
});

Deno.test("returns a retryable error when database processing fails", async () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 12346,
      reference: "trainr_test_reference_2",
      status: "success",
      amount: 2000000,
      currency: "NGN",
    },
  });

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": await sign(body) },
      body,
    }),
    dependencies(
      mockProcessor(null, { message: "Database unavailable" }),
    ),
  );

  if (response.status !== 500) {
    throw new Error(`Expected 500, got ${response.status}`);
  }
});

Deno.test("acknowledges a duplicate webhook event", async () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 12347,
      reference: "trainr_duplicate_reference",
      status: "success",
      amount: 2000000,
      currency: "NGN",
    },
  });

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": await sign(body) },
      body,
    }),
    dependencies(
      mockProcessor([{
        event_status: "processed",
        duplicate: true,
        message: "Event was already recorded",
      }]),
    ),
  );

  const result = await response.json();

  if (
    response.status !== 200 ||
    result.received !== true ||
    result.duplicate !== true
  ) {
    throw new Error("Expected the duplicate event to be acknowledged");
  }
});

Deno.test("exposes reconciliation-required webhook outcomes", async () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 12348,
      reference: "trainr_late_success_reference",
      status: "success",
      amount: 2000000,
      currency: "NGN",
    },
  });

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": await sign(body) },
      body,
    }),
    dependencies(
      mockProcessor([{
        event_status: "reconciliation_required",
        payment_id: "payment-test-id",
        payment_status: "failed",
        duplicate: false,
        message:
          "Superseded payment succeeded late; manual reconciliation is required",
      }]),
    ),
  );

  const result = await response.json();

  if (
    response.status !== 200 ||
    result.eventStatus !== "reconciliation_required" ||
    !String(result.message).includes("reconciliation")
  ) {
    throw new Error("Expected reconciliation outcome to be visible");
  }
});

Deno.test("rejects an unexpected database processing result", async () => {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 12349,
      reference: "trainr_unexpected_result_reference",
      status: "success",
      amount: 2000000,
      currency: "NGN",
    },
  });

  const response = await handlePaystackWebhook(
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-paystack-signature": await sign(body) },
      body,
    }),
    dependencies(mockProcessor(null)),
  );

  if (response.status !== 500) {
    throw new Error(`Expected 500, got ${response.status}`);
  }
});

Deno.test("returns a retryable error for incomplete processing outcomes", async () => {
  for (const status of ["received", "processing"]) {
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        id: 12350,
        reference: `trainr_incomplete_${status}`,
        status: "success",
        amount: 2000000,
        currency: "NGN",
      },
    });

    const response = await handlePaystackWebhook(
      new Request("https://example.test/webhook", {
        method: "POST",
        headers: { "x-paystack-signature": await sign(body) },
        body,
      }),
      dependencies(
        mockProcessor([{
          event_status: status,
          duplicate: false,
          message: "Event processing is incomplete",
        }]),
      ),
    );

    if (response.status !== 500) {
      throw new Error(
        `Expected 500 for ${status}, got ${response.status}`,
      );
    }
  }
});
