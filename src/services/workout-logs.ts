import { supabase } from '@/lib/supabase';

export type WorkoutSetLog = {
  set_number: number;
  target_reps: string;
  actual_reps: number | null;
  weight: number | null;
  weight_unit: 'kg' | 'lb' | null;
  completed: boolean;
};

export type WorkoutExerciseLog = {
  plan_exercise_id: string;
  exercise_id: string;
  exercise_name: string;
  day_number: number;
  day_name: string;
  exercise_order: number;
  target_sets: number;
  target_repetitions: string;
  rest_seconds: number | null;
  notes: string | null;
  sets: WorkoutSetLog[];
  completed: boolean;
};

export type WorkoutLog = {
  id: string;
  assigned_workout_plan_id: string;
  gym_goer_id: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  exercise_logs: WorkoutExerciseLog[];
  notes: string | null;
  created_at: string;
};

export type StartWorkoutLogInput = {
  assignmentId: string;
  gymGoerId: string;
  dayNumber: number;
  dayName: string;
  exercises: {
    id: string;
    exercise_id: string;
    exercise_order: number;
    sets: number;
    repetitions: string;
    rest_seconds: number | null;
    notes: string | null;
    exercise: {
      name: string;
    };
  }[];
};

const WORKOUT_LOG_COLUMNS = `
  id,
  assigned_workout_plan_id,
  gym_goer_id,
  started_at,
  completed_at,
  duration_minutes,
  exercise_logs,
  notes,
  created_at
`;

function validateId(value: string, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateExerciseLogs(exerciseLogs: WorkoutExerciseLog[]) {
  if (!Array.isArray(exerciseLogs)) {
    throw new Error('Workout exercise data must be an array.');
  }

  for (const exercise of exerciseLogs) {
    for (const set of exercise.sets) {
      if (
        set.actual_reps !== null &&
        (!Number.isInteger(set.actual_reps) || set.actual_reps < 0)
      ) {
        throw new Error('Actual repetitions must be a non-negative whole number.');
      }

      if (
        set.weight !== null &&
        (!Number.isFinite(set.weight) || set.weight < 0)
      ) {
        throw new Error('Weight must be a non-negative number.');
      }
    }
  }
}


/**
 * Resumes an existing in-progress workout for the selected training day,
 * or creates a new workout log if one does not exist.
 */
export async function startWorkoutLog(
  input: StartWorkoutLogInput
): Promise<WorkoutLog> {
  validateId(input.assignmentId, 'Assignment ID');
  validateId(input.gymGoerId, 'Gym-goer ID');

  if (!input.exercises.length) {
    throw new Error('This training day has no exercises.');
  }

  // Check for an existing in-progress workout.
  const { data: existingLogs, error: existingLogsError } =
    await supabase
      .from('workout_logs')
      .select(WORKOUT_LOG_COLUMNS)
      .eq('assigned_workout_plan_id', input.assignmentId)
      .eq('gym_goer_id', input.gymGoerId)
      .is('completed_at', null)
      .order('started_at', { ascending: false });

  if (existingLogsError) {
    console.error(
      '[Workout Logs] Failed to check existing workouts:',
      existingLogsError
    );
    throw new Error('Unable to check your existing workouts. Please try again.');
  }

  // Resume the existing workout if it belongs to this training day.
  const existingWorkout = (existingLogs ?? []).find((log) =>
    (log.exercise_logs as WorkoutExerciseLog[]).some(
      (exercise) => exercise.day_number === input.dayNumber
    )
  );

  if (existingWorkout) {
    return existingWorkout as unknown as WorkoutLog;
  }

  // Otherwise, create a new workout log.
  const exerciseLogs: WorkoutExerciseLog[] = input.exercises.map(
    (exercise) => ({
      plan_exercise_id: exercise.id,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise.name,
      day_number: input.dayNumber,
      day_name: input.dayName,
      exercise_order: exercise.exercise_order,
      target_sets: exercise.sets,
      target_repetitions: exercise.repetitions,
      rest_seconds: exercise.rest_seconds,
      notes: exercise.notes,
      sets: Array.from({ length: exercise.sets }, (_, index) => ({
        set_number: index + 1,
        target_reps: exercise.repetitions,
        actual_reps: null,
        weight: null,
        weight_unit: null,
        completed: false,
      })),
      completed: false,
    })
  );

  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      assigned_workout_plan_id: input.assignmentId,
      gym_goer_id: input.gymGoerId,
      exercise_logs: exerciseLogs as never,
    })
    .select(WORKOUT_LOG_COLUMNS)
    .single();

  if (error) {
    console.error('[Workout Logs] Failed to start workout:', error);
    throw new Error('Unable to start your workout. Please try again.');
  }

  return data as unknown as WorkoutLog;
}


/**
 * Saves exercise performance while a workout is still in progress.
 */
export async function updateWorkoutLog(
  logId: string,
  gymGoerId: string,
  exerciseLogs: WorkoutExerciseLog[],
  notes?: string | null
): Promise<WorkoutLog> {
  validateId(logId, 'Workout log ID');
  validateId(gymGoerId, 'Gym-goer ID');
  validateExerciseLogs(exerciseLogs);

  const updatePayload: {
    exercise_logs: never;
    notes?: string | null;
  } = {
    exercise_logs: exerciseLogs as never,
  };

  if (notes !== undefined) {
    updatePayload.notes = notes;
  }

  const { data, error } = await supabase
    .from('workout_logs')
    .update(updatePayload)
    .eq('id', logId)
    .eq('gym_goer_id', gymGoerId)
    .is('completed_at', null)
    .select(WORKOUT_LOG_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Workout Logs] Failed to update workout:', error);
    throw new Error('Unable to save your workout progress. Please try again.');
  }

  if (!data) {
    throw new Error('Workout not found or it has already been completed.');
  }

  return data as unknown as WorkoutLog;
}

/**
 * Completes a workout and records its duration.
 */
export async function completeWorkoutLog(
  logId: string,
  gymGoerId: string
): Promise<WorkoutLog> {
  validateId(logId, 'Workout log ID');
  validateId(gymGoerId, 'Gym-goer ID');

  const { data: existingLog, error: fetchError } = await supabase
    .from('workout_logs')
    .select('started_at')
    .eq('id', logId)
    .eq('gym_goer_id', gymGoerId)
    .is('completed_at', null)
    .maybeSingle();

  if (fetchError) {
    console.error('[Workout Logs] Failed to retrieve workout:', fetchError);
    throw new Error('Unable to retrieve your workout. Please try again.');
  }

  if (!existingLog) {
    throw new Error('Workout not found or it has already been completed.');
  }

  const completedAt = new Date();
  const startedAt = new Date(existingLog.started_at);

  if (Number.isNaN(startedAt.getTime())) {
    throw new Error('The workout start time is invalid.');
  }

  const durationMinutes = Math.max(
    0,
    Math.floor((completedAt.getTime() - startedAt.getTime()) / 60000)
  );

  const { data, error } = await supabase
    .from('workout_logs')
    .update({
      completed_at: completedAt.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq('id', logId)
    .eq('gym_goer_id', gymGoerId)
    .is('completed_at', null)
    .select(WORKOUT_LOG_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Workout Logs] Failed to complete workout:', error);
    throw new Error('Unable to complete your workout. Please try again.');
  }

  if (!data) {
    throw new Error('This workout has already been completed.');
  }

  return data as unknown as WorkoutLog;
}

/**
 * Retrieves workout history for a gym-goer.
 * Includes both completed and in-progress workout logs.
 */
export async function getWorkoutHistory(
  gymGoerId: string
): Promise<WorkoutLog[]> {
  validateId(gymGoerId, 'Gym-goer ID');

  const { data, error } = await supabase
    .from('workout_logs')
    .select(WORKOUT_LOG_COLUMNS)
    .eq('gym_goer_id', gymGoerId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[Workout Logs] Failed to retrieve workout history:', error);
    throw new Error('Unable to load your workout history. Please try again.');
  }

  return (data ?? []) as unknown as WorkoutLog[];
}


/**
 * Retrieves one workout log by ID.
 */
export async function getWorkoutLogById(
  logId: string,
  gymGoerId: string
): Promise<WorkoutLog> {
  validateId(logId, 'Workout log ID');
  validateId(gymGoerId, 'Gym-goer ID');

  const { data, error } = await supabase
    .from('workout_logs')
    .select(WORKOUT_LOG_COLUMNS)
    .eq('id', logId)
    .eq('gym_goer_id', gymGoerId)
    .maybeSingle();

  if (error) {
    console.error('[Workout Logs] Failed to retrieve workout:', error);
    throw new Error('Unable to load this workout. Please try again.');
  }

  if (!data) {
    throw new Error('Workout not found.');
  }

  return data as unknown as WorkoutLog;
}

/**
 * Clears all workout history belonging to the authenticated gym-goer.
 */
export async function clearWorkoutHistory(
  gymGoerId: string
): Promise<number> {
  validateId(gymGoerId, 'Gym-goer ID');

  const { data, error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('gym_goer_id', gymGoerId)
    .select('id');

  if (error) {
    console.error('[Workout Logs] Failed to clear workout history:', error);
    throw new Error('Unable to clear workout history. Please try again.');
  }

  return data?.length ?? 0;
}
