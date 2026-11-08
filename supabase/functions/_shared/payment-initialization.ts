import type { PaymentInitializationStatus } from "./payment-recovery.ts";

export type ExistingPaymentInitializationAction =
  | "reuse"
  | "initialize"
  | "reject";

export function getExistingPaymentInitializationAction(
  initializationStatus: PaymentInitializationStatus,
  hasMatchingCheckout: boolean,
): ExistingPaymentInitializationAction {
  if (initializationStatus === "not_started") {
    return "initialize";
  }

  if (
    initializationStatus === "initialized" &&
    hasMatchingCheckout
  ) {
    return "reuse";
  }

  return "reject";
}
