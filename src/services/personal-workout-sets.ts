import { supabase } from '@/lib/supabase';

import type {
  CreateWorkoutSetInput,
  DistanceUnit,
  UpdateWorkoutSetInput,
  WeightUnit,
  WorkoutSet,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

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

type OwnedWorkoutExercise = {
  id: string;
  workout_id: string;
};

type SetMeasurements = {
  set_number: number;
  repetitions?: number | null;
  weight?: number | null;
  weight_unit?: WeightUnit | null;
  duration_seconds?: number | null;
  distance?: number | null;
  distance_unit?: DistanceUnit | null;
  notes?: string | null;
};

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Personal Workout Sets] Unable to verify user:', error);

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

function validateId(value: string, field: string): void {
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateSetNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Set number must be a positive whole number.');
  }
}

function validateNonNegativeInteger(
  value: number | null | undefined,
  field: string,
): void {
  if (value != null && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${field} must be a non-negative whole number.`);
  }
}

function validateNonNegativeNumber(
  value: number | null | undefined,
  field: string,
): void {
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${field} must be a non-negative number.`);
  }
}

function validateNotes(value: string | null | undefined): void {
  if (value != null && value.trim().length > 1000) {
    throw new Error('Set notes must be 1,000 characters or fewer.');
  }
}

/**
 * Validates the complete merged set measurements.
 * This is important for partial updates because existing values
 * must be considered when validating measurement units.
 */
function validateSetMeasurements(input: SetMeasurements): void {
  validateSetNumber(input.set_number);

  validateNonNegativeInteger(input.repetitions, 'Repetitions');
  validateNonNegativeInteger(input.duration_seconds, 'Duration');

  validateNonNegativeNumber(input.weight, 'Weight');
  validateNonNegativeNumber(input.distance, 'Distance');

  if (input.weight == null && input.weight_unit != null) {
    throw new Error('Weight unit must be empty when weight is not provided.');
  }

  if (input.weight != null && input.weight_unit !== 'kg' && input.weight_unit !== 'lb') {
    throw new Error('Weight unit must be kg or lb when weight is provided.');
  }

  if (input.distance == null && input.distance_unit != null) {
    throw new Error('Distance unit must be empty when distance is not provided.');
  }

  if (
    input.distance != null &&
    input.distance_unit !== 'km' &&
    input.distance_unit !== 'mi'
  ) {
    throw new Error('Distance unit must be km or mi when distance is provided.');
  }

  validateNotes(input.notes);
}

// =========================================================
// ERROR HANDLING
// =========================================================

function handleError(action: string, error: { message: string; code?: string }): never {
  if (error.code === '23505') {
    throw new Error('A set with this number already exists for this exercise.');
  }

  console.error(`[Personal Workout Sets] Unable to ${action}:`, error);

  throw new Error(`Unable to ${action}. Please try again.`);
}

// =========================================================
// OWNERSHIP AND EDITABILITY
// =========================================================

async function getOwnedWorkoutExercise(
  workoutExerciseId: string,
): Promise<OwnedWorkoutExercise> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('id, workout_id')
    .eq('id', workoutExerciseId)
    .maybeSingle();

  if (error) {
    handleError('retrieve workout exercise', error);
  }

  if (!data) {
    throw new Error('Workout exercise not found.');
  }

  return data as OwnedWorkoutExercise;
}

async function getOwnedWorkoutSet(setId: string): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select(WORKOUT_SET_COLUMNS)
    .eq('id', setId)
    .maybeSingle();

  if (error) {
    handleError('retrieve workout set', error);
  }

  if (!data) {
    throw new Error('Workout set not found.');
  }

  return data as WorkoutSet;
}

/**
 * Confirms that the workout belongs to the authenticated user
 * and is not completed.
 *
 * RLS independently enforces ownership at database level.
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

async function assertEditableWorkoutExercise(
  workoutExerciseId: string,
  userId: string,
): Promise<OwnedWorkoutExercise> {
  const exercise = await getOwnedWorkoutExercise(workoutExerciseId);

  await assertEditableWorkout(exercise.workout_id, userId);

  return exercise;
}

async function assertEditableSet(setId: string, userId: string): Promise<WorkoutSet> {
  const set = await getOwnedWorkoutSet(setId);

  await assertEditableWorkoutExercise(set.workout_exercise_id, userId);

  return set;
}

// =========================================================
// CREATE WORKOUT SET
// =========================================================

/**
 * Adds a set to an exercise in an editable personal workout.
 */
export async function createWorkoutSet(
  input: CreateWorkoutSetInput,
): Promise<WorkoutSet> {
  validateId(input.workout_exercise_id, 'Workout exercise ID');

  validateSetMeasurements({
    set_number: input.set_number,
    repetitions: input.repetitions,
    weight: input.weight,
    weight_unit: input.weight_unit,
    duration_seconds: input.duration_seconds,
    distance: input.distance,
    distance_unit: input.distance_unit,
    notes: input.notes,
  });

  const userId = await getAuthenticatedUserId();

  await assertEditableWorkoutExercise(input.workout_exercise_id, userId);

  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      workout_exercise_id: input.workout_exercise_id,
      set_number: input.set_number,
      repetitions: input.repetitions ?? null,
      weight: input.weight ?? null,
      weight_unit: input.weight_unit ?? null,
      duration_seconds: input.duration_seconds ?? null,
      distance: input.distance ?? null,
      distance_unit: input.distance_unit ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(WORKOUT_SET_COLUMNS)
    .single();

  if (error) {
    handleError('create workout set', error);
  }

  if (!data) {
    throw new Error('The workout set could not be created.');
  }

  return data as WorkoutSet;
}

// =========================================================
// UPDATE WORKOUT SET
// =========================================================

/**
 * Updates a workout set.
 * Existing values are merged with the supplied fields before validation.
 */
export async function updateWorkoutSet(
  setId: string,
  input: UpdateWorkoutSetInput,
): Promise<WorkoutSet> {
  validateId(setId, 'Workout set ID');

  const payload: Record<string, unknown> = {};

  const fields: (keyof UpdateWorkoutSetInput)[] = [
    'set_number',
    'repetitions',
    'weight',
    'weight_unit',
    'duration_seconds',
    'distance',
    'distance_unit',
    'notes',
  ];

  for (const field of fields) {
    if (input[field] !== undefined) {
      payload[field] = input[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Please provide at least one field to update.');
  }

  const userId = await getAuthenticatedUserId();

  const existingSet = await assertEditableSet(setId, userId);

  const mergedSet: SetMeasurements = {
    set_number: input.set_number ?? existingSet.set_number,
    repetitions:
      input.repetitions !== undefined ? input.repetitions : existingSet.repetitions,
    weight: input.weight !== undefined ? input.weight : existingSet.weight,
    weight_unit:
      input.weight === null && input.weight_unit === undefined
        ? null
        : input.weight_unit !== undefined
          ? input.weight_unit
          : existingSet.weight_unit,
    duration_seconds:
      input.duration_seconds !== undefined
        ? input.duration_seconds
        : existingSet.duration_seconds,
    distance: input.distance !== undefined ? input.distance : existingSet.distance,
    distance_unit:
      input.distance === null && input.distance_unit === undefined
        ? null
        : input.distance_unit !== undefined
          ? input.distance_unit
          : existingSet.distance_unit,
    notes: input.notes !== undefined ? input.notes : existingSet.notes,
  };

  validateSetMeasurements(mergedSet);

  if (input.notes !== undefined) {
    payload.notes = input.notes?.trim() || null;
  }

  if (input.weight === null && input.weight_unit === undefined) {
    payload.weight_unit = null;
  }

  if (input.distance === null && input.distance_unit === undefined) {
    payload.distance_unit = null;
  }

  const { data, error } = await supabase
    .from('workout_sets')
    .update(payload)
    .eq('id', setId)
    .select(WORKOUT_SET_COLUMNS)
    .maybeSingle();

  if (error) {
    handleError('update workout set', error);
  }

  if (!data) {
    throw new Error('Workout set could not be updated.');
  }

  return data as WorkoutSet;
}

// =========================================================
// DELETE WORKOUT SET
// =========================================================

/**
 * Deletes a set from an editable personal workout.
 */
export async function deleteWorkoutSet(setId: string): Promise<void> {
  validateId(setId, 'Workout set ID');

  const userId = await getAuthenticatedUserId();

  await assertEditableSet(setId, userId);

  const { data, error } = await supabase
    .from('workout_sets')
    .delete()
    .eq('id', setId)
    .select('id')
    .maybeSingle();

  if (error) {
    handleError('delete workout set', error);
  }

  if (!data) {
    throw new Error('Workout set could not be deleted.');
  }
}
