import {
  getRecoveryOutcome,
  type PaymentInitializationStatus,
  type PaymentStatus,
  type RecoveryFailureReason,
} from "./payment-recovery.ts";

export type ReconciliationUpdateResult =
  | "not_required"
  | "updated"
  | "already_flagged"
  | "state_changed"
  | "error";

type PaymentAdmin = {
  from: (table: "booking_payments") => any;
};

type ReconciliationOptions = {
  force?: boolean;
};

export async function markReconciliationRequired(
  admin: PaymentAdmin,
  paymentId: string,
  paymentStatus: PaymentStatus,
  initializationStatus: PaymentInitializationStatus,
  failureReason: RecoveryFailureReason,
  options: ReconciliationOptions = {},
): Promise<ReconciliationUpdateResult> {
  const outcome = getRecoveryOutcome(
    paymentStatus,
    initializationStatus,
    failureReason,
  );

  if (outcome !== "reconciliation_required" && !options.force) {
    return "not_required";
  }

  if (paymentStatus !== "pending") {
    return "not_required";
  }

  if (initializationStatus === "reconciliation_required") {
    return "already_flagged";
  }

  const allowedInitializationStatuses = options.force
    ? ["not_started", "initializing", "initialized"]
    : ["not_started", "initializing"];

  const { data, error } = await admin
    .from("booking_payments")
    .update({
      initialization_status: "reconciliation_required",
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .in("initialization_status", allowedInitializationStatuses)
    .select("id");

  if (error) {
    console.error(
      "Unable to mark payment for reconciliation:",
      error.message,
    );
    return "error";
  }

  if (data?.length) {
    return "updated";
  }

  const { data: currentPayment, error: lookupError } = await admin
    .from("booking_payments")
    .select("status, initialization_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (lookupError) {
    console.error(
      "Unable to check payment reconciliation state:",
      lookupError.message,
    );
    return "error";
  }

  if (
    currentPayment?.status === "pending" &&
    currentPayment.initialization_status === "reconciliation_required"
  ) {
    return "already_flagged";
  }

  return "state_changed";
}
