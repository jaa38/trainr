import { assertEquals } from "jsr:@std/assert@^1";
import {
    isUuid,
    matchesVerifiedTransaction,
    toKobo,
} from "./payment-validation.ts";

Deno.test("isUuid accepts a valid UUID", () => {
    assertEquals(
        isUuid("550e8400-e29b-41d4-a716-446655440000"),
        true,
    );
});

Deno.test("isUuid rejects malformed input", () => {
    assertEquals(isUuid("not-a-uuid"), false);
    assertEquals(isUuid(null), false);
    assertEquals(isUuid(123), false);
});

Deno.test("toKobo converts naira to kobo", () => {
    assertEquals(toKobo(100), 10000);
    assertEquals(toKobo(125.5), 12550);
    assertEquals(toKobo(0.01), 1);
});

Deno.test("toKobo rejects invalid amounts", () => {
    assertEquals(toKobo(0), null);
    assertEquals(toKobo(-10), null);
    assertEquals(toKobo(Number.NaN), null);
    assertEquals(toKobo(Number.POSITIVE_INFINITY), null);
    assertEquals(toKobo(10.001), null);
});

Deno.test("matchesVerifiedTransaction accepts matching payment details", () => {
    assertEquals(
        matchesVerifiedTransaction(
            {
                reference: "trainr_test_123",
                amount: 12500,
                currency: "NGN",
            },
            "trainr_test_123",
            12500,
            "NGN",
        ),
        true,
    );
});

Deno.test("matchesVerifiedTransaction rejects a different reference", () => {
    assertEquals(
        matchesVerifiedTransaction(
            {
                reference: "different_reference",
                amount: 12500,
                currency: "NGN",
            },
            "trainr_test_123",
            12500,
            "NGN",
        ),
        false,
    );
});

Deno.test("matchesVerifiedTransaction rejects an incorrect amount", () => {
    assertEquals(
        matchesVerifiedTransaction(
            {
                reference: "trainr_test_123",
                amount: 12501,
                currency: "NGN",
            },
            "trainr_test_123",
            12500,
            "NGN",
        ),
        false,
    );
});

Deno.test("matchesVerifiedTransaction rejects a different currency", () => {
    assertEquals(
        matchesVerifiedTransaction(
            {
                reference: "trainr_test_123",
                amount: 12500,
                currency: "USD",
            },
            "trainr_test_123",
            12500,
            "NGN",
        ),
        false,
    );
});
