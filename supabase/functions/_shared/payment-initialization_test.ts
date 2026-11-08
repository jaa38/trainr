import { assertEquals } from "jsr:@std/assert";
import { getExistingPaymentInitializationAction } from "./payment-initialization.ts";

Deno.test(
  "allows a not_started payment to proceed to atomic initialization",
  () => {
    assertEquals(
      getExistingPaymentInitializationAction("not_started", false),
      "initialize",
    );
  },
);

Deno.test(
  "reuses an initialized payment with a matching checkout",
  () => {
    assertEquals(
      getExistingPaymentInitializationAction("initialized", true),
      "reuse",
    );
  },
);

Deno.test(
  "rejects an initialized payment without a matching checkout",
  () => {
    assertEquals(
      getExistingPaymentInitializationAction("initialized", false),
      "reject",
    );
  },
);

Deno.test(
  "rejects a payment whose initialization is already in progress",
  () => {
    assertEquals(
      getExistingPaymentInitializationAction("initializing", false),
      "reject",
    );
  },
);

Deno.test(
  "rejects a payment requiring reconciliation",
  () => {
    assertEquals(
      getExistingPaymentInitializationAction(
        "reconciliation_required",
        false,
      ),
      "reject",
    );
  },
);
