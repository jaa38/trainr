export const FITNESS_GOAL_SPECIALTIES = {
  build_muscle: ['Muscle building', 'Strength training'],
  lose_weight: ['Weight loss', 'General fitness'],
  improve_fitness: ['General fitness', 'Functional training'],
  increase_strength: ['Strength training', 'Muscle building'],
  improve_endurance: ['Sports performance', 'Functional training'],
  improve_health: ['General fitness', 'Mobility and flexibility'],
  sports_performance: ['Sports performance', 'Functional training'],
} as const;

export type FitnessGoalId = keyof typeof FITNESS_GOAL_SPECIALTIES;

export function getSpecialtiesForFitnessGoals(goals: readonly string[]): string[] {
  const specialties = goals.flatMap((goal) => {
    if (goal in FITNESS_GOAL_SPECIALTIES) {
      return FITNESS_GOAL_SPECIALTIES[goal as FitnessGoalId];
    }

    return [];
  });

  return [...new Set(specialties)];
}
