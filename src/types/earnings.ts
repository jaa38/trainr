export type EarningsPeriod =
    | "this_week"
    | "this_month"
    | "last_month"
    | "last_3_months"
    | "this_year";

export type TrainerRecentEarning = {
    bookingId: string;
    paymentId: string;
    completedAt: string;
    grossAmount: number;
    commissionAmount: number;
    trainerNetAmount: number;
    currencyCode: string;
};

export type TrainerEarningsTrendPoint = {
    date: string;
    grossRevenue: number;
    commissionAmount: number;
    netEarnings: number;
};

export type TrainerEarningsAnalytics = {
    period: EarningsPeriod;
    startDate: string;
    endDate: string;
    grossRevenue: number;
    commissionAmount: number;
    netEarnings: number;
    completedSessions: number;
    currencyCode: string;
    trend: TrainerEarningsTrendPoint[];
};

export type TrainerEarningsDashboard = {
    totalEarnings: number | null;
    nextPayoutAmount: number | null;
    nextPayoutDate: string | null;
    currencyCode: string | null;
    financialStatus: "available" | "no_earnings" | "unavailable";
    nextPayoutStatus: "scheduled" | "not_available" | "unavailable";
    updatedAt: string;
    recentEarnings: TrainerRecentEarning[];
    analytics: TrainerEarningsAnalytics | null;
};

export type TrainerEarningsDashboardResult = {
    data: TrainerEarningsDashboard | null;
    error: string | null;
};
