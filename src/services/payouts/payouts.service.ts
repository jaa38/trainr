import { supabase } from "@/lib/supabase";

import type {
    PayoutAccountVerificationStatus,
    PayoutDestinationType,
    PayoutStatus,
    TrainerPayoutAccount,
    TrainerPayoutAvailability,
    TrainerPayoutHistoryItem,
    TrainerPayoutManagement,
    TrainerPayoutManagementResult,
} from "@/types/payouts";

const PAYOUT_STATUSES: PayoutStatus[] = [
    "pending_approval",
    "approved",
    "rejected",
    "processing",
    "paid",
    "failed",
    "cancelled",
];

const ACCOUNT_VERIFICATION_STATUSES: PayoutAccountVerificationStatus[] = [
    "pending_verification",
    "verified",
    "rejected",
    "disabled",
];

const PAYOUT_DESTINATION_TYPES: PayoutDestinationType[] = [
    "bank_account",
    "mobile_money",
    "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isNonEmptyString(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    );
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function isValidAmount(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function isValidCurrency(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^[A-Z]{3}$/.test(value)
    );
}

function isValidCountryCode(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^[A-Z]{2}$/.test(value)
    );
}

function isValidDate(value: unknown): value is string | null {
    if (value === null) return true;

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

function isValidTimestamp(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        !Number.isNaN(Date.parse(value))
    );
}

function isNullableTimestamp(
    value: unknown,
): value is string | null {
    return value === null || isValidTimestamp(value);
}

function isPayoutStatus(value: unknown): value is PayoutStatus {
    return (
        typeof value === "string" &&
        PAYOUT_STATUSES.includes(value as PayoutStatus)
    );
}

function isAccountVerificationStatus(
    value: unknown,
): value is PayoutAccountVerificationStatus {
    return (
        typeof value === "string" &&
        ACCOUNT_VERIFICATION_STATUSES.includes(
            value as PayoutAccountVerificationStatus,
        )
    );
}

function isPayoutDestinationType(
    value: unknown,
): value is PayoutDestinationType {
    return (
        typeof value === "string" &&
        PAYOUT_DESTINATION_TYPES.includes(
            value as PayoutDestinationType,
        )
    );
}

function isValidPayoutAccount(
    value: unknown,
): value is TrainerPayoutAccount {
    if (!isRecord(value)) return false;

    return (
        isNonEmptyString(value.id) &&
        isNonEmptyString(value.marketId) &&
        isValidCountryCode(value.countryCode) &&
        isValidCurrency(value.currencyCode) &&
        isPayoutDestinationType(value.destinationType) &&
        isNullableString(value.maskedAccountLabel) &&
        isAccountVerificationStatus(value.verificationStatus) &&
        typeof value.isDefault === "boolean" &&
        isValidTimestamp(value.createdAt) &&
        isValidTimestamp(value.updatedAt)
    );
}

function isValidPayoutHistoryItem(
    value: unknown,
): value is TrainerPayoutHistoryItem {
    if (!isRecord(value)) return false;

    return (
        isNonEmptyString(value.id) &&
        isNonEmptyString(value.marketId) &&
        isValidCurrency(value.currencyCode) &&
        isValidAmount(value.amount) &&
        value.amount > 0 &&
        isValidDate(value.eligibleForDate) &&
        isPayoutStatus(value.status) &&
        isNullableTimestamp(value.approvedAt) &&
        isNullableTimestamp(value.rejectedAt) &&
        isNullableTimestamp(value.processedAt) &&
        isNullableTimestamp(value.paidAt) &&
        isNullableString(value.failureCode) &&
        isNullableString(value.failureMessage) &&
        isValidTimestamp(value.createdAt) &&
        isValidTimestamp(value.updatedAt)
    );
}

function isValidPayoutAvailability(
    value: unknown,
): value is TrainerPayoutAvailability {
    if (!isRecord(value)) return false;

    if (
        !["available", "unavailable"].includes(
            value.status as string,
        ) ||
        typeof value.payoutsEnabled !== "boolean" ||
        !(
            value.availableBalance === null ||
            isValidAmount(value.availableBalance)
        ) ||
        !(
            value.currencyCode === null ||
            isValidCurrency(value.currencyCode)
        )
    ) {
        return false;
    }

    if (value.status === "unavailable") {
        return (
            value.payoutsEnabled === false &&
            value.availableBalance === null &&
            value.currencyCode === null
        );
    }

    return (
        value.payoutsEnabled === true &&
        value.availableBalance !== null &&
        value.currencyCode !== null
    );
}

function isValidPayoutManagement(
    value: unknown,
): value is TrainerPayoutManagement {
    if (!isRecord(value)) return false;

    const {
        payoutAccounts,
        payoutHistory,
        payoutAvailability,
    } = value;

    return (
        Array.isArray(payoutAccounts) &&
        payoutAccounts.every(isValidPayoutAccount) &&
        Array.isArray(payoutHistory) &&
        payoutHistory.every(isValidPayoutHistoryItem) &&
        isValidPayoutAvailability(payoutAvailability)
    );
}

export async function getTrainerPayoutManagement(): Promise<
    TrainerPayoutManagementResult
> {
    const { data, error } = await supabase.functions.invoke(
        "trainer-payout-management",
        {
            method: "GET",
        },
    );

    if (error) {
        throw new Error(
            "Unable to retrieve payout management information.",
        );
    }

    if (
        !isRecord(data) ||
        !isValidPayoutManagement(data)
    ) {
        throw new Error(
            "Payout management information is currently unavailable.",
        );
    }

    return {
        data,
        error: null,
    };
}
