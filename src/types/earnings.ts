export type TrainerRecentEarning = {
    bookingId: string;
    paymentId: string;
    completedAt: string;
    grossAmount: number;
    commissionAmount: number;
    trainerNetAmount: number;
    currencyCode: string;
};

export type TrainerEarningsDashboard = {
    totalEarnings: number | null;
    nextPayoutAmount: number | null;
    nextPayoutDate: string | null;
    currencyCode: string | null;

    financialStatus:
        | "available"
        | "no_earnings"
        | "unavailable";

    nextPayoutStatus:
        | "scheduled"
        | "not_available"
        | "unavailable";

    updatedAt: string;
    recentEarnings: TrainerRecentEarning[];
};

export type TrainerEarningsDashboardResult = {
    data: TrainerEarningsDashboard | null;
    error: string | null;
};
