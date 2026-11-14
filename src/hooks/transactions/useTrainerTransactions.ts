import { getTrainerTransactionHistory } from '@/services/transactions/transactions.service';
import type { TrainerTransactionHistoryParams } from '@/types/transactions';
import { useQuery } from '@tanstack/react-query';

type UseTrainerTransactionsOptions = {
  enabled?: boolean;
};

export const trainerTransactionKeys = {
  all: ['trainer-transactions'] as const,

  history: (params: TrainerTransactionHistoryParams = {}) =>
    [
      ...trainerTransactionKeys.all,
      'history',
      params.page ?? 1,
      params.pageSize ?? 20,
      params.status ?? 'all',
    ] as const,
};

export function useTrainerTransactions(
  params: TrainerTransactionHistoryParams = {},
  options: UseTrainerTransactionsOptions = {},
) {
  return useQuery({
    queryKey: trainerTransactionKeys.history(params),

    queryFn: async () => {
      const result = await getTrainerTransactionHistory(params);

      if (result.error || !result.data) {
        throw new Error(result.error ?? 'Unable to retrieve transaction history.');
      }

      return result.data;
    },

    enabled: options.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
    refetchOnReconnect: true,
  });
}
