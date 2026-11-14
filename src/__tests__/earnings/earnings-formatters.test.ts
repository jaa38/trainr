import {
    formatEarningsAmount,
    formatPayoutDate,
} from "@/utils/earnings/earnings-formatters";
import { describe, expect, it } from "@jest/globals";

describe("formatEarningsAmount", () => {
    it("formats a valid currency amount", () => {
        const result = formatEarningsAmount(1250.5, "USD");

        const expected = new Intl.NumberFormat("en", {
            style: "currency",
            currency: "USD",
            currencyDisplay: "narrowSymbol",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(1250.5);

        expect(result).toBe(expected);
    });

    it("formats zero earnings correctly", () => {
        const result = formatEarningsAmount(0, "NGN");

        expect(result).toBe("₦0.00");
    });

    it("returns a placeholder when the amount is null", () => {
        expect(formatEarningsAmount(null, "NGN")).toBe("—");
    });

    it("returns a placeholder when the currency is null", () => {
        expect(formatEarningsAmount(1000, null)).toBe("—");
    });

    it("returns a placeholder for an invalid currency", () => {
        expect(formatEarningsAmount(1000, "INVALID")).toBe("—");
    });
});

describe("formatPayoutDate", () => {
    it("formats a valid payout date", () => {
        const date = "2026-11-13";

        const expected = new Intl.DateTimeFormat("en", {
            weekday: "short",
            day: "numeric",
            month: "short",
        }).format(new Date(`${date}T12:00:00`));

        expect(formatPayoutDate(date)).toBe(expected);
    });

    it("returns a placeholder when the date is null", () => {
        expect(formatPayoutDate(null)).toBe("—");
    });

    it("returns a placeholder when the date is empty", () => {
        expect(formatPayoutDate("")).toBe("—");
    });

    it("returns a placeholder for an invalid date", () => {
        expect(formatPayoutDate("invalid-date")).toBe("—");
    });
});
