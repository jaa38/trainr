import { supabase } from "@/lib/supabase";
import { getTrainerEarningsDashboard } from "@/services/earnings/earnings.service";

jest.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: jest.fn(),
        },
    },
}));

const mockInvoke = jest.mocked(supabase.functions.invoke);

const validDashboard = {
    totalEarnings: 1250,
    nextPayoutAmount: null,
    nextPayoutDate: null,
    currencyCode: "NGN",
    financialStatus: "available",
    nextPayoutStatus: "not_available",
    updatedAt: "2026-11-13T10:00:00.000Z",
    recentEarnings: [],
};

describe("getTrainerEarningsDashboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns a valid earnings dashboard", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: validDashboard,
            },
            error: null,
        } as never);

        const result = await getTrainerEarningsDashboard();

        expect(result).toEqual({
            data: validDashboard,
            error: null,
        });
    });

    it("invokes the earnings Edge Function using POST", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: validDashboard,
            },
            error: null,
        } as never);

        await getTrainerEarningsDashboard();

        expect(mockInvoke).toHaveBeenCalledWith(
            "trainer-earnings-dashboard",
            {
                method: "POST",
                body: {},
            },
        );
    });

    it("rejects an Edge Function error", async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: {
                message: "Function unavailable",
            },
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Unable to retrieve earnings information.",
        );
    });

    it("rejects a missing dashboard response", async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });

    it("rejects a negative earnings amount", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: {
                    ...validDashboard,
                    totalEarnings: -100,
                },
            },
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });

    it("rejects an invalid currency code", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: {
                    ...validDashboard,
                    currencyCode: "INVALID",
                },
            },
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });

    it("rejects an available dashboard without a currency", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: {
                    ...validDashboard,
                    currencyCode: null,
                },
            },
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });

    it("rejects a scheduled payout without a date", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: {
                    ...validDashboard,
                    nextPayoutAmount: 500,
                    nextPayoutStatus: "scheduled",
                },
            },
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });

    it("rejects an unavailable dashboard exposing earnings", async () => {
        mockInvoke.mockResolvedValue({
            data: {
                dashboard: {
                    ...validDashboard,
                    totalEarnings: null,
                    financialStatus: "unavailable",
                    nextPayoutAmount: 500,
                },
            },
            error: null,
        } as never);

        await expect(
            getTrainerEarningsDashboard(),
        ).rejects.toThrow(
            "Earnings information is currently unavailable.",
        );
    });
});
