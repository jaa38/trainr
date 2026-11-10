
import { supabase } from '@/lib/supabase';

export type WorkoutPlanStatus = 'draft' | 'published' | 'archived';

export type WorkoutPlanExercise = {
  id: string;
  workout_plan_id: string;
  exercise_id: string;
  day_number: number;
  day_name: string | null;
  exercise_order: number;
  sets: number;
  repetitions: string;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercise?: {
    id: string;
    name: string;
    muscle_group: string | null;
    category: string | null;
    equipment: string[];
  } | null;
};

export type WorkoutPlan = {
  id: string;
  trainer_id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  duration_weeks: number | null;
  status: WorkoutPlanStatus;
  version: number;
  published_snapshot: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  workout_plan_exercises?: WorkoutPlanExercise[];
};

export type WorkoutPlanInput = {
  name: string;
  description?: string | null;
  objectives?: string | null;
  duration_weeks?: number | null;
};

export type WorkoutPlanExerciseInput = {
  exercise_id: string;
  day_number: number;
  day_name?: string | null;
  exercise_order: number;
  sets: number;
  repetitions: string;
  rest_seconds?: number | null;
  notes?: string | null;
};

export type PublishUpdateMode = 'none' | 'selected' | 'all_active';

const WORKOUT_PLAN_COLUMNS = `
  id,
  trainer_id,
  name,
  description,
  objectives,
  duration_weeks,
  status,
  version,
  published_snapshot,
  published_at,
  created_at,
  updated_at,
  workout_plan_exercises (
    id,
    workout_plan_id,
    exercise_id,
    day_number,
    day_name,
    exercise_order,
    sets,
    repetitions,
    rest_seconds,
    notes,
    created_at,
    updated_at,
    exercise:exercises (
      id,
      name,
      muscle_group,
      category,
      equipment
    )
  )
`;

function normalisePlanInput(input: WorkoutPlanInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error('Workout plan name is required.');
  }

  if (
    input.duration_weeks !== undefined &&
    input.duration_weeks !== null &&
    (!Number.isInteger(input.duration_weeks) || input.duration_weeks < 1)
  ) {
    throw new Error('Duration must be a positive whole number of weeks.');
  }

  return {
    name,
    description: input.description?.trim() || null,
    objectives: input.objectives?.trim() || null,
    duration_weeks: input.duration_weeks ?? null,
  };
}

function validateExerciseInput(input: WorkoutPlanExerciseInput) {
  if (!input.exercise_id) {
    throw new Error('An exercise is required.');
  }

  if (!Number.isInteger(input.day_number) || input.day_number < 1) {
    throw new Error('Day number must be at least 1.');
  }

  if (!Number.isInteger(input.exercise_order) || input.exercise_order < 1) {
    throw new Error('Exercise order must be at least 1.');
  }

  if (!Number.isInteger(input.sets) || input.sets < 1) {
    throw new Error('Sets must be at least 1.');
  }

  const repetitions = input.repetitions.trim();

  if (!repetitions) {
    throw new Error('Repetitions are required.');
  }

  if (
    input.rest_seconds !== undefined &&
    input.rest_seconds !== null &&
    (!Number.isInteger(input.rest_seconds) || input.rest_seconds < 0)
  ) {
    throw new Error('Rest time must be zero or greater.');
  }

  return {
    ...input,
    repetitions,
    day_name: input.day_name?.trim() || null,
    rest_seconds: input.rest_seconds ?? null,
    notes: input.notes?.trim() || null,
  };
}

/**
 * Retrieves workout plans visible to the signed-in trainer,
 * including their exercises.
 */
export async function getWorkoutPlans(): Promise<WorkoutPlan[]> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select(WORKOUT_PLAN_COLUMNS)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Workout Plans] Unable to load plans:', error);
    throw new Error(`Unable to load workout plans: ${error.message}`);
  }

  return (data ?? []) as unknown as WorkoutPlan[];
}

/**
 * Retrieves published workout programmes available for assignment.
 */
export async function getPublishedWorkoutPlans(): Promise<WorkoutPlan[]> {
  const plans = await getWorkoutPlans();

  return plans.filter(
    (plan) =>
      plan.status === 'published' &&
      plan.version > 0 &&
      plan.published_snapshot !== null,
  );
}

/**
 * Retrieves one workout plan and its exercises.
 */
export async function getWorkoutPlan(
  workoutPlanId: string,
): Promise<WorkoutPlan> {
  if (!workoutPlanId) {
    throw new Error('A workout plan ID is required.');
  }

  const { data, error } = await supabase
    .from('workout_plans')
    .select(WORKOUT_PLAN_COLUMNS)
    .eq('id', workoutPlanId)
    .single();

  if (error) {
    console.error('[Workout Plans] Unable to load plan:', error);
    throw new Error(`Unable to load workout plan: ${error.message}`);
  }

  return data as unknown as WorkoutPlan;
}

/**
 * Creates a draft workout plan through the authorised RPC.
 */
export async function createWorkoutPlan(
  input: WorkoutPlanInput,
): Promise<WorkoutPlan> {
  const plan = normalisePlanInput(input);

  const { data, error } = await supabase.rpc('create_workout_plan', {
    p_name: plan.name,
    p_description: plan.description,
    p_objectives: plan.objectives,
    p_duration_weeks: plan.duration_weeks,
  });

  if (error) {
    console.error('[Workout Plans] Unable to create plan:', error);
    throw new Error(`Unable to create workout plan: ${error.message}`);
  }

  return data as WorkoutPlan;
}

/**
 * Starts a new draft revision of an existing workout plan.
 */
export async function startWorkoutPlanRevision(
  workoutPlanId: string,
): Promise<WorkoutPlan> {
  if (!workoutPlanId) {
    throw new Error('A workout plan ID is required.');
  }

  const { data, error } = await supabase.rpc(
    'start_workout_plan_revision',
    {
      p_workout_plan_id: workoutPlanId,
    },
  );

  if (error) {
    console.error('[Workout Plans] Unable to start revision:', error);
    throw new Error(`Unable to start workout plan revision: ${error.message}`);
  }

  return data as WorkoutPlan;
}

/**
 * Updates a draft workout plan through the authorised RPC.
 */
export async function updateWorkoutPlan(
  workoutPlanId: string,
  input: WorkoutPlanInput,
): Promise<WorkoutPlan> {
  if (!workoutPlanId) {
    throw new Error('A workout plan ID is required.');
  }

  const plan = normalisePlanInput(input);

  const { data, error } = await supabase.rpc('update_workout_plan', {
    p_workout_plan_id: workoutPlanId,
    p_name: plan.name,
    p_description: plan.description,
    p_objectives: plan.objectives,
    p_duration_weeks: plan.duration_weeks,
  });

  if (error) {
    console.error('[Workout Plans] Unable to update plan:', error);
    throw new Error(`Unable to update workout plan: ${error.message}`);
  }

  return data as WorkoutPlan;
}

/**
 * Adds an exercise to a draft workout plan.
 */
export async function addWorkoutPlanExercise(
  workoutPlanId: string,
  input: WorkoutPlanExerciseInput,
): Promise<WorkoutPlanExercise> {
  if (!workoutPlanId) {
    throw new Error('A workout plan ID is required.');
  }

  const exercise = validateExerciseInput(input);

  const { data, error } = await supabase.rpc(
    'add_workout_plan_exercise',
    {
      p_workout_plan_id: workoutPlanId,
      p_exercise_id: exercise.exercise_id,
      p_day_number: exercise.day_number,
      p_day_name: exercise.day_name,
      p_exercise_order: exercise.exercise_order,
      p_sets: exercise.sets,
      p_repetitions: exercise.repetitions,
      p_rest_seconds: exercise.rest_seconds,
      p_notes: exercise.notes,
    },
  );

  if (error) {
    console.error('[Workout Plans] Unable to add exercise:', error);
    throw new Error(`Unable to add exercise: ${error.message}`);
  }

  return data as WorkoutPlanExercise;
}

/**
 * Updates an exercise entry within a draft workout plan.
 */
export async function updateWorkoutPlanExercise(
  planExerciseId: string,
  input: Omit<WorkoutPlanExerciseInput, 'exercise_id'>,
): Promise<WorkoutPlanExercise> {
  if (!planExerciseId) {
    throw new Error('A plan exercise ID is required.');
  }

  const exercise = validateExerciseInput({
    ...input,
    exercise_id: 'existing-exercise',
  });

  const { data, error } = await supabase.rpc(
    'update_workout_plan_exercise',
    {
      p_plan_exercise_id: planExerciseId,
      p_day_number: exercise.day_number,
      p_day_name: exercise.day_name,
      p_exercise_order: exercise.exercise_order,
      p_sets: exercise.sets,
      p_repetitions: exercise.repetitions,
      p_rest_seconds: exercise.rest_seconds,
      p_notes: exercise.notes,
    },
  );

  if (error) {
    console.error('[Workout Plans] Unable to update exercise:', error);
    throw new Error(`Unable to update exercise: ${error.message}`);
  }

  return data as WorkoutPlanExercise;
}

/**
 * Removes an exercise entry from a draft workout plan.
 */
export async function removeWorkoutPlanExercise(
  planExerciseId: string,
): Promise<void> {
  if (!planExerciseId) {
    throw new Error('A plan exercise ID is required.');
  }

  const { error } = await supabase.rpc(
    'remove_workout_plan_exercise',
    {
      p_plan_exercise_id: planExerciseId,
    },
  );

  if (error) {
    console.error('[Workout Plans] Unable to remove exercise:', error);
    throw new Error(`Unable to remove exercise: ${error.message}`);
  }
}

/**
 * Publishes a workout plan and optionally updates existing assignments.
 */
export async function publishWorkoutPlan(
  workoutPlanId: string,
  updateMode: PublishUpdateMode = 'none',
  assignmentIds: string[] = [],
): Promise<WorkoutPlan> {
  if (!workoutPlanId) {
    throw new Error('A workout plan ID is required.');
  }

  if (updateMode === 'selected' && assignmentIds.length === 0) {
    throw new Error('Select at least one assignment to update.');
  }

  if (updateMode !== 'selected' && assignmentIds.length > 0) {
    throw new Error(
      'Assignment IDs can only be supplied when using selected update mode.',
    );
  }

  const { data, error } = await supabase.rpc('publish_workout_plan', {
    p_workout_plan_id: workoutPlanId,
    p_update_mode: updateMode,
    p_assignment_ids: assignmentIds,
  });

  if (error) {
    console.error('[Workout Plans] Unable to publish plan:', error);
    throw new Error(`Unable to publish workout plan: ${error.message}`);
  }

  return data as WorkoutPlan;
}
