import { supabase } from '@/lib/supabase';

import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { getExercisePerformanceHistory } from '../exercise-performance-history';

import type {
  PersonalWorkout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/personal-workouts';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@/services/personal-workouts', () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

const mockedFrom = jest.mocked(supabase.from);
const mockedGetPersonalWorkoutHistory = jest.mocked(
  getPersonalWorkoutHistory,
);

const mockWorkouts: PersonalWorkout[] = [
  {
    id: 'workout-old',
    user_id: 'user-123',
    workout_name: 'Upper Body',
    workout_type: 'strength',
    workout_date: '2026-11-20',
    started_at: '2026-11-20T09:00:00.000Z',
    completed_at: '2026-11-20T10:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    status: 'completed',
    created_at: '2026-11-20T09:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'workout-new',
    user_id: 'user-123',
    workout_name: 'Push Day',
    workout_type: 'strength',
    workout_date: '2026-11-24',
    started_at: '2026-11-24T09:00:00.000Z',
    completed_at: '2026-11-24T10:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    status: 'completed',
    created_at: '2026-11-24T09:00:00.000Z',
    updated_at: '2026-11-24T10:00:00.000Z',
  },
];

const mockExercises: WorkoutExercise[] = [
  {
    id: 'shared-old',
    workout_id: 'workout-old',
    exercise_id: 'bench-press',
    personal_exercise_id: null,
    exercise_order: 0,
    notes: 'Controlled reps',
    created_at: '2026-11-20T09:00:00.000Z',
  },
  {
    id: 'personal-old',
    workout_id: 'workout-old',
    exercise_id: null,
    personal_exercise_id: 'personal-bench',
    exercise_order: 1,
    notes: null,
    created_at: '2026-11-20T09:10:00.000Z',
  },
  {
    id: 'shared-new',
    workout_id: 'workout-new',
    exercise_id: 'bench-press',
    personal_exercise_id: null,
    exercise_order: 0,
    notes: null,
    created_at: '2026-11-24T09:00:00.000Z',
  },
];

const mockSets: WorkoutSet[] = [
  {
    id: 'set-old-2',
    workout_exercise_id: 'shared-old',
    set_number: 2,
    repetitions: 8,
    weight: 50,
    weight_unit: 'kg',
    duration_seconds: null,
    distance: null,
    distance_unit: null,
    notes: null,
    created_at: '2026-11-20T09:05:00.000Z',
  },
  {
    id: 'set-old-1',
    workout_exercise_id: 'shared-old',
    set_number: 1,
    repetitions: 10,
    weight: 40,
    weight_unit: 'kg',
    duration_seconds: null,
    distance: null,
    distance_unit: null,
    notes: null,
    created_at: '2026-11-20T09:04:00.000Z',
  },
  {
    id: 'set-personal',
    workout_exercise_id: 'personal-old',
    set_number: 1,
    repetitions: 12,
    weight: null,
    weight_unit: null,
    duration_seconds: null,
    distance: null,
    distance_unit: null,
    notes: 'Bodyweight',
    created_at: '2026-11-20T09:15:00.000Z',
  },
  {
    id: 'set-new',
    workout_exercise_id: 'shared-new',
    set_number: 1,
    repetitions: 6,
    weight: 60,
    weight_unit: 'kg',
    duration_seconds: null,
    distance: null,
    distance_unit: null,
    notes: null,
    created_at: '2026-11-24T09:05:00.000Z',
  },
];

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, any> = {};

  const chain = jest.fn(() => query);

  ['select', 'in', 'order'].forEach((method) => {
    query[method] = chain;
  });

  query.then = (
    resolve: (value: QueryResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);

  return query;
}

function queueQueries(...queries: Record<string, any>[]) {
  const pendingQueries = [...queries];

  mockedFrom.mockImplementation(() => {
    const query = pendingQueries.shift();

    if (!query) {
      throw new Error('Unexpected Supabase query.');
    }

    return query as never;
  });
}

function queueCompleteHistoryQueries() {
  queueQueries(
    createQuery({
      data: mockExercises,
      error: null,
    }),
    createQuery({
      data: [{ id: 'bench-press', name: 'Bench Press' }],
      error: null,
    }),
    createQuery({
      data: [{ id: 'personal-bench', name: 'Bench Press' }],
      error: null,
    }),
    createQuery({
      data: mockSets,
      error: null,
    }),
  );
}

describe('Exercise Performance History service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetPersonalWorkoutHistory.mockResolvedValue(
      mockWorkouts,
    );
  });

  it('groups shared and personal exercises separately', async () => {
    queueCompleteHistoryQueries();

    const result = await getExercisePerformanceHistory();

    expect(result).toHaveLength(2);

    expect(result.map((item) => item.exerciseKey)).toEqual([
      'shared:bench-press',
      'personal:personal-bench',
    ]);

    expect(result[0].exerciseName).toBe('Bench Press');
    expect(result[1].exerciseName).toBe('Bench Press');

    expect(result[0].exerciseSource).toBe('shared');
    expect(result[1].exerciseSource).toBe('personal');
  });

  it('preserves all sets and orders sessions and sets correctly', async () => {
    queueCompleteHistoryQueries();

    const result = await getExercisePerformanceHistory();

    const benchPress = result.find(
      (item) => item.exerciseKey === 'shared:bench-press',
    );

    expect(benchPress).toBeDefined();
    expect(benchPress?.totalSessions).toBe(2);

    expect(
      benchPress?.sessions.map((session) => session.workoutId),
    ).toEqual(['workout-new', 'workout-old']);

    expect(
      benchPress?.sessions[1].sets.map((set) => set.set_number),
    ).toEqual([1, 2]);

    expect(benchPress?.sessions[1].sets).toHaveLength(2);
  });

  it('preserves missing measurements as null', async () => {
    queueCompleteHistoryQueries();

    const result = await getExercisePerformanceHistory();

    const personalExercise = result.find(
      (item) => item.exerciseKey === 'personal:personal-bench',
    );

    expect(personalExercise?.sessions[0].sets[0]).toMatchObject({
      repetitions: 12,
      weight: null,
      weight_unit: null,
      duration_seconds: null,
      distance: null,
      distance_unit: null,
    });
  });

  it('excludes workouts without valid completion timestamps', async () => {
    mockedGetPersonalWorkoutHistory.mockResolvedValue([
      ...mockWorkouts,
      {
        ...mockWorkouts[0],
        id: 'incomplete-workout',
        status: 'in_progress',
        completed_at: null,
      },
      {
        ...mockWorkouts[0],
        id: 'invalid-completion',
        completed_at: 'invalid-date',
      },
    ]);

    queueCompleteHistoryQueries();

    const result = await getExercisePerformanceHistory();

    expect(result[0].totalSessions).toBe(2);
    expect(
      result.flatMap((item) => item.sessions).some(
        (session) =>
          session.workoutId === 'incomplete-workout' ||
          session.workoutId === 'invalid-completion',
      ),
    ).toBe(false);
  });

  it('returns an empty list without querying exercise tables when no workouts exist', async () => {
    mockedGetPersonalWorkoutHistory.mockResolvedValue([]);

    await expect(
      getExercisePerformanceHistory(),
    ).resolves.toEqual([]);

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('paginates through completed workout history', async () => {
    const firstPage = Array.from(
      { length: 100 },
      (_, index) => ({
        ...mockWorkouts[0],
        id: `workout-${index}`,
      }),
    );

    mockedGetPersonalWorkoutHistory.mockImplementation(
      async (options) =>
        options?.offset === 0 ? firstPage : [mockWorkouts[1]],
    );

    queueQueries(
      createQuery({
        data: [],
        error: null,
      }),
      createQuery({
        data: [],
        error: null,
      }),
    );

    await expect(
      getExercisePerformanceHistory(),
    ).resolves.toEqual([]);

    expect(mockedGetPersonalWorkoutHistory).toHaveBeenCalledTimes(2);
    expect(mockedGetPersonalWorkoutHistory).toHaveBeenNthCalledWith(
      1,
      {
        status: 'completed',
        limit: 100,
        offset: 0,
      },
    );
    expect(mockedGetPersonalWorkoutHistory).toHaveBeenNthCalledWith(
      2,
      {
        status: 'completed',
        limit: 100,
        offset: 100,
      },
    );
  });

  it('throws a friendly error when workout exercise retrieval fails', async () => {
    queueQueries(
      createQuery({
        data: null,
        error: { message: 'Database unavailable' },
      }),
    );

    await expect(
      getExercisePerformanceHistory(),
    ).rejects.toThrow(
      'Unable to load your exercise performance history. Please try again.',
    );
  });
});
