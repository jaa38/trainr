export type PayoutStatus =
    | "pending_approval"
    | "approved"
    | "rejected"
    | "processing"
    | "paid"
    | "failed"
    | "cancelled";

export type PayoutAccountVerificationStatus =
    | "pending_verification"
    | "verified"
    | "rejected"
    | "disabled";

export type PayoutDestinationType =
    | "bank_account"
    | "mobile_money"
    | "other";

export type TrainerPayoutAccount = {
    id: string;
    marketId: string;
    countryCode: string;
    currencyCode: string;
    destinationType: PayoutDestinationType;
    maskedAccountLabel: string | null;
    verificationStatus: PayoutAccountVerificationStatus;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
};

export type TrainerPayoutHistoryItem = {
    id: string;
    marketId: string;
    currencyCode: string;
    amount: number;
    eligibleForDate: string | null;
    status: PayoutStatus;
    approvedAt: string | null;
    rejectedAt: string | null;
    processedAt: string | null;
    paidAt: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

export type TrainerPayoutAvailability = {
    status: "available" | "unavailable";
    payoutsEnabled: boolean;
    availableBalance: number | null;
    currencyCode: string | null;
};

export type TrainerPayoutManagement = {
    payoutAccounts: TrainerPayoutAccount[];
    payoutHistory: TrainerPayoutHistoryItem[];
    payoutAvailability: TrainerPayoutAvailability;
};

export type TrainerPayoutManagementResult = {
    data: TrainerPayoutManagement | null;
    error: string | null;
};
