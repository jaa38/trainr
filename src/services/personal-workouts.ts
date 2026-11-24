import { supabase } from '@/lib/supabase';

import type {
  CompletePersonalWorkoutInput,
  CreatePersonalWorkoutInput,
  PersonalWorkout,
  PersonalWorkoutStatus,
  UpdatePersonalWorkoutInput,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const PERSONAL_WORKOUT_COLUMNS = `
  id,
  user_id,
  workout_name,
  workout_type,
  workout_date,
  started_at,
  completed_at,
  duration_seconds,
  notes,
  status,
  created_at,
  updated_at
`;

const VALID_STATUSES: PersonalWorkoutStatus[] = ['draft', 'in_progress', 'completed'];

// =========================================================
// VALIDATION
// =========================================================

function validateId(value: string, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateWorkoutName(value: string) {
  if (!value?.trim()) {
    throw new Error('Please provide a workout name.');
  }

  if (value.trim().length > 120) {
    throw new Error('Workout name must be 120 characters or fewer.');
  }
}

function validateWorkoutType(value: string) {
  const validTypes = [
    'strength',
    'cardio',
    'bodyweight',
    'flexibility',
    'functional',
    'custom',
  ];

  if (!validTypes.includes(value)) {
    throw new Error('Please select a valid workout category.');
  }
}

function validateStatus(value: string) {
  if (!VALID_STATUSES.includes(value as PersonalWorkoutStatus)) {
    throw new Error('Please select a valid workout status.');
  }
}

function validateDate(value: string, field: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`Please provide a valid ${field}.`);
  }
}

function validateDuration(value: number | null | undefined) {
  if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new Error('Workout duration must be a non-negative whole number.');
  }
}

function validateNotes(value: string | null | undefined) {
  if (value && value.trim().length > 1000) {
    throw new Error('Workout notes must be 1,000 characters or fewer.');
  }
}

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Personal Workouts] Unable to verify user:', error);

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

// =========================================================
// CREATE
// =========================================================

/**
 * Creates a personal workout for the authenticated user.
 * Completed workouts must be completed through completePersonalWorkout.
 */
export async function createPersonalWorkout(
  input: CreatePersonalWorkoutInput,
): Promise<PersonalWorkout> {
  validateWorkoutName(input.workout_name);
  validateWorkoutType(input.workout_type);

  if (input.status !== undefined) {
    validateStatus(input.status);
  }

  if (input.workout_date) {
    validateDate(input.workout_date, 'workout date');
  }

  validateNotes(input.notes);

  const user = await getAuthenticatedUser();

  const status = input.status ?? 'draft';

  const startedAt =
    status === 'in_progress'
      ? (input.started_at ?? new Date().toISOString())
      : (input.started_at ?? null);

  if (startedAt) {
    validateDate(startedAt, 'workout start time');
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: user.id,
      workout_name: input.workout_name.trim(),
      workout_type: input.workout_type,
      workout_date: input.workout_date,
      started_at: startedAt,
      notes: input.notes?.trim() || null,
      status,
    })
    .select(PERSONAL_WORKOUT_COLUMNS)
    .single();

  if (error) {
    console.error('[Personal Workouts] Unable to create workout:', error);

    throw new Error('Unable to create your workout. Please try again.');
  }

  return data as unknown as PersonalWorkout;
}

// =========================================================
// RETRIEVE HISTORY
// =========================================================

export type PersonalWorkoutHistoryOptions = {
  limit?: number;
  offset?: number;
  status?: PersonalWorkoutStatus;
};

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

/**
 * Retrieves the authenticated user's personal workout history.
 * Results are ordered newest first.
 */
export async function getPersonalWorkoutHistory(
  options: PersonalWorkoutHistoryOptions = {},
): Promise<PersonalWorkout[]> {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  const offset = options.offset ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new Error(`History limit must be between 1 and ${MAX_HISTORY_LIMIT}.`);
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('History offset must be a non-negative whole number.');
  }

  if (options.status) {
    validateStatus(options.status);
  }

  const user = await getAuthenticatedUser();

  let query = supabase
    .from('workouts')
    .select(PERSONAL_WORKOUT_COLUMNS)
    .eq('user_id', user.id);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Personal Workouts] Unable to load workout history:', error);

    throw new Error('Unable to load your workout history. Please try again.');
  }

  return (data ?? []) as unknown as PersonalWorkout[];
}

// =========================================================
// RETRIEVE SINGLE WORKOUT
// =========================================================

/**
 * Retrieves one personal workout belonging to the authenticated user.
 */
export async function getPersonalWorkoutById(
  workoutId: string,
): Promise<PersonalWorkout> {
  validateId(workoutId, 'Workout ID');

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('workouts')
    .select(PERSONAL_WORKOUT_COLUMNS)
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Personal Workouts] Unable to retrieve workout:', error);

    throw new Error('Unable to load this workout. Please try again.');
  }

  if (!data) {
    throw new Error('Workout not found.');
  }

  return data as unknown as PersonalWorkout;
}

// =========================================================
// UPDATE
// =========================================================

/**
 * Updates an existing personal workout.
 * Completion status is managed separately.
 */
export async function updatePersonalWorkout(
  workoutId: string,
  input: UpdatePersonalWorkoutInput,
): Promise<PersonalWorkout> {
  validateId(workoutId, 'Workout ID');

  if (input.workout_name !== undefined) {
    validateWorkoutName(input.workout_name);
  }

  if (input.workout_type !== undefined) {
    validateWorkoutType(input.workout_type);
  }

  if (input.workout_date !== undefined) {
    validateDate(input.workout_date, 'workout date');
  }

  if (input.started_at !== undefined && input.started_at !== null) {
    validateDate(input.started_at, 'workout start time');
  }

  validateDuration(input.duration_seconds);
  validateNotes(input.notes);

  const updatePayload: Record<string, unknown> = {};

  if (input.workout_name !== undefined) {
    updatePayload.workout_name = input.workout_name.trim();
  }

  if (input.workout_type !== undefined) {
    updatePayload.workout_type = input.workout_type;
  }

  if (input.workout_date !== undefined) {
    updatePayload.workout_date = input.workout_date;
  }

  if (input.started_at !== undefined) {
    updatePayload.started_at = input.started_at;
  }

  if (input.notes !== undefined) {
    updatePayload.notes = input.notes?.trim() || null;
  }

  if (input.duration_seconds !== undefined) {
    updatePayload.duration_seconds = input.duration_seconds;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('Please provide at least one field to update.');
  }

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('workouts')
    .update(updatePayload)
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .neq('status', 'completed')
    .select(PERSONAL_WORKOUT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Personal Workouts] Unable to update workout:', error);

    throw new Error('Unable to update your workout. Please try again.');
  }

  if (!data) {
    throw new Error('Workout not found or it has already been completed.');
  }

  return data as unknown as PersonalWorkout;
}

// =========================================================
// COMPLETE
// =========================================================

/**
 * Completes a personal workout and records its completion time.
 * Duration is calculated from started_at when not supplied.
 */
export async function completePersonalWorkout(
  workoutId: string,
  input: CompletePersonalWorkoutInput = {},
): Promise<PersonalWorkout> {
  validateId(workoutId, 'Workout ID');
  validateDuration(input.duration_seconds);

  if (input.completed_at) {
    validateDate(input.completed_at, 'completion time');
  }

  const user = await getAuthenticatedUser();

  const { data: existingWorkout, error: fetchError } = await supabase
    .from('workouts')
    .select('started_at, status')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error(
      '[Personal Workouts] Unable to retrieve workout for completion:',
      fetchError,
    );

    throw new Error('Unable to retrieve your workout. Please try again.');
  }

  if (!existingWorkout) {
    throw new Error('Workout not found.');
  }

  if (existingWorkout.status === 'completed') {
    throw new Error('This workout has already been completed.');
  }

  const completedAt = input.completed_at ? new Date(input.completed_at) : new Date();

  const startedAt = existingWorkout.started_at
    ? new Date(existingWorkout.started_at)
    : null;

  if (startedAt && Number.isNaN(startedAt.getTime())) {
    throw new Error('The workout start time is invalid.');
  }

  if (startedAt && completedAt.getTime() < startedAt.getTime()) {
    throw new Error('Completion time cannot be before the workout start time.');
  }

  const calculatedDuration =
    input.duration_seconds ??
    (startedAt ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000) : null);

  const { data, error } = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      duration_seconds: calculatedDuration,
    })
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .neq('status', 'completed')
    .select(PERSONAL_WORKOUT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Personal Workouts] Unable to complete workout:', error);

    throw new Error('Unable to complete your workout. Please try again.');
  }

  if (!data) {
    throw new Error('This workout has already been completed.');
  }

  return data as unknown as PersonalWorkout;
}

// =========================================================
// DELETE
// =========================================================

/**
 * Deletes a personal workout belonging to the authenticated user.
 * Related workout exercises and sets are removed through database cascades.
 */
export async function deletePersonalWorkout(workoutId: string): Promise<void> {
  validateId(workoutId, 'Workout ID');

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[Personal Workouts] Unable to delete workout:', error);

    throw new Error('Unable to delete your workout. Please try again.');
  }

  if (!data) {
    throw new Error('Workout not found.');
  }
}
