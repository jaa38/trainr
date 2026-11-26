import { supabase } from '@/lib/supabase';

import {
  createWorkoutExercise,
  deleteWorkoutExercise,
  getPersonalWorkoutDetails,
  updateWorkoutExercise,
} from '../personal-workout-exercises';

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

  [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'is',
    'not',
    'in',
    'order',
  ].forEach((method) => {
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

describe('Personal Workout Exercises service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('createWorkoutExercise', () => {
    it('adds a shared exercise to an editable workout', async () => {
      const workoutQuery = createQuery({
        data: { id: mockWorkout.id, status: 'in_progress' },
        error: null,
      });

      const insertQuery = createQuery({
        data: mockWorkoutExercise,
        error: null,
      });

      queueQueries(workoutQuery, insertQuery);

      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
          exercise_id: 'exercise-123',
        }),
      ).resolves.toEqual(mockWorkoutExercise);

      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'workouts');
      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'workout_exercises');

      expect(insertQuery.insert).toHaveBeenCalledWith({
        workout_id: 'workout-123',
        exercise_id: 'exercise-123',
        personal_exercise_id: null,
        exercise_order: 0,
        notes: null,
      });
    });

    it('adds a personal exercise to an editable workout', async () => {
      const workoutQuery = createQuery({
        data: { id: mockWorkout.id, status: 'draft' },
        error: null,
      });

      const insertQuery = createQuery({
        data: {
          ...mockWorkoutExercise,
          exercise_id: null,
          personal_exercise_id: 'personal-exercise-123',
        },
        error: null,
      });

      queueQueries(workoutQuery, insertQuery);

      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
          personal_exercise_id: 'personal-exercise-123',
        }),
      ).resolves.toMatchObject({
        personal_exercise_id: 'personal-exercise-123',
      });
    });

    it('rejects when neither exercise reference is provided', async () => {
      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
        }),
      ).rejects.toThrow('Select exactly one shared or personal exercise.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects when both exercise references are provided', async () => {
      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
          exercise_id: 'exercise-123',
          personal_exercise_id: 'personal-exercise-123',
        }),
      ).rejects.toThrow('Select exactly one shared or personal exercise.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid exercise ordering', async () => {
      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
          exercise_id: 'exercise-123',
          exercise_order: -1,
        }),
      ).rejects.toThrow('Exercise order must be a non-negative whole number.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('adds an exercise to a completed workout owned by the user', async () => {
      const insertQuery = createQuery({
        data: mockWorkoutExercise,
        error: null,
      });

      queueQueries(
        createQuery({ data: { id: mockWorkout.id }, error: null }),
        insertQuery,
      );

      await expect(
        createWorkoutExercise({
          workout_id: 'workout-123',
          exercise_id: 'exercise-123',
        }),
      ).resolves.toEqual(mockWorkoutExercise);

      expect(insertQuery.insert).toHaveBeenCalled();
    });

    it('rejects workouts not owned by the authenticated user', async () => {
      const workoutQuery = createQuery({
        data: null,
        error: null,
      });

      queueQueries(workoutQuery);

      await expect(
        createWorkoutExercise({
          workout_id: 'another-workout',
          exercise_id: 'exercise-123',
        }),
      ).rejects.toThrow('Workout not found.');
    });
  });

  describe('updateWorkoutExercise', () => {
    it('updates exercise notes', async () => {
      const ownershipQuery = createQuery({
        data: mockWorkoutExercise,
        error: null,
      });

      const workoutQuery = createQuery({
        data: { id: mockWorkout.id, status: 'in_progress' },
        error: null,
      });

      const updateQuery = createQuery({
        data: { ...mockWorkoutExercise, notes: 'Keep controlled form' },
        error: null,
      });

      queueQueries(ownershipQuery, workoutQuery, updateQuery);

      await expect(
        updateWorkoutExercise('workout-exercise-123', {
          notes: 'Keep controlled form',
        }),
      ).resolves.toMatchObject({
        notes: 'Keep controlled form',
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        notes: 'Keep controlled form',
      });
    });

    it('updates exercise ordering', async () => {
      const ownershipQuery = createQuery({
        data: mockWorkoutExercise,
        error: null,
      });

      const workoutQuery = createQuery({
        data: { id: mockWorkout.id, status: 'draft' },
        error: null,
      });

      const updateQuery = createQuery({
        data: { ...mockWorkoutExercise, exercise_order: 1 },
        error: null,
      });

      queueQueries(ownershipQuery, workoutQuery, updateQuery);

      await expect(
        updateWorkoutExercise('workout-exercise-123', {
          exercise_order: 1,
        }),
      ).resolves.toMatchObject({
        exercise_order: 1,
      });
    });

    it('rejects an empty update', async () => {
      await expect(updateWorkoutExercise('workout-exercise-123', {})).rejects.toThrow(
        'Please provide at least one field to update.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('updates an exercise in a completed workout owned by the user', async () => {
      const updatedExercise = {
        ...mockWorkoutExercise,
        notes: 'Updated notes',
      };

      const updateQuery = createQuery({
        data: updatedExercise,
        error: null,
      });

      queueQueries(
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({ data: { id: mockWorkout.id }, error: null }),
        updateQuery,
      );

      await expect(
        updateWorkoutExercise('workout-exercise-123', {
          notes: 'Updated notes',
        }),
      ).resolves.toMatchObject({ notes: 'Updated notes' });

      expect(updateQuery.update).toHaveBeenCalledWith({
        notes: 'Updated notes',
      });
    });
  });

  describe('deleteWorkoutExercise', () => {
    it('deletes an exercise from an editable workout', async () => {
      const ownershipQuery = createQuery({
        data: mockWorkoutExercise,
        error: null,
      });

      const workoutQuery = createQuery({
        data: { id: mockWorkout.id, status: 'in_progress' },
        error: null,
      });

      const deleteQuery = createQuery({
        data: { id: mockWorkoutExercise.id },
        error: null,
      });

      queueQueries(ownershipQuery, workoutQuery, deleteQuery);

      await expect(
        deleteWorkoutExercise('workout-exercise-123'),
      ).resolves.toBeUndefined();

      expect(deleteQuery.delete).toHaveBeenCalled();
      expect(deleteQuery.eq).toHaveBeenCalledWith('id', 'workout-exercise-123');
    });

    it('deletes an exercise from a completed workout owned by the user', async () => {
      const deleteQuery = createQuery({
        data: { id: mockWorkoutExercise.id },
        error: null,
      });

      queueQueries(
        createQuery({ data: mockWorkoutExercise, error: null }),
        createQuery({ data: { id: mockWorkout.id }, error: null }),
        deleteQuery,
      );

      await expect(
        deleteWorkoutExercise('workout-exercise-123'),
      ).resolves.toBeUndefined();

      expect(deleteQuery.delete).toHaveBeenCalled();
    });
  });
});
