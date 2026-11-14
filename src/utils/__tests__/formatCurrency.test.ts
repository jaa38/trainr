import { describe, expect, it } from "@jest/globals";
import { formatCurrency } from "../formatCurrency";

describe("formatCurrency", () => {
    it("formats Nigerian Naira", () => {
        expect(formatCurrency(54000, { currency: "NGN" }))
            .toBe("₦54,000.00");
    });

    it("formats British Pounds", () => {
        expect(formatCurrency(1250, { currency: "GBP" }))
            .toBe("£1,250.00");
    });

    it("formats US Dollars", () => {
        expect(formatCurrency(1250, { currency: "USD" }))
            .toBe("$1,250.00");
    });

    it("formats Euros", () => {
        expect(formatCurrency(1250, { currency: "EUR" }))
            .toBe("€1,250.00");
    });

    it("handles zero", () => {
        expect(formatCurrency(0, { currency: "NGN" }))
            .toBe("₦0.00");
    });

    it("handles negative values", () => {
        expect(formatCurrency(-500, { currency: "NGN" }))
            .toBe("-₦500.00");
    });

    it("returns a dash for invalid amounts", () => {
        expect(formatCurrency(Number.NaN, { currency: "NGN" }))
            .toBe("—");
    });

    it("returns a dash for invalid currency codes", () => {
        expect(formatCurrency(1000, { currency: "INVALID" }))
            .toBe("—");
    });

    it("respects currency-specific decimal precision", () => {
        const result = formatCurrency(1250, { currency: "JPY" });

        expect(result).toMatch(/^[¥￥]1,250$/);
        expect(result).not.toContain(".");
    });
});
