import { assertEquals } from "jsr:@std/assert@^1";
import { handleRecoverPayment } from "./handler.ts";

const context = {
  userClaims: { id: "test-user" },
  supabaseAdmin: {},
};

const dependencies = {
  getSecretKey: () => undefined,
  fetch: async () => {
    throw new Error("Paystack fetch should not be called in this test.");
  },
};

const validPaymentId = "550e8400-e29b-41d4-a716-446655440000";

function createLookupContext(
  payment: Record<string, unknown> | null,
  rpcFails = false,
  rpcResponse?: {
    data: unknown;
    error: { message: string } | null;
  },
  booking: Record<string, unknown> | null = {
    id: "booking-test",
    status: "confirmed",
  },
) {
  let updateCalls = 0;
  let updateValues: Record<string, unknown> | null = null;

  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    maybeSingle() {
      return Promise.resolve({
        data: payment,
        error: null,
      });
    },
  };

  const bookingQuery = {
    select() {
      return bookingQuery;
    },
    eq() {
      return bookingQuery;
    },
    maybeSingle() {
      return Promise.resolve({
        data: booking,
        error: null,
      });
    },
  };

  const updateQuery = {
    eq() {
      return this;
    },
    in() {
      return this;
    },
    select() {
      const canUpdate = payment?.status === "pending" &&
        [
          "not_started",
          "initializing",
          "initialized",
        ].includes(String(payment.initialization_status));

      if (canUpdate) {
        payment!.initialization_status = String(
          updateValues?.initialization_status,
        );

        return Promise.resolve({
          data: [{ id: validPaymentId }],
          error: null,
        });
      }

      return Promise.resolve({
        data: [],
        error: null,
      });
    },
  };

  const mockContext = {
    userClaims: { id: "test-user" },
    supabaseAdmin: {
      from(table: string) {
        if (table === "trainer_bookings") {
          return bookingQuery;
        }

        assertEquals(table, "booking_payments");

        return {
          ...query,
          update(values: Record<string, unknown>) {
            updateCalls++;
            updateValues = values;
            return updateQuery;
          },
        };
      },
      rpc(name: string, args: Record<string, unknown>) {
        assertEquals(name, "confirm_booking_payment");

        if (rpcFails) {
          return Promise.resolve({
            data: null,
            error: { message: "Database unavailable" },
          });
        }

        return Promise.resolve(
          rpcResponse ?? {
            data: [{
              payment_id: args.p_payment_id,
              payment_status: "successful",
            }],
            error: null,
          },
        );
      },
    },
  };

  return {
    ...mockContext,
    getUpdateCalls: () => updateCalls,
    getUpdateValues: () => updateValues,
  };
}

function postRecoveryRequest(paymentId = validPaymentId) {
  return new Request("http://localhost/recover-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId }),
  });
}

function createReconciliationContext(
  payment: Record<string, unknown>,
  booking: Record<string, unknown> | null = {
    id: "booking-test",
    status: "confirmed",
  },
) {
  let updateCalls = 0;
  let updateValues: Record<string, unknown> | null = null;

  const updateQuery = {
    eq() {
      return this;
    },
    in() {
      return this;
    },
    select() {
      return Promise.resolve({
        data: [{ id: validPaymentId }],
        error: null,
      });
    },
  };

  const paymentLookupQuery = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: payment,
        error: null,
      });
    },
  };

  const bookingLookupQuery = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: booking,
        error: null,
      });
    },
  };

  const mockContext = {
    userClaims: { id: "test-user" },
    supabaseAdmin: {
      from(table: string) {
        if (table === "trainer_bookings") {
          return bookingLookupQuery;
        }

        assertEquals(table, "booking_payments");

        return {
          update(values: Record<string, unknown>) {
            updateCalls++;
            updateValues = values;
            return updateQuery;
          },
          ...paymentLookupQuery,
        };
      },
    },
  };

  return {
    mockContext,
    getUpdateCalls: () => updateCalls,
    getUpdateValues: () => updateValues,
  };
}

Deno.test("rejects HTTP methods other than POST", async () => {
  const response = await handleRecoverPayment(
    new Request("http://localhost/recover-payment", {
      method: "GET",
    }),
    context,
    dependencies,
  );

  assertEquals(response.status, 405);
  assertEquals(await response.json(), {
    error: "Method not allowed.",
  });
});

Deno.test("rejects malformed JSON", async () => {
  const response = await handleRecoverPayment(
    new Request("http://localhost/recover-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    context,
    dependencies,
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "Request body must be valid JSON.",
  });
});

Deno.test("rejects an invalid payment ID", async () => {
  const response = await handleRecoverPayment(
    new Request("http://localhost/recover-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: "not-a-uuid" }),
    }),
    context,
    dependencies,
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "A valid paymentId UUID is required.",
  });
});

Deno.test("returns 404 when the payment is not accessible", async () => {
  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext(null),
    dependencies,
  );

  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: "Payment not found or not accessible.",
  });
});

Deno.test("returns the existing result for a successful payment", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      status: "successful",
    }),
    {
      getSecretKey: () => undefined,
      fetch: async () => {
        fetchCalls++;
        throw new Error("Fetch should not be called.");
      },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    paymentId: validPaymentId,
    status: "successful",
    message: "This payment has already been verified.",
  });
  assertEquals(fetchCalls, 0);
});

Deno.test(
  "rejects recovery for a completed booking without contacting Paystack",
  async () => {
    let fetchCalls = 0;

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      createLookupContext(
        {
          id: validPaymentId,
          booking_id: "booking-test",
          gym_goer_id: "test-user",
          amount: 20000,
          currency: "NGN",
          provider: "paystack",
          provider_reference: "trainr_test_reference",
          authorization_url: "https://checkout.paystack.com/test",
          status: "pending",
          initialization_status: "reconciliation_required",
        },
        false,
        undefined,
        {
          id: "booking-test",
          status: "completed",
        },
      ),
      {
        getSecretKey: () => "test-secret",
        fetch: async () => {
          fetchCalls++;
          throw new Error(
            "Paystack must not be contacted for a completed booking.",
          );
        },
      },
    );

    assertEquals(response.status, 409);
    assertEquals(await response.json(), {
      error: "Only confirmed bookings can recover payment checkout.",
      paymentId: validPaymentId,
      status: "pending",
    });
    assertEquals(fetchCalls, 0);
  },
);

Deno.test("reuses an existing initialized checkout", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      booking_id: "booking-test",
      gym_goer_id: "test-user",
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_test_reference",
      authorization_url: "https://checkout.paystack.com/test",
      status: "pending",
      initialization_status: "initialized",
    }),
    {
      getSecretKey: () => undefined,
      fetch: async () => {
        fetchCalls++;
        throw new Error("Fetch should not be called.");
      },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    paymentId: validPaymentId,
    reference: "trainr_test_reference",
    authorizationUrl: "https://checkout.paystack.com/test",
    status: "pending",
    initializationStatus: "initialized",
  });
  assertEquals(fetchCalls, 0);
});

Deno.test("rejects payments from an unsupported provider", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "unsupported-provider",
      provider_reference: "trainr_test_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    }),
    {
      getSecretKey: () => "test-secret",
      fetch: async () => {
        fetchCalls++;
        throw new Error("Fetch should not be called.");
      },
    },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Payment details are not eligible for recovery.",
  });
  assertEquals(fetchCalls, 0);
});

Deno.test("rejects an invalid stored payment amount before verification", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      amount: -20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_test_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    }),
    {
      getSecretKey: () => "test-secret",
      fetch: async () => {
        fetchCalls++;
        throw new Error("Fetch should not be called.");
      },
    },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Stored payment amount is invalid.",
  });
  assertEquals(fetchCalls, 0);
});

Deno.test("rejects a Paystack transaction with a mismatched reference", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    }),
    {
      getSecretKey: () => "test-secret",
      fetch: async () => {
        fetchCalls++;
        return Response.json({
          status: true,
          data: {
            reference: "trainr_different_reference",
            status: "success",
            amount: 2000000,
            currency: "NGN",
          },
        });
      },
    },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Verified transaction details do not match this payment.",
  });
  assertEquals(fetchCalls, 1);
});

Deno.test("confirms a matching successful Paystack transaction", async () => {
  let fetchCalls = 0;

  const response = await handleRecoverPayment(
    postRecoveryRequest(),
    createLookupContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    }),
    {
      getSecretKey: () => "test-secret",
      fetch: async (input, init) => {
        fetchCalls++;
        assertEquals(
          String(input),
          "https://api.paystack.co/transaction/verify/trainr_expected_reference",
        );
        assertEquals(init?.method, "GET");

        return Response.json({
          status: true,
          data: {
            reference: "trainr_expected_reference",
            status: "success",
            amount: 2000000,
            currency: "NGN",
          },
        });
      },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    paymentId: validPaymentId,
    status: "successful",
    message: "Payment recovered and verified successfully.",
  });
  assertEquals(fetchCalls, 1);
});

Deno.test(
  "returns an error when Paystack succeeds but database confirmation fails",
  async () => {
    const mock = createLookupContext(
      {
        id: validPaymentId,
        amount: 20000,
        currency: "NGN",
        provider: "paystack",
        provider_reference: "trainr_expected_reference",
        authorization_url: null,
        status: "pending",
        initialization_status: "initializing",
      },
      true,
    );

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mock,
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json({
            status: true,
            data: {
              reference: "trainr_expected_reference",
              status: "success",
              amount: 2000000,
              currency: "NGN",
            },
          }),
      },
    );

    assertEquals(response.status, 500);
    assertEquals(await response.json(), {
      error:
        "Paystack verified the transaction, but TRAINR could not confirm it in the database. Reconciliation is required.",
      paymentId: validPaymentId,
      initializationStatus: "reconciliation_required",
    });
    assertEquals(mock.getUpdateCalls(), 1);
    assertEquals(mock.getUpdateValues(), {
      initialization_status: "reconciliation_required",
      updated_at: mock.getUpdateValues()?.updated_at,
    });
  },
);

Deno.test(
  "flags an initialized payment for reconciliation when database confirmation fails",
  async () => {
    const mock = createLookupContext(
      {
        id: validPaymentId,
        amount: 20000,
        currency: "NGN",
        provider: "paystack",
        provider_reference: "trainr_expected_reference",
        authorization_url: "https://checkout.example.test",
        status: "pending",
        initialization_status: "initialized",
      },
      true,
    );

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mock,
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json({
            status: true,
            data: {
              reference: "trainr_expected_reference",
              status: "success",
              amount: 2000000,
              currency: "NGN",
            },
          }),
      },
    );

    assertEquals(response.status, 500);
    assertEquals(await response.json(), {
      error:
        "Paystack verified the transaction, but TRAINR could not confirm it in the database. Reconciliation is required.",
      paymentId: validPaymentId,
      initializationStatus: "reconciliation_required",
    });
    assertEquals(mock.getUpdateCalls(), 1);
    assertEquals(
      mock.getUpdateValues()?.initialization_status,
      "reconciliation_required",
    );
  },
);

Deno.test(
  "does not report success when the confirmation RPC returns an unexpected result",
  async () => {
    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      createLookupContext(
        {
          id: validPaymentId,
          amount: 20000,
          currency: "NGN",
          provider: "paystack",
          provider_reference: "trainr_expected_reference",
          authorization_url: null,
          status: "pending",
          initialization_status: "initializing",
        },
        false,
        {
          data: [],
          error: null,
        },
      ),
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json({
            status: true,
            data: {
              reference: "trainr_expected_reference",
              status: "success",
              amount: 2000000,
              currency: "NGN",
            },
          }),
      },
    );

    assertEquals(response.status, 409);
    assertEquals(await response.json(), {
      error:
        "TRAINR could not confirm the recovered payment. Please retry recovery later or contact support if the issue persists.",
      paymentId: validPaymentId,
    });
  },
);

Deno.test(
  "keeps recovery retryable when Paystack verification throws during initialization",
  async () => {
    const mock = createReconciliationContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    });

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mock.mockContext,
      {
        getSecretKey: () => "test-secret",
        fetch: async () => {
          throw new Error("Simulated network failure");
        },
      },
    );

    assertEquals(response.status, 503);
    assertEquals(mock.getUpdateCalls(), 0);

    const body = await response.json();
    assertEquals(body.status, "pending");
    assertEquals(body.initializationStatus, "initializing");
  },
);

Deno.test(
  "does not confirm payment when Paystack returns an unsuccessful HTTP response",
  async () => {
    let rpcCalls = 0;

    const mockContext = createLookupContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    });

    const originalRpc = mockContext.supabaseAdmin.rpc;
    mockContext.supabaseAdmin.rpc = (
      ...args: Parameters<typeof originalRpc>
    ) => {
      rpcCalls++;
      return originalRpc(...args);
    };

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mockContext,
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json(
            { status: false, message: "Verification unavailable" },
            { status: 502 },
          ),
      },
    );

    assertEquals(response.status, 502);
    assertEquals(rpcCalls, 0);
  },
);

Deno.test(
  "does not confirm payment when Paystack reports a non-successful transaction",
  async () => {
    let rpcCalls = 0;

    const mock = createReconciliationContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: null,
      status: "pending",
      initialization_status: "initializing",
    });

    const mockContext = {
      ...mock.mockContext,
      supabaseAdmin: {
        ...mock.mockContext.supabaseAdmin,
        rpc() {
          rpcCalls++;
          return Promise.resolve({
            data: null,
            error: null,
          });
        },
      },
    };

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mockContext,
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json({
            status: true,
            data: {
              reference: "trainr_expected_reference",
              status: "failed",
              amount: 2000000,
              currency: "NGN",
            },
          }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(rpcCalls, 0);
    assertEquals(mock.getUpdateCalls(), 1);

    const body = await response.json();
    assertEquals(body.status, "pending");
    assertEquals(body.initializationStatus, "reconciliation_required");
  },
);

Deno.test(
  "does not confirm payment when Paystack reports an abandoned transaction",
  async () => {
    let rpcCalls = 0;

    const mock = createReconciliationContext({
      id: validPaymentId,
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_expected_reference",
      authorization_url: "https://checkout.paystack.com/test-checkout",
      status: "pending",
      initialization_status: "reconciliation_required",
    });

    const mockContext = {
      ...mock.mockContext,
      supabaseAdmin: {
        ...mock.mockContext.supabaseAdmin,
        rpc() {
          rpcCalls++;
          return Promise.resolve({
            data: null,
            error: null,
          });
        },
      },
    };

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      mockContext,
      {
        getSecretKey: () => "test-secret",
        fetch: async () =>
          Response.json({
            status: true,
            data: {
              reference: "trainr_expected_reference",
              status: "abandoned",
              amount: 2000000,
              currency: "NGN",
            },
          }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(rpcCalls, 0);

    const body = await response.json();
    assertEquals(body.status, "pending");
    assertEquals(body.initializationStatus, "reconciliation_required");
    assertEquals(body.providerStatus, "abandoned");
  },
);

Deno.test(
  "rejects recovery for a superseded payment without contacting Paystack",
  async () => {
    const payment = {
      id: validPaymentId,
      booking_id: "booking-test",
      gym_goer_id: "test-user",
      amount: 20000,
      currency: "NGN",
      provider: "paystack",
      provider_reference: "trainr_old_reference",
      authorization_url: "https://checkout.example/old",
      status: "failed",
      initialization_status: "initialized",
      superseded_by: "550e8400-e29b-41d4-a716-446655440001",
    };

    const response = await handleRecoverPayment(
      postRecoveryRequest(),
      createLookupContext(payment),
      {
        getSecretKey: () => "test-secret",
        fetch: async () => {
          throw new Error(
            "Paystack must not be called for a superseded payment.",
          );
        },
      },
    );

    assertEquals(response.status, 409);
    assertEquals(await response.json(), {
      error:
        "This payment attempt has been superseded. Please use the latest payment attempt or contact support.",
      paymentId: validPaymentId,
      supersededBy: payment.superseded_by,
      status: "failed",
    });
  },
);
