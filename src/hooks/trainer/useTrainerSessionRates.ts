import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TrainerSessionRateFormValues } from '@/schemas/trainer-session-rates';
import {
  createTrainerSessionRate,
  deleteTrainerSessionRate,
  getTrainerSessionRates,
  setTrainerSessionRateDefault,
  updateTrainerSessionRate,
} from '@/services/trainer-session-rates';

export const trainerSessionRateKeys = {
  all: ['trainer-session-rates'] as const,

  list: (trainerId: string) =>
    [...trainerSessionRateKeys.all, 'list', trainerId] as const,
};

export function useTrainerSessionRates(trainerId: string | undefined) {
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: trainerSessionRateKeys.list(trainerId ?? ''),
    queryFn: () => {
      if (!trainerId) {
        throw new Error('A trainer account is required to load session rates.');
      }

      return getTrainerSessionRates(trainerId);
    },
    enabled: Boolean(trainerId),
  });

  const invalidateRates = () =>
    queryClient.invalidateQueries({
      queryKey: trainerSessionRateKeys.list(trainerId ?? ''),
    });

  const createMutation = useMutation({
    mutationFn: (values: TrainerSessionRateFormValues) => {
      if (!trainerId) {
        throw new Error('Your trainer session has expired. Please sign in again.');
      }

      return createTrainerSessionRate(trainerId, values);
    },
    onSuccess: invalidateRates,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      rateId,
      values,
    }: {
      rateId: string;
      values: TrainerSessionRateFormValues;
    }) => {
      if (!trainerId) {
        throw new Error('Your trainer session has expired. Please sign in again.');
      }

      return updateTrainerSessionRate(trainerId, rateId, values);
    },
    onSuccess: invalidateRates,
  });

  const deleteMutation = useMutation({
    mutationFn: (rateId: string) => {
      if (!trainerId) {
        throw new Error('Your trainer session has expired. Please sign in again.');
      }

      return deleteTrainerSessionRate(trainerId, rateId);
    },
    onSuccess: invalidateRates,
  });

  const defaultMutation = useMutation({
    mutationFn: (rateId: string) => {
      if (!trainerId) {
        throw new Error('Your trainer session has expired. Please sign in again.');
      }

      return setTrainerSessionRateDefault(trainerId, rateId);
    },
    onSuccess: invalidateRates,
  });

  return {
    ratesQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    defaultMutation,
  };
}
