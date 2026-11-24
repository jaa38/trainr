import { supabase } from '@/lib/supabase';

import { getPersonalWorkoutById } from '@/services/personal-workouts';

import type {
  CreateWorkoutExerciseInput,
  PersonalWorkoutDetails,
  UpdateWorkoutExerciseInput,
  WorkoutExercise,
  WorkoutExerciseWithSets,
  WorkoutSet,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const WORKOUT_EXERCISE_COLUMNS = `
  id,
  workout_id,
  exercise_id,
  personal_exercise_id,
  exercise_order,
  notes,
  created_at
`;

const WORKOUT_SET_COLUMNS = `
  id,
  workout_exercise_id,
  set_number,
  repetitions,
  weight,
  weight_unit,
  duration_seconds,
  distance,
  distance_unit,
  notes,
  created_at
`;

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Personal Workout Exercises] Unable to verify user:', error);

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user.id;
}

// =========================================================
// VALIDATION
// =========================================================

function validateId(value: string, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateExerciseOrder(value: number | undefined) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error('Exercise order must be a non-negative whole number.');
  }
}

function validateNotes(value: string | null | undefined) {
  if (value && value.trim().length > 1000) {
    throw new Error('Exercise notes must be 1,000 characters or fewer.');
  }
}

// =========================================================
// ERROR HANDLING
// =========================================================

function handleError(action: string, error: { message: string }): never {
  console.error(`[Personal Workout Exercises] Unable to ${action}:`, error);

  throw new Error(`Unable to ${action}. Please try again.`);
}

// =========================================================
// WORKOUT OWNERSHIP AND EDITABILITY
// =========================================================

/**
 * Verifies that a workout belongs to the authenticated user
 * and has not been completed.
 */
async function assertEditableWorkout(workoutId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    handleError('verify workout permissions', error);
  }

  if (!data) {
    throw new Error('Workout not found.');
  }

  if (data.status === 'completed') {
    throw new Error('Completed workouts cannot be modified.');
  }
}

/**
 * Retrieves an exercise entry belonging to the authenticated user.
 */
async function getOwnedWorkoutExercise(
  workoutExerciseId: string,
): Promise<WorkoutExercise> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(WORKOUT_EXERCISE_COLUMNS)
    .eq('id', workoutExerciseId)
    .maybeSingle();

  if (error) {
    handleError('retrieve workout exercise', error);
  }

  if (!data) {
    throw new Error('Workout exercise not found.');
  }

  return data as WorkoutExercise;
}

// =========================================================
// CREATE WORKOUT EXERCISE
// =========================================================

/**
 * Adds a shared or personal exercise to an editable workout.
 * Exactly one exercise reference must be provided.
 */
export async function createWorkoutExercise(
  input: CreateWorkoutExerciseInput,
): Promise<WorkoutExercise> {
  validateId(input.workout_id, 'Workout ID');

  const hasSharedExercise = Boolean(input.exercise_id);
  const hasPersonalExercise = Boolean(input.personal_exercise_id);

  if (hasSharedExercise === hasPersonalExercise) {
    throw new Error('Select exactly one shared or personal exercise.');
  }

  if (input.exercise_id) {
    validateId(input.exercise_id, 'Exercise ID');
  }

  if (input.personal_exercise_id) {
    validateId(input.personal_exercise_id, 'Personal exercise ID');
  }

  validateExerciseOrder(input.exercise_order);
  validateNotes(input.notes);

  const userId = await getAuthenticatedUserId();

  await assertEditableWorkout(input.workout_id, userId);

  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({
      workout_id: input.workout_id,
      exercise_id: input.exercise_id ?? null,
      personal_exercise_id: input.personal_exercise_id ?? null,
      exercise_order: input.exercise_order ?? 0,
      notes: input.notes?.trim() || null,
    })
    .select(WORKOUT_EXERCISE_COLUMNS)
    .single();

  if (error) {
    handleError('add exercise to workout', error);
  }

  if (!data) {
    throw new Error('The exercise was not added. Please try again.');
  }

  return data as WorkoutExercise;
}

// =========================================================
// UPDATE WORKOUT EXERCISE
// =========================================================

/**
 * Updates exercise ordering or notes.
 */
export async function updateWorkoutExercise(
  workoutExerciseId: string,
  input: UpdateWorkoutExerciseInput,
): Promise<WorkoutExercise> {
  validateId(workoutExerciseId, 'Workout exercise ID');

  validateExerciseOrder(input.exercise_order);
  validateNotes(input.notes);

  const payload: Record<string, unknown> = {};

  if (input.exercise_order !== undefined) {
    payload.exercise_order = input.exercise_order;
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Please provide at least one field to update.');
  }

  const userId = await getAuthenticatedUserId();

  const exercise = await getOwnedWorkoutExercise(workoutExerciseId);

  await assertEditableWorkout(exercise.workout_id, userId);

  const { data, error } = await supabase
    .from('workout_exercises')
    .update(payload)
    .eq('id', workoutExerciseId)
    .select(WORKOUT_EXERCISE_COLUMNS)
    .maybeSingle();

  if (error) {
    handleError('update workout exercise', error);
  }

  if (!data) {
    throw new Error('Workout exercise could not be updated.');
  }

  return data as WorkoutExercise;
}

// =========================================================
// DELETE WORKOUT EXERCISE
// =========================================================

/**
 * Removes an exercise from an editable workout.
 * Associated sets are deleted through the database cascade.
 */
export async function deleteWorkoutExercise(workoutExerciseId: string): Promise<void> {
  validateId(workoutExerciseId, 'Workout exercise ID');

  const userId = await getAuthenticatedUserId();

  const exercise = await getOwnedWorkoutExercise(workoutExerciseId);

  await assertEditableWorkout(exercise.workout_id, userId);

  const { data, error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('id', workoutExerciseId)
    .select('id')
    .maybeSingle();

  if (error) {
    handleError('remove workout exercise', error);
  }

  if (!data) {
    throw new Error('Workout exercise could not be removed.');
  }
}

// =========================================================
// RETRIEVE COMPLETE WORKOUT
// =========================================================

/**
 * Retrieves a workout with its exercises and associated sets.
 * Completed workouts remain available for viewing.
 */
export async function getPersonalWorkoutDetails(
  workoutId: string,
): Promise<PersonalWorkoutDetails> {
  validateId(workoutId, 'Workout ID');

  const workout = await getPersonalWorkoutById(workoutId);

  const { data: exerciseData, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select(WORKOUT_EXERCISE_COLUMNS)
    .eq('workout_id', workoutId)
    .order('exercise_order', { ascending: true });

  if (exerciseError) {
    handleError('load workout exercises', exerciseError);
  }

  const exercises = (exerciseData ?? []) as WorkoutExercise[];

  if (exercises.length === 0) {
    return {
      ...workout,
      exercises: [],
    };
  }

  const exerciseIds = exercises.map((exercise) => exercise.id);

  const { data: setData, error: setError } = await supabase
    .from('workout_sets')
    .select(WORKOUT_SET_COLUMNS)
    .in('workout_exercise_id', exerciseIds)
    .order('set_number', { ascending: true });

  if (setError) {
    handleError('load workout sets', setError);
  }

  const sets = (setData ?? []) as WorkoutSet[];

  const exercisesWithSets: WorkoutExerciseWithSets[] = exercises.map((exercise) => ({
    ...exercise,
    sets: sets.filter((set) => set.workout_exercise_id === exercise.id),
  }));

  return {
    ...workout,
    exercises: exercisesWithSets,
  };
}
