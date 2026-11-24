import { supabase } from '@/lib/supabase';

import {
  completePersonalWorkout,
  createPersonalWorkout,
  deletePersonalWorkout,
  getPersonalWorkoutById,
  getPersonalWorkoutHistory,
  updatePersonalWorkout,
} from '../personal-workouts';

import type { PersonalWorkout } from '@/types/personal-workouts';

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

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, any> = {};

  const chain = jest.fn(() => query);

  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'order', 'range'].forEach(
    (method) => {
      query[method] = chain;
    },
  );

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

describe('Personal Workouts service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('createPersonalWorkout', () => {
    it('creates a workout for the authenticated user', async () => {
      const query = createQuery({
        data: mockWorkout,
        error: null,
      });

      queueQueries(query);

      await expect(
        createPersonalWorkout({
          workout_name: 'Upper Body Strength',
          workout_type: 'strength',
          status: 'in_progress',
        }),
      ).resolves.toEqual(mockWorkout);

      expect(mockedFrom).toHaveBeenCalledWith('workouts');

      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          workout_name: 'Upper Body Strength',
          workout_type: 'strength',
          status: 'in_progress',
        }),
      );
    });

    it('rejects an empty workout name', async () => {
      await expect(
        createPersonalWorkout({
          workout_name: '  ',
          workout_type: 'strength',
        }),
      ).rejects.toThrow('Please provide a workout name.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid workout categories', async () => {
      await expect(
        createPersonalWorkout({
          workout_name: 'Test workout',
          workout_type: 'invalid' as never,
        }),
      ).rejects.toThrow('Please select a valid workout category.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        createPersonalWorkout({
          workout_name: 'Test workout',
          workout_type: 'strength',
        }),
      ).rejects.toThrow('Please sign in to continue.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(
        createPersonalWorkout({
          workout_name: 'Test workout',
          workout_type: 'strength',
        }),
      ).rejects.toThrow('Unable to create your workout. Please try again.');
    });
  });

  describe('getPersonalWorkoutHistory', () => {
    it('retrieves only the authenticated user’s workouts', async () => {
      const query = createQuery({
        data: [mockWorkout],
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalWorkoutHistory()).resolves.toEqual([mockWorkout]);

      expect(mockedFrom).toHaveBeenCalledWith('workouts');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);

      expect(query.order).toHaveBeenCalledWith('workout_date', { ascending: false });

      expect(query.range).toHaveBeenCalledWith(0, 19);
    });

    it('supports status filtering and pagination', async () => {
      const query = createQuery({
        data: [mockWorkout],
        error: null,
      });

      queueQueries(query);

      await getPersonalWorkoutHistory({
        status: 'in_progress',
        limit: 10,
        offset: 20,
      });

      expect(query.eq).toHaveBeenCalledWith('status', 'in_progress');
      expect(query.range).toHaveBeenCalledWith(20, 29);
    });

    it('returns an empty array when no workouts exist', async () => {
      queueQueries(
        createQuery({
          data: [],
          error: null,
        }),
      );

      await expect(getPersonalWorkoutHistory()).resolves.toEqual([]);
    });

    it('rejects invalid pagination limits', async () => {
      await expect(getPersonalWorkoutHistory({ limit: 0 })).rejects.toThrow(
        'History limit must be between 1 and 100.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });
  });

  describe('getPersonalWorkoutById', () => {
    it('retrieves a workout using its ID and authenticated owner ID', async () => {
      const query = createQuery({
        data: mockWorkout,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalWorkoutById('workout-123')).resolves.toEqual(mockWorkout);

      expect(query.eq).toHaveBeenCalledWith('id', 'workout-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('throws when the workout does not exist', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(getPersonalWorkoutById('missing-workout')).rejects.toThrow(
        'Workout not found.',
      );
    });
  });

  describe('updatePersonalWorkout', () => {
    it('updates the authenticated user’s workout', async () => {
      const query = createQuery({
        data: {
          ...mockWorkout,
          workout_name: 'Updated Workout',
        },
        error: null,
      });

      queueQueries(query);

      await expect(
        updatePersonalWorkout('workout-123', {
          workout_name: 'Updated Workout',
        }),
      ).resolves.toMatchObject({
        workout_name: 'Updated Workout',
      });

      expect(query.update).toHaveBeenCalledWith({
        workout_name: 'Updated Workout',
      });

      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.neq).toHaveBeenCalledWith('status', 'completed');
    });

    it('rejects an empty update', async () => {
      await expect(updatePersonalWorkout('workout-123', {})).rejects.toThrow(
        'Please provide at least one field to update.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('does not update a missing or completed workout', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(
        updatePersonalWorkout('workout-123', {
          workout_name: 'Updated Workout',
        }),
      ).rejects.toThrow('Workout not found or it has already been completed.');
    });
  });

  describe('completePersonalWorkout', () => {
    it('completes a workout and calculates its duration', async () => {
      const fetchQuery = createQuery({
        data: {
          started_at: '2026-11-24T09:00:00.000Z',
          status: 'in_progress',
        },
        error: null,
      });

      const updateQuery = createQuery({
        data: {
          ...mockWorkout,
          status: 'completed',
          completed_at: '2026-11-24T10:00:00.000Z',
          duration_seconds: 3600,
        },
        error: null,
      });

      queueQueries(fetchQuery, updateQuery);

      await expect(
        completePersonalWorkout('workout-123', {
          completed_at: '2026-11-24T10:00:00.000Z',
        }),
      ).resolves.toMatchObject({
        status: 'completed',
        duration_seconds: 3600,
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: '2026-11-24T10:00:00.000Z',
        duration_seconds: 3600,
      });

      expect(updateQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('rejects an already completed workout', async () => {
      queueQueries(
        createQuery({
          data: {
            started_at: mockWorkout.started_at,
            status: 'completed',
          },
          error: null,
        }),
      );

      await expect(completePersonalWorkout('workout-123')).rejects.toThrow(
        'This workout has already been completed.',
      );
    });

    it('rejects a completion time before the start time', async () => {
      queueQueries(
        createQuery({
          data: {
            started_at: '2026-11-24T10:00:00.000Z',
            status: 'in_progress',
          },
          error: null,
        }),
      );

      await expect(
        completePersonalWorkout('workout-123', {
          completed_at: '2026-11-24T09:00:00.000Z',
        }),
      ).rejects.toThrow('Completion time cannot be before the workout start time.');
    });
  });

  describe('deletePersonalWorkout', () => {
    it('deletes a workout belonging to the authenticated user', async () => {
      const query = createQuery({
        data: { id: 'workout-123' },
        error: null,
      });

      queueQueries(query);

      await expect(deletePersonalWorkout('workout-123')).resolves.toBeUndefined();

      expect(query.delete).toHaveBeenCalled();
      expect(query.eq).toHaveBeenCalledWith('id', 'workout-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('throws when the workout does not exist', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(deletePersonalWorkout('missing-workout')).rejects.toThrow(
        'Workout not found.',
      );
    });
  });
});
