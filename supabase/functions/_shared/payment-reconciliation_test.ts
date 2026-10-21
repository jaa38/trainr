import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { markReconciliationRequired } from "./payment-reconciliation.ts";

type PaymentRow = {
  id: string;
  status: string;
  initialization_status: string;
};

function createMockAdmin(initialPayment: PaymentRow | null) {
  let payment = initialPayment ? { ...initialPayment } : null;
  let updateCalls = 0;
  let lookupCalls = 0;
  let updateError: { message: string } | null = null;
  let lookupError: { message: string } | null = null;
  let forceNoUpdatedRows = false;

  const admin = {
    from(table: "booking_payments") {
      assertEquals(table, "booking_payments");

      return {
        update(values: Record<string, unknown>) {
          updateCalls++;

          return {
            eq() {
              return this;
            },
            in() {
              return this;
            },
            select() {
              if (updateError) {
                return Promise.resolve({
                  data: null,
                  error: updateError,
                });
              }

              if (
                payment?.status === "pending" &&
                [
                  "not_started",
                  "initializing",
                  "initialized",
                ].includes(payment.initialization_status) &&
                !forceNoUpdatedRows
              ) {
                payment.initialization_status = String(
                  values.initialization_status,
                );

                return Promise.resolve({
                  data: [{ id: payment.id }],
                  error: null,
                });
              }

              return Promise.resolve({ data: [], error: null });
            },
          };
        },

        select() {
          lookupCalls++;

          return {
            eq() {
              return this;
            },
            maybeSingle() {
              return Promise.resolve({
                data: payment,
                error: lookupError,
              });
            },
          };
        },
      };
    },
  };

  return {
    admin,
    getPayment: () => payment,
    getUpdateCalls: () => updateCalls,
    getLookupCalls: () => lookupCalls,
    setUpdateError: (message: string) => {
      updateError = { message };
    },
    setLookupError: (message: string) => {
      lookupError = { message };
    },
    setForceNoUpdatedRows: (value: boolean) => {
      forceNoUpdatedRows = value;
    },
    setPaymentInitializationStatus: (status: string) => {
      if (payment) {
        payment.initialization_status = status;
      }
    },
  };
}

const pendingPayment = (): PaymentRow => ({
  id: "payment-123",
  status: "pending",
  initialization_status: "not_started",
});

Deno.test("marks a pending payment for reconciliation", async () => {
  const mock = createMockAdmin(pendingPayment());

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "not_started",
    "missing_provider_reference",
  );

  assertEquals(result, "updated");
  assertEquals(
    mock.getPayment()?.initialization_status,
    "reconciliation_required",
  );
  assertEquals(mock.getUpdateCalls(), 1);
  assertEquals(mock.getLookupCalls(), 0);
});

Deno.test("does not update a payment already flagged for reconciliation", async () => {
  const mock = createMockAdmin({
    ...pendingPayment(),
    initialization_status: "reconciliation_required",
  });

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "reconciliation_required",
    "missing_provider_reference",
  );

  assertEquals(result, "already_flagged");
  assertEquals(mock.getUpdateCalls(), 0);
  assertEquals(mock.getLookupCalls(), 0);
});

Deno.test("does not request reconciliation for an initialized checkout with a temporary verification failure", async () => {
  const mock = createMockAdmin({
    ...pendingPayment(),
    initialization_status: "initialized",
  });

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "initialized",
    "verification_unavailable",
  );

  assertEquals(result, "not_required");
  assertEquals(mock.getUpdateCalls(), 0);
});

Deno.test("returns error when the reconciliation update fails", async () => {
  const mock = createMockAdmin(pendingPayment());
  mock.setUpdateError("Update failed");

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "not_started",
    "missing_provider_reference",
  );

  assertEquals(result, "error");
});

Deno.test("returns already_flagged when another process flags the payment first", async () => {
  const mock = createMockAdmin(pendingPayment());
  mock.setForceNoUpdatedRows(true);

  // Simulate another process flagging the payment before the lookup.
  mock.setPaymentInitializationStatus("reconciliation_required");

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "not_started",
    "missing_provider_reference",
  );

  assertEquals(result, "already_flagged");
  assertEquals(mock.getLookupCalls(), 1);
});

Deno.test("returns state_changed when the payment is no longer pending", async () => {
  const mock = createMockAdmin({
    ...pendingPayment(),
    status: "successful",
  });
  mock.setForceNoUpdatedRows(true);

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "not_started",
    "missing_provider_reference",
  );

  assertEquals(result, "state_changed");
});

Deno.test("returns error when checking the payment state fails", async () => {
  const mock = createMockAdmin(pendingPayment());
  mock.setForceNoUpdatedRows(true);
  mock.setLookupError("Lookup failed");

  const result = await markReconciliationRequired(
    mock.admin,
    "payment-123",
    "pending",
    "not_started",
    "missing_provider_reference",
  );

  assertEquals(result, "error");
});

Deno.test(
  "flags an initialized pending payment when forced reconciliation is requested",
  async () => {
    const mock = createMockAdmin({
      ...pendingPayment(),
      initialization_status: "initialized",
    });

    const result = await markReconciliationRequired(
      mock.admin,
      "payment-123",
      "pending",
      "initialized",
      "transaction_not_successful",
      { force: true },
    );

    assertEquals(result, "updated");
    assertEquals(
      mock.getPayment()?.initialization_status,
      "reconciliation_required",
    );
    assertEquals(mock.getUpdateCalls(), 1);
  },
);
