import { assert, assertEquals } from "jsr:@std/assert@^1";

import { handleTrainerTransactionHistory } from "./handler.ts";

const trainerId = "197cea55-7006-4c26-b038-ef64e6477f47";

function makeRequest(
  body: unknown = {},
  method = "POST",
): Request {
  return new Request("http://localhost/trainer-transaction-history", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function makeBuilder(
  result: any,
  calls: { method: string; args: unknown[] }[],
) {
  const builder: any = {};

  for (
    const method of [
      "select",
      "eq",
      "is",
      "order",
      "range",
    ]
  ) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }

  builder.maybeSingle = () => Promise.resolve(result);

  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);

  return builder;
}

function makeContext(options: {
  userId?: string | null;
  profile?: any;
  profileError?: any;
  payments?: any[];
  paymentError?: any;
  count?: number;
} = {}) {
  const calls: {
    table: string;
    method: string;
    args: unknown[];
  }[] = [];

  const profileResult = {
    data: options.profile === undefined
      ? { id: trainerId, role: "trainer" }
      : options.profile,
    error: options.profileError ?? null,
  };

  const paymentResult = {
    data: options.payments ?? [],
    error: options.paymentError ?? null,
    count: options.count ?? 0,
  };

  const admin = {
    from(table: string) {
      calls.push({
        table,
        method: "from",
        args: [],
      });

      const result = table === "profiles" ? profileResult : paymentResult;

      return makeBuilder(result, calls);
    },
  };

  return {
    ctx: {
      userClaims: options.userId === null
        ? null
        : { id: options.userId ?? trainerId },
      supabaseAdmin: admin,
    },
    calls,
  };
}

async function submit(
  body: unknown = {},
  options: Parameters<typeof makeContext>[0] = {},
) {
  const mock = makeContext(options);

  const response = await handleTrainerTransactionHistory(
    makeRequest(body),
    mock.ctx,
  );

  return {
    response,
    data: await response.json(),
    calls: mock.calls,
  };
}

Deno.test("rejects non-POST requests", async () => {
  const mock = makeContext();

  const response = await handleTrainerTransactionHistory(
    makeRequest({}, "GET"),
    mock.ctx,
  );

  assertEquals(response.status, 405);
});

Deno.test("rejects missing authentication", async () => {
  const { response } = await submit({}, {
    userId: null,
  });

  assertEquals(response.status, 401);
});

Deno.test("rejects non-trainer accounts", async () => {
  const { response } = await submit({}, {
    profile: {
      id: trainerId,
      role: "gym_goer",
    },
  });

  assertEquals(response.status, 403);
});

Deno.test("returns 500 when trainer profile lookup fails", async () => {
  const { response } = await submit({}, {
    profileError: {
      message: "Database error",
    },
  });

  assertEquals(response.status, 500);
});

Deno.test("rejects malformed JSON", async () => {
  const mock = makeContext();

  const request = new Request(
    "http://localhost/trainer-transaction-history",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    },
  );

  const response = await handleTrainerTransactionHistory(
    request,
    mock.ctx,
  );

  assertEquals(response.status, 400);
});

Deno.test("rejects invalid pagination values", async () => {
  const invalidBodies = [
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 51 },
    { pageSize: 1.5 },
  ];

  for (const body of invalidBodies) {
    const { response } = await submit(body);

    assertEquals(response.status, 400);
  }
});

Deno.test("rejects invalid payment status filters", async () => {
  const { response } = await submit({
    status: "refunded",
  });

  assertEquals(response.status, 400);
});

Deno.test("rejects non-object request bodies", async () => {
  const mock = makeContext();

  const request = new Request(
    "http://localhost/trainer-transaction-history",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    },
  );

  const response = await handleTrainerTransactionHistory(
    request,
    mock.ctx,
  );

  assertEquals(response.status, 400);
});

Deno.test("returns an empty transaction history", async () => {
  const { response, data } = await submit();

  assertEquals(response.status, 200);
  assertEquals(data.transactions, []);
  assertEquals(data.pagination.total, 0);
  assertEquals(data.pagination.totalPages, 0);
  assertEquals(data.pagination.hasNextPage, false);
  assertEquals(data.pagination.hasPreviousPage, false);
  assertEquals(data.filters.status, null);
});

Deno.test("returns transaction history with pagination", async () => {
  const payment = {
    id: "payment-1",
    booking_id: "booking-1",
    amount: 20000,
    currency: "NGN",
    provider: "paystack",
    status: "successful",
    paid_at: "2026-11-10T10:00:00Z",
    created_at: "2026-11-10T09:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    booking: {
      id: "booking-1",
      scheduled_start: "2026-11-10T09:00:00Z",
      scheduled_end: "2026-11-10T10:00:00Z",
      status: "completed",
    },
  };

  const { response, data } = await submit({
    page: 1,
    pageSize: 10,
  }, {
    payments: [payment],
    count: 25,
  });

  assertEquals(response.status, 200);
  assertEquals(data.transactions.length, 1);
  assertEquals(data.transactions[0].bookingId, "booking-1");
  assertEquals(data.transactions[0].amount, 20000);
  assertEquals(data.transactions[0].currency, "NGN");
  assertEquals(data.pagination.total, 25);
  assertEquals(data.pagination.totalPages, 3);
  assertEquals(data.pagination.hasNextPage, true);
  assertEquals(data.pagination.hasPreviousPage, false);
});

Deno.test("scopes payment history to the authenticated trainer", async () => {
  const { calls } = await submit();

  const trainerFilter = calls.find(
    (call) =>
      call.method === "eq" &&
      call.args[0] === "booking.trainer_id",
  );

  assert(trainerFilter);
  assertEquals(trainerFilter.args[1], trainerId);
});

Deno.test("excludes superseded payment attempts", async () => {
  const { calls } = await submit();

  const supersededFilter = calls.find(
    (call) =>
      call.method === "is" &&
      call.args[0] === "superseded_by",
  );

  assert(supersededFilter);
  assertEquals(supersededFilter.args[1], null);
});

Deno.test("applies the requested payment status filter", async () => {
  const { response, data, calls } = await submit({
    status: "successful",
  });

  assertEquals(response.status, 200);
  assertEquals(data.filters.status, "successful");

  const statusFilter = calls.find(
    (call) =>
      call.method === "eq" &&
      call.args[0] === "status",
  );

  assert(statusFilter);
  assertEquals(statusFilter.args[1], "successful");
});

Deno.test("applies pagination range to the database query", async () => {
  const { calls } = await submit({
    page: 2,
    pageSize: 10,
  });

  const rangeCall = calls.find(
    (call) => call.method === "range",
  );

  assert(rangeCall);
  assertEquals(rangeCall.args, [10, 19]);
});

Deno.test("does not expose sensitive payment fields", async () => {
  const payment = {
    id: "payment-1",
    booking_id: "booking-1",
    amount: 20000,
    currency: "NGN",
    provider: "paystack",
    status: "successful",
    paid_at: null,
    created_at: "2026-11-10T09:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    provider_reference: "secret-reference",
    authorization_url: "https://example.com/checkout",
    gym_goer_id: "private-user-id",
    booking: null,
  };

  const { response, data } = await submit({}, {
    payments: [payment],
    count: 1,
  });

  assertEquals(response.status, 200);

  const transaction = data.transactions[0];

  assertEquals("provider_reference" in transaction, false);
  assertEquals("authorization_url" in transaction, false);
  assertEquals("gym_goer_id" in transaction, false);
});

Deno.test("returns 500 when payment lookup fails", async () => {
  const { response } = await submit({}, {
    paymentError: {
      message: "Payment query failed",
    },
  });

  assertEquals(response.status, 500);
});

Deno.test("does not return transactions when trainer verification fails", async () => {
  const mock = makeContext({
    profile: {
      id: trainerId,
      role: "gym_goer",
    },
  });

  const response = await handleTrainerTransactionHistory(
    makeRequest(),
    mock.ctx,
  );

  assertEquals(response.status, 403);

  const paymentQuery = mock.calls.some(
    (call) => call.table === "booking_payments",
  );

  assertEquals(paymentQuery, false);
});

Deno.test("sets no-store cache control on successful responses", async () => {
  const { response } = await submit();

  assertEquals(
    response.headers.get("Cache-Control"),
    "no-store",
  );
});
