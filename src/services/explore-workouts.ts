import { supabase } from '@/lib/supabase';

export type ExploreWorkoutExercise = {
  id: string;
  exercise_id: string;
  day_number: number;
  day_name: string | null;
  exercise_order: number;
  sets: number;
  repetitions: string;
  rest_seconds: number | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    muscle_group: string | null;
    category: string | null;
    equipment: string[] | null;
    instructions: string | null;
    image_url: string | null;
    video_url: string | null;
  };
};

export type ExploreWorkoutPlan = {
  id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  duration_weeks: number | null;
  version: number;
  published_at: string | null;
  exercises: ExploreWorkoutExercise[];
};

/**
 * Retrieves published workout programmes available to gym-goers.
 *
 * The database RPC validates the authenticated user's gym-goer role
 * and returns published snapshots only.
 */
export async function getExploreWorkoutPlans(): Promise<
  ExploreWorkoutPlan[]
> {
  const { data, error } = await supabase.rpc(
    'get_explore_workout_plans',
  );

  if (error) {
    console.error(
      '[Explore Workouts] Unable to load published programmes:',
      error,
    );

    throw new Error(
      `Unable to load Explore Workouts: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as ExploreWorkoutPlan[];
}