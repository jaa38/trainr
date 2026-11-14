import { useQuery } from "@tanstack/react-query";

import { getTrainerEarningsDashboard } from "@/services/earnings/earnings.service";
import type { EarningsPeriod } from "@/types/earnings";

export const trainerEarningsKeys = {
    all: ["trainer-earnings"] as const,
    dashboard: (period: EarningsPeriod) =>
        [...trainerEarningsKeys.all, "dashboard", period] as const,
};

export const TRAINER_EARNINGS_QUERY_ENABLED = true;

export function useTrainerEarnings(
    period: EarningsPeriod = "this_month",
) {
    return useQuery({
        queryKey: trainerEarningsKeys.dashboard(period),
        queryFn: () => getTrainerEarningsDashboard(period),
        staleTime: 30_000,
        retry: 1,
        refetchOnReconnect: true,
        enabled: TRAINER_EARNINGS_QUERY_ENABLED,
    });
}
