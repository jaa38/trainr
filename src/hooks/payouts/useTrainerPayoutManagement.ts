
import { useQuery } from "@tanstack/react-query";

import { getTrainerPayoutManagement } from "@/services/payouts/payouts.service";

export const trainerPayoutManagementKeys = {
    all: ["trainer-payout-management"] as const,
    management: () => [...trainerPayoutManagementKeys.all, "management"] as const,
};

export const TRAINER_PAYOUT_MANAGEMENT_QUERY_ENABLED = true;

export function useTrainerPayoutManagement() {
    return useQuery({
        queryKey: trainerPayoutManagementKeys.management(),
        queryFn: () => getTrainerPayoutManagement(),
        staleTime: 30_000,
        retry: 1,
        refetchOnReconnect: true,
        enabled: TRAINER_PAYOUT_MANAGEMENT_QUERY_ENABLED,
    });
}
