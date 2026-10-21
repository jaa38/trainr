export type PaymentInitializationStatus =
  | "not_started"
  | "initializing"
  | "initialized"
  | "reconciliation_required";

export type PaymentStatus =
  | "pending"
  | "successful"
  | "failed"
  | "cancelled";

export type RecoveryFailureReason =
  | "verification_unavailable"
  | "transaction_not_successful"
  | "missing_provider_reference";

export type RecoveryOutcome =
  | "not_applicable"
  | "retry_verification"
  | "reconciliation_required";

export function getRecoveryOutcome(
  paymentStatus: PaymentStatus,
  initializationStatus: PaymentInitializationStatus,
  failureReason: RecoveryFailureReason,
): RecoveryOutcome {
  if (paymentStatus !== "pending") {
    return "not_applicable";
  }

  // Preserve an existing reconciliation state.
  if (initializationStatus === "reconciliation_required") {
    return "reconciliation_required";
  }

  // Temporary verification failures should be retried.
  if (failureReason === "verification_unavailable") {
    return "retry_verification";
  }

  // An initialized checkout can be checked again using its reference.
  if (initializationStatus === "initialized") {
    return "retry_verification";
  }

  // Missing references or unresolved initialization require review.
  return "reconciliation_required";
}
