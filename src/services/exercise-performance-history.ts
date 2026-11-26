import { supabase } from '@/lib/supabase';

import { getPersonalWorkoutHistory } from '@/services/personal-workouts';

import type {
  PersonalWorkout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const PAGE_SIZE = 100;
const QUERY_BATCH_SIZE = 100;

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
// TYPES
// =========================================================

export type ExercisePerformanceSource = 'shared' | 'personal';

export type ExercisePerformanceSession = {
  workoutId: string;
  workoutName: string;
  workoutDate: string;
  completedAt: string;
  exerciseOrder: number;
  notes: string | null;
  sets: WorkoutSet[];
};

export type ExercisePerformanceHistoryItem = {
  exerciseKey: string;
  exerciseId: string;
  exerciseSource: ExercisePerformanceSource;
  exerciseName: string;
  totalSessions: number;
  latestPerformanceAt: string;
  sessions: ExercisePerformanceSession[];
};

// =========================================================
// HELPERS
// =========================================================

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isValidTimestamp(value: string | null): value is string {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

function getExerciseIdentity(exercise: WorkoutExercise): {
  id: string;
  source: ExercisePerformanceSource;
} | null {
  if (exercise.exercise_id) {
    return {
      id: exercise.exercise_id,
      source: 'shared',
    };
  }

  if (exercise.personal_exercise_id) {
    return {
      id: exercise.personal_exercise_id,
      source: 'personal',
    };
  }

  return null;
}

// =========================================================
// WORKOUT RETRIEVAL
// =========================================================

async function getAllCompletedWorkouts(): Promise<PersonalWorkout[]> {
  const workouts: PersonalWorkout[] = [];
  let offset = 0;

  while (true) {
    const page = await getPersonalWorkoutHistory({
      status: 'completed',
      limit: PAGE_SIZE,
      offset,
    });

    const validWorkouts = page.filter(
      (workout) =>
        workout.status === 'completed' &&
        isValidTimestamp(workout.completed_at),
    );

    workouts.push(...validWorkouts);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return workouts;
}

// =========================================================
// EXERCISE RETRIEVAL
// =========================================================

async function getWorkoutExercises(
  workoutIds: string[],
): Promise<WorkoutExercise[]> {
  const results: WorkoutExercise[] = [];

  for (const ids of chunk(workoutIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('workout_exercises')
      .select(WORKOUT_EXERCISE_COLUMNS)
      .in('workout_id', ids)
      .order('exercise_order', { ascending: true });

    if (error) {
      console.error(
        '[Exercise Performance History] Unable to load workout exercises:',
        error,
      );

      throw new Error(
        'Unable to load your exercise performance history. Please try again.',
      );
    }

    results.push(...((data ?? []) as WorkoutExercise[]));
  }

  return results;
}

// =========================================================
// SET RETRIEVAL
// =========================================================

async function getWorkoutSets(
  workoutExerciseIds: string[],
): Promise<WorkoutSet[]> {
  const results: WorkoutSet[] = [];

  for (const ids of chunk(workoutExerciseIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('workout_sets')
      .select(WORKOUT_SET_COLUMNS)
      .in('workout_exercise_id', ids)
      .order('set_number', { ascending: true });

    if (error) {
      console.error(
        '[Exercise Performance History] Unable to load workout sets:',
        error,
      );

      throw new Error(
        'Unable to load your exercise performance history. Please try again.',
      );
    }

    results.push(...((data ?? []) as WorkoutSet[]));
  }

  return results;
}

// =========================================================
// EXERCISE NAME RETRIEVAL
// =========================================================

async function getExerciseNames(
  exercises: WorkoutExercise[],
): Promise<Map<string, string>> {
  const sharedIds = [
    ...new Set(
      exercises
        .map((exercise) => exercise.exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const personalIds = [
    ...new Set(
      exercises
        .map((exercise) => exercise.personal_exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names = new Map<string, string>();

  for (const ids of chunk(sharedIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .in('id', ids);

    if (error) {
      console.error(
        '[Exercise Performance History] Unable to load shared exercise names:',
        error,
      );

      throw new Error(
        'Unable to load your exercise performance history. Please try again.',
      );
    }

    for (const exercise of data ?? []) {
      names.set(`shared:${exercise.id}`, exercise.name);
    }
  }

  for (const ids of chunk(personalIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('personal_exercises')
      .select('id, name')
      .in('id', ids);

    if (error) {
      console.error(
        '[Exercise Performance History] Unable to load personal exercise names:',
        error,
      );

      throw new Error(
        'Unable to load your exercise performance history. Please try again.',
      );
    }

    for (const exercise of data ?? []) {
      names.set(`personal:${exercise.id}`, exercise.name);
    }
  }

  return names;
}

// =========================================================
// PUBLIC SERVICE
// =========================================================

/**
 * Retrieves exercise performance history for the authenticated user.
 *
 * Only completed workouts with valid completion timestamps are included.
 * Exercise identity uses both its ID and source, keeping shared and personal
 * exercises separate even when their names are identical.
 *
 * Every recorded set is preserved. Missing measurements remain null.
 */
export async function getExercisePerformanceHistory(): Promise<
  ExercisePerformanceHistoryItem[]
> {
  const workouts = await getAllCompletedWorkouts();

  if (workouts.length === 0) {
    return [];
  }

  const workoutById = new Map(
    workouts.map((workout) => [workout.id, workout]),
  );

  const workoutExercises = await getWorkoutExercises(
    workouts.map((workout) => workout.id),
  );

  if (workoutExercises.length === 0) {
    return [];
  }

  const exerciseNames = await getExerciseNames(workoutExercises);

  const workoutExerciseIds = workoutExercises.map(
    (exercise) => exercise.id,
  );

  const sets = await getWorkoutSets(workoutExerciseIds);

  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();

  for (const set of sets) {
    const existing = setsByWorkoutExercise.get(
      set.workout_exercise_id,
    ) ?? [];

    existing.push(set);

    setsByWorkoutExercise.set(
      set.workout_exercise_id,
      existing,
    );
  }

  const history = new Map<
    string,
    ExercisePerformanceHistoryItem
  >();

  for (const exercise of workoutExercises) {
    const identity = getExerciseIdentity(exercise);

    if (!identity) {
      continue;
    }

    const workout = workoutById.get(exercise.workout_id);

    if (!workout || !isValidTimestamp(workout.completed_at)) {
      continue;
    }

    const exerciseSets = setsByWorkoutExercise.get(exercise.id) ?? [];

    // An exercise without recorded sets has no measurable performance history.
    if (exerciseSets.length === 0) {
      continue;
    }

    const exerciseKey = `${identity.source}:${identity.id}`;

    let item = history.get(exerciseKey);

    if (!item) {
      item = {
        exerciseKey,
        exerciseId: identity.id,
        exerciseSource: identity.source,
        exerciseName:
          exerciseNames.get(exerciseKey) ?? 'Exercise name unavailable',
        totalSessions: 0,
        latestPerformanceAt: workout.completed_at,
        sessions: [],
      };

      history.set(exerciseKey, item);
    }

    item.sessions.push({
      workoutId: workout.id,
      workoutName: workout.workout_name,
      workoutDate: workout.workout_date,
      completedAt: workout.completed_at,
      exerciseOrder: exercise.exercise_order,
      notes: exercise.notes,
      sets: [...exerciseSets].sort(
        (a, b) => a.set_number - b.set_number,
      ),
    });
  }

  const result = Array.from(history.values());

  for (const item of result) {
    item.sessions.sort(
      (a, b) =>
        Date.parse(b.completedAt) - Date.parse(a.completedAt),
    );

    item.totalSessions = item.sessions.length;
    item.latestPerformanceAt = item.sessions[0].completedAt;
  }

  return result.sort(
    (a, b) =>
      Date.parse(b.latestPerformanceAt) -
      Date.parse(a.latestPerformanceAt),
  );
}
