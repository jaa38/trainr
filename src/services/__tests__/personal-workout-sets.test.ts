import { supabase } from '@/lib/supabase';

import {
  createWorkoutSet,
  deleteWorkoutSet,
  updateWorkoutSet,
} from '../personal-workout-sets';

import type {
  PersonalWorkout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/personal-workouts';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockedGetUser = jest.mocked(supabase.auth.getUser);
const mockedFrom = jest.mocked(supabase.from);

const mockUser = {
  id: 'user-123',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

const mockWorkout: PersonalWorkout = {
  id: 'workout-123',
  user_id: 'user-123',
  workout_name: 'Upper Body Strength',
  workout_type: 'strength',
  workout_date: '2026-11-24',
  started_at: '2026-11-24T09:00:00.000Z',
  completed_at: null,
  duration_seconds: null,
  notes: 'Push day',
  status: 'in_progress',
  created_at: '2026-11-24T09:00:00.000Z',
  updated_at: '2026-11-24T09:00:00.000Z',
};

const mockWorkoutExercise: WorkoutExercise = {
  id: 'workout-exercise-123',
  workout_id: 'workout-123',
  exercise_id: 'exercise-123',
  personal_exercise_id: null,
  exercise_order: 0,
  notes: null,
  created_at: '2026-11-24T09:00:00.000Z',
};

const mockSet: WorkoutSet = {
  id: 'set-123',
  workout_exercise_id: 'workout-exercise-123',
  set_number: 1,
  repetitions: 10,
  weight: 40,
  weight_unit: 'kg',
  duration_seconds: null,
  distance: null,
  distance_unit: null,
  notes: null,
  created_at: '2026-11-24T09:05:00.000Z',
};

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, any> = {};

  const chain = jest.fn(() => query);

  ['select', 'insert', 'update', 'delete', 'eq'].forEach((method) => {
    query[method] = chain;
  });

  query.single = jest.fn().mockResolvedValue(response);
  query.maybeSingle = jest.fn().mockResolvedValue(response);

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

function mockEditableWorkoutQueries(finalQuery: Record<string, any>) {
  queueQueries(
    createQuery({
      data: mockWorkoutExercise,
      error: null,
    }),
    createQuery({
      data: {
        id: mockWorkout.id,
        status: 'in_progress',
      },
      error: null,
    }),
    finalQuery,
  );
}

describe('Personal Workout Sets service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  // =========================================================
  // CREATE WORKOUT SET
  // =========================================================

  describe('createWorkoutSet', () => {
    it('creates a workout set for an editable workout', async () => {
      const insertQuery = createQuery({
        data: mockSet,
        error: null,
      });

      queueQueries(
        createQuery({
          data: mockWorkoutExercise,
          error: null,
        }),
        createQuery({
          data: {
            id: mockWorkout.id,
            status: 'in_progress',
          },
          error: null,
        }),
        insertQuery,
      );

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          repetitions: 10,
          weight: 40,
          weight_unit: 'kg',
        }),
      ).resolves.toEqual(mockSet);

      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'workout_exercises');
      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'workouts');
      expect(mockedFrom).toHaveBeenNthCalledWith(3, 'workout_sets');

      expect(insertQuery.insert).toHaveBeenCalledWith({
        workout_exercise_id: 'workout-exercise-123',
        set_number: 1,
        repetitions: 10,
        weight: 40,
        weight_unit: 'kg',
        duration_seconds: null,
        distance: null,
        distance_unit: null,
        notes: null,
      });
    });

    it('rejects an empty workout exercise ID', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: '',
          set_number: 1,
        }),
      ).rejects.toThrow('Workout exercise ID is required.');

      expect(mockedGetUser).not.toHaveBeenCalled();
    });

    it('rejects a non-positive set number', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 0,
        }),
      ).rejects.toThrow('Set number must be a positive whole number.');
    });

    it('rejects negative or fractional repetitions', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          repetitions: -1,
        }),
      ).rejects.toThrow('Repetitions must be a non-negative whole number.');

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          repetitions: 2.5,
        }),
      ).rejects.toThrow('Repetitions must be a non-negative whole number.');
    });

    it('rejects negative weights', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          weight: -10,
          weight_unit: 'kg',
        }),
      ).rejects.toThrow('Weight must be a non-negative number.');
    });

    it('requires a valid weight unit when weight is provided', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          weight: 40,
        }),
      ).rejects.toThrow('Weight unit must be kg or lb when weight is provided.');
    });

    it('rejects a weight unit without a weight', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          weight_unit: 'kg',
        }),
      ).rejects.toThrow('Weight unit must be empty when weight is not provided.');
    });

    it('requires a valid distance unit when distance is provided', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          distance: 5,
        }),
      ).rejects.toThrow('Distance unit must be km or mi when distance is provided.');
    });

    it('rejects negative duration values', async () => {
      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
          duration_seconds: -5,
        }),
      ).rejects.toThrow('Duration must be a non-negative whole number.');
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
        }),
      ).rejects.toThrow('Please sign in to continue.');
    });

    it('rejects sets added to completed workouts', async () => {
      queueQueries(
        createQuery({
          data: mockWorkoutExercise,
          error: null,
        }),
        createQuery({
          data: {
            id: mockWorkout.id,
            status: 'completed',
          },
          error: null,
        }),
      );

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
        }),
      ).rejects.toThrow('Completed workouts cannot be modified.');
    });

    it('rejects exercises belonging to another user', async () => {
      queueQueries(
        createQuery({
          data: mockWorkoutExercise,
          error: null,
        }),
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
        }),
      ).rejects.toThrow('Workout not found.');
    });

    it('returns a friendly error for duplicate set numbers', async () => {
      const insertQuery = createQuery({
        data: null,
        error: {
          code: '23505',
          message: 'Duplicate key value violates unique constraint.',
        },
      });

      mockEditableWorkoutQueries(insertQuery);

      await expect(
        createWorkoutSet({
          workout_exercise_id: 'workout-exercise-123',
          set_number: 1,
        }),
      ).rejects.toThrow('A set with this number already exists for this exercise.');
    });
  });

  // =========================================================
  // UPDATE WORKOUT SET
  // =========================================================

  describe('updateWorkoutSet', () => {
    it('updates a workout set', async () => {
      const updateQuery = createQuery({
        data: {
          ...mockSet,
          repetitions: 12,
        },
        error: null,
      });

      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        updateQuery,
      );

      await expect(
        updateWorkoutSet('set-123', {
          repetitions: 12,
        }),
      ).resolves.toEqual({
        ...mockSet,
        repetitions: 12,
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        repetitions: 12,
      });
    });

    it('rejects an empty update', async () => {
      await expect(updateWorkoutSet('set-123', {})).rejects.toThrow(
        'Please provide at least one field to update.',
      );

      expect(mockedGetUser).not.toHaveBeenCalled();
    });

    it('preserves the existing weight when changing only its unit', async () => {
      const updateQuery = createQuery({
        data: {
          ...mockSet,
          weight_unit: 'lb',
        },
        error: null,
      });

      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        updateQuery,
      );

      await updateWorkoutSet('set-123', {
        weight_unit: 'lb',
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        weight_unit: 'lb',
      });
    });

    it('clears the weight unit when weight is cleared', async () => {
      const updateQuery = createQuery({
        data: {
          ...mockSet,
          weight: null,
          weight_unit: null,
        },
        error: null,
      });

      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        updateQuery,
      );

      await updateWorkoutSet('set-123', {
        weight: null,
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        weight: null,
        weight_unit: null,
      });
    });

    it('clears the distance unit when distance is cleared', async () => {
      const existingSet = {
        ...mockSet,
        distance: 5,
        distance_unit: 'km' as const,
      };

      const updateQuery = createQuery({
        data: {
          ...existingSet,
          distance: null,
          distance_unit: null,
        },
        error: null,
      });

      queueQueries(
        createQuery({ data: existingSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        updateQuery,
      );

      await updateWorkoutSet('set-123', {
        distance: null,
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        distance: null,
        distance_unit: null,
      });
    });

    it('rejects an invalid partial weight-unit update', async () => {
      queueQueries(
        createQuery({
          data: { ...mockSet, weight: null, weight_unit: null },
          error: null,
        }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
      );

      await expect(
        updateWorkoutSet('set-123', {
          weight_unit: 'kg',
        }),
      ).rejects.toThrow('Weight unit must be empty when weight is not provided.');
    });

    it('rejects updates to completed workouts', async () => {
      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'completed' },
          error: null,
        }),
      );

      await expect(
        updateWorkoutSet('set-123', {
          repetitions: 12,
        }),
      ).rejects.toThrow('Completed workouts cannot be modified.');
    });

    it('rejects a set that does not belong to the user', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(
        updateWorkoutSet('set-123', {
          repetitions: 12,
        }),
      ).rejects.toThrow('Workout set not found.');
    });

    it('rejects duplicate set numbers', async () => {
      const updateQuery = createQuery({
        data: null,
        error: {
          code: '23505',
          message: 'Duplicate key value violates unique constraint.',
        },
      });

      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        updateQuery,
      );

      await expect(
        updateWorkoutSet('set-123', {
          set_number: 2,
        }),
      ).rejects.toThrow('A set with this number already exists for this exercise.');
    });
  });

  // =========================================================
  // DELETE WORKOUT SET
  // =========================================================

  describe('deleteWorkoutSet', () => {
    it('deletes a set from an editable workout', async () => {
      const deleteQuery = createQuery({
        data: { id: mockSet.id },
        error: null,
      });

      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'in_progress' },
          error: null,
        }),
        deleteQuery,
      );

      await expect(deleteWorkoutSet('set-123')).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenNthCalledWith(4, 'workout_sets');
      expect(deleteQuery.delete).toHaveBeenCalled();
    });

    it('rejects an empty set ID', async () => {
      await expect(deleteWorkoutSet('')).rejects.toThrow('Workout set ID is required.');
    });

    it('rejects deleting a set from a completed workout', async () => {
      queueQueries(
        createQuery({ data: mockSet, error: null }),
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({
          data: { id: mockWorkout.id, status: 'completed' },
          error: null,
        }),
      );

      await expect(deleteWorkoutSet('set-123')).rejects.toThrow(
        'Completed workouts cannot be modified.',
      );
    });
  });
});
