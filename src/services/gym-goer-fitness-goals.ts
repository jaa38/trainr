import { supabase } from '@/lib/supabase';

import type {
  GymGoerExperienceLevel,
  GymGoerFitnessGoal,
  GymGoerFitnessGoalsFormValues,
  GymGoerPrimaryGoal,
  GymGoerTrainingFormat,
  GymGoerTrainingPreference,
} from '@/schemas/gym-goer-fitness-goals';

const PROFILE_TABLE = 'gym_goer_profiles';
const GOALS_TABLE = 'gym_goer_fitness_goals';

export type GymGoerFitnessGoalsProfile = {
  primary_goal: GymGoerPrimaryGoal | null;
  experience_level: GymGoerExperienceLevel | null;
  training_preferences: GymGoerTrainingPreference[];
  training_format: GymGoerTrainingFormat | null;
  training_frequency: number | null;
  location: string | null;
};

export type GymGoerFitnessGoalsData = {
  profile: GymGoerFitnessGoalsProfile | null;
  goals: GymGoerFitnessGoal[];
};

const DEFAULT_PROFILE: GymGoerFitnessGoalsProfile = {
  primary_goal: null,
  experience_level: null,
  training_preferences: [],
  training_format: null,
  training_frequency: null,
  location: null,
};

/**
 * Retrieve the authenticated gym-goer's fitness profile and saved goals.
 */
export async function getGymGoerFitnessGoals(
  userId: string,
): Promise<GymGoerFitnessGoalsData> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!authData.user || authData.user.id !== userId) {
    throw new Error('You can only access your own fitness preferences.');
  }

  const [profileResult, goalsResult] = await Promise.all([
    supabase
      .from(PROFILE_TABLE)
      .select(
        'primary_goal, experience_level, training_preferences, training_format, training_frequency, location',
      )
      .eq('user_id', userId)
      .maybeSingle(),

    supabase.from(GOALS_TABLE).select('goal').eq('user_id', userId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (goalsResult.error) throw goalsResult.error;

  const profile = profileResult.data as GymGoerFitnessGoalsProfile | null;

  const goals = (goalsResult.data ?? []).map((item) => item.goal as GymGoerFitnessGoal);

  return {
    profile: profile
      ? {
          ...DEFAULT_PROFILE,
          ...profile,
          training_preferences: profile.training_preferences ?? [],
        }
      : null,
    goals,
  };
}

/**
 * Save the gym-goer's fitness profile and goal selections.
 *
 * The primary goal is always included in gym_goer_fitness_goals
 * so existing trainer discovery and recommendation queries continue
 * to work without modification.
 */
export async function saveGymGoerFitnessGoals(
  userId: string,
  values: GymGoerFitnessGoalsFormValues,
): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!authData.user || authData.user.id !== userId) {
    throw new Error('You can only update your own fitness preferences.');
  }

  const selectedGoals = [
    ...new Set([values.primaryGoal, ...values.additionalGoals]),
  ] as GymGoerFitnessGoal[];

  const { data: existingGoalRows, error: existingGoalsError } = await supabase
    .from(GOALS_TABLE)
    .select('goal')
    .eq('user_id', userId);

  if (existingGoalsError) throw existingGoalsError;

  const existingGoals = (existingGoalRows ?? []).map(
    (item) => item.goal as GymGoerFitnessGoal,
  );

  const goalsToInsert = selectedGoals.filter((goal) => !existingGoals.includes(goal));

  const goalsToDelete = existingGoals.filter((goal) => !selectedGoals.includes(goal));

  const { error: profileError } = await supabase.from(PROFILE_TABLE).upsert(
    {
      user_id: userId,
      primary_goal: values.primaryGoal,
      experience_level: values.experienceLevel,
      training_preferences: values.trainingPreferences,
      training_format: values.trainingFormat,
      training_frequency: values.trainingFrequency,
      location: values.location.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (profileError) throw profileError;

  // Insert new goals before deleting old ones to avoid losing
  // existing selections if an insert fails.
  if (goalsToInsert.length > 0) {
    const { error: insertError } = await supabase.from(GOALS_TABLE).insert(
      goalsToInsert.map((goal) => ({
        user_id: userId,
        goal,
      })),
    );

    if (insertError) throw insertError;
  }

  if (goalsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from(GOALS_TABLE)
      .delete()
      .eq('user_id', userId)
      .in('goal', goalsToDelete);

    if (deleteError) throw deleteError;
  }
}
