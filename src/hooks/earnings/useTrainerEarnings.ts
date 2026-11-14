import { useQuery } from "@tanstack/react-query";

import { getTrainerEarningsDashboard } from "@/services/earnings/earnings.service";

export const trainerEarningsKeys = {
    all: ["trainer-earnings"] as const,

    dashboard: () => [...trainerEarningsKeys.all, "dashboard"] as const,
};

// Keep false until the production Edge Function is deployed
// and its authenticated response has been verified.
export const TRAINER_EARNINGS_QUERY_ENABLED = true;

export function useTrainerEarnings() {
    return useQuery({
        queryKey: trainerEarningsKeys.dashboard(),
        queryFn: getTrainerEarningsDashboard,
        staleTime: 30_000,
        retry: 1,
        refetchOnReconnect: true,
        enabled: TRAINER_EARNINGS_QUERY_ENABLED,
    });
}
