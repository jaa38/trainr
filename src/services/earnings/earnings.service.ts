import { supabase } from "@/lib/supabase";

import type {
    TrainerEarningsDashboard,
    TrainerEarningsDashboardResult,
    TrainerRecentEarning,
} from "@/types/earnings";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAmount(value: unknown): value is number | null {
    return (
        value === null ||
        (typeof value === "number" && Number.isFinite(value) && value >= 0)
    );
}

function isValidCurrency(value: unknown): value is string | null {
    return (
        value === null ||
        (typeof value === "string" && /^[A-Z]{3}$/.test(value))
    );
}

function isValidDate(value: unknown): value is string | null {
    if (value === null) return true;

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

function isValidTimestamp(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidRecentEarning(value: unknown): value is TrainerRecentEarning {
    if (!isRecord(value)) return false;

    return (
        typeof value.bookingId === "string" &&
        value.bookingId.length > 0 &&
        typeof value.paymentId === "string" &&
        value.paymentId.length > 0 &&
        isValidTimestamp(value.completedAt) &&
        typeof value.grossAmount === "number" &&
        Number.isFinite(value.grossAmount) &&
        value.grossAmount >= 0 &&
        typeof value.commissionAmount === "number" &&
        Number.isFinite(value.commissionAmount) &&
        value.commissionAmount >= 0 &&
        typeof value.trainerNetAmount === "number" &&
        Number.isFinite(value.trainerNetAmount) &&
        value.trainerNetAmount >= 0 &&
        typeof value.currencyCode === "string" &&
        /^[A-Z]{3}$/.test(value.currencyCode)
    );
}

function isValidDashboard(
    value: unknown,
): value is TrainerEarningsDashboard {
    if (!isRecord(value)) return false;

    const {
        totalEarnings,
        nextPayoutAmount,
        nextPayoutDate,
        currencyCode,
        financialStatus,
        nextPayoutStatus,
        updatedAt,
        recentEarnings,
    } = value;

    if (
        !isValidAmount(totalEarnings) ||
        !isValidAmount(nextPayoutAmount) ||
        !isValidCurrency(currencyCode) ||
        !isValidDate(nextPayoutDate) ||
        !isValidTimestamp(updatedAt) ||
        !Array.isArray(recentEarnings) ||
        !recentEarnings.every(isValidRecentEarning)
    ) {
        return false;
    }

    if (
        !["available", "no_earnings", "unavailable"].includes(
            financialStatus as string,
        )
    ) {
        return false;
    }

    if (
        !["scheduled", "not_available", "unavailable"].includes(
            nextPayoutStatus as string,
        )
    ) {
        return false;
    }

    if (financialStatus === "available") {
        if (totalEarnings === null || currencyCode === null) return false;
    }

    if (financialStatus === "no_earnings") {
        if (
            totalEarnings !== 0 ||
            currencyCode === null ||
            recentEarnings.length !== 0
        ) {
            return false;
        }
    }

    if (financialStatus === "unavailable") {
        if (
            totalEarnings !== null ||
            nextPayoutAmount !== null ||
            nextPayoutDate !== null ||
            recentEarnings.length !== 0
        ) {
            return false;
        }
    }

    if (nextPayoutStatus === "scheduled") {
        if (
            financialStatus !== "available" ||
            nextPayoutAmount === null ||
            nextPayoutDate === null ||
            currencyCode === null
        ) {
            return false;
        }
    }

    if (nextPayoutStatus === "not_available") {
        if (nextPayoutAmount !== null || nextPayoutDate !== null) {
            return false;
        }
    }

    if (nextPayoutStatus === "unavailable") {
        if (nextPayoutAmount !== null || nextPayoutDate !== null) {
            return false;
        }
    }

    // Recent entries must use the same currency as the dashboard.
    if (
        currencyCode !== null &&
        recentEarnings.some((earning) => earning.currencyCode !== currencyCode)
    ) {
        return false;
    }

    return true;
}

export async function getTrainerEarningsDashboard(): Promise<
    TrainerEarningsDashboardResult
> {
    const { data, error } = await supabase.functions.invoke(
        "trainer-earnings-dashboard",
        {
            method: "POST",
            body: {},
        },
    );

    if (error) {
        throw new Error("Unable to retrieve earnings information.");
    }

    if (!isRecord(data) || !isValidDashboard(data.dashboard)) {
        throw new Error("Earnings information is currently unavailable.");
    }

    return {
        data: data.dashboard,
        error: null,
    };
}
