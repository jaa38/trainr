import { assertEquals } from "jsr:@std/assert";
import { getRecoveryOutcome } from "./payment-recovery.ts";

Deno.test(
  "reconciles a payment when initialization has not started and the reference is missing",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "not_started",
        "missing_provider_reference",
      ),
      "reconciliation_required",
    );
  },
);

Deno.test(
  "reconciles a payment when initialization is in progress and the transaction is not successful",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "initializing",
        "transaction_not_successful",
      ),
      "reconciliation_required",
    );
  },
);

Deno.test(
  "retries verification when an initialized checkout cannot be verified temporarily",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "initialized",
        "verification_unavailable",
      ),
      "retry_verification",
    );
  },
);

Deno.test(
  "retries verification for an initialized checkout when the transaction is not successful yet",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "initialized",
        "transaction_not_successful",
      ),
      "retry_verification",
    );
  },
);

Deno.test(
  "retries verification when initialization is in progress but Paystack is temporarily unavailable",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "initializing",
        "verification_unavailable",
      ),
      "retry_verification",
    );
  },
);

Deno.test(
  "keeps an already flagged pending payment in reconciliation",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "pending",
        "reconciliation_required",
        "verification_unavailable",
      ),
      "reconciliation_required",
    );
  },
);

Deno.test(
  "does not request reconciliation for successful payments",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "successful",
        "initialized",
        "transaction_not_successful",
      ),
      "not_applicable",
    );
  },
);

Deno.test(
  "does not request reconciliation for failed payments",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "failed",
        "initializing",
        "missing_provider_reference",
      ),
      "not_applicable",
    );
  },
);

Deno.test(
  "does not request reconciliation for cancelled payments",
  () => {
    assertEquals(
      getRecoveryOutcome(
        "cancelled",
        "not_started",
        "missing_provider_reference",
      ),
      "not_applicable",
    );
  },
);
