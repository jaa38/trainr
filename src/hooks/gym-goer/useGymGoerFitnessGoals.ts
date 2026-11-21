import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GymGoerFitnessGoalsFormValues } from '@/schemas/gym-goer-fitness-goals';
import {
  getGymGoerFitnessGoals,
  saveGymGoerFitnessGoals,
} from '@/services/gym-goer-fitness-goals';

export const gymGoerFitnessGoalsKeys = {
  all: ['gym-goer-fitness-goals'] as const,

  detail: (userId: string) => [...gymGoerFitnessGoalsKeys.all, 'detail', userId] as const,
};

export function useGymGoerFitnessGoals(userId: string | undefined) {
  const queryClient = useQueryClient();

  const fitnessGoalsQuery = useQuery({
    queryKey: gymGoerFitnessGoalsKeys.detail(userId ?? ''),
    queryFn: () => {
      if (!userId) {
        throw new Error('A gym-goer account is required to load fitness goals.');
      }

      return getGymGoerFitnessGoals(userId);
    },
    enabled: Boolean(userId),
  });

  const saveMutation = useMutation({
    mutationFn: (values: GymGoerFitnessGoalsFormValues) => {
      if (!userId) {
        throw new Error('Your gym-goer session has expired. Please sign in again.');
      }

      return saveGymGoerFitnessGoals(userId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: gymGoerFitnessGoalsKeys.detail(userId ?? ''),
      });

      // Existing discovery recommendations use this saved-goals table.
      await queryClient.invalidateQueries({
        queryKey: ['gym-goer-discovery'],
      });
    },
  });

  return {
    fitnessGoalsQuery,
    saveMutation,
  };
}
