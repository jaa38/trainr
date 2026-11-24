import { supabase } from '@/lib/supabase';

import {
  completeFitnessGoal,
  createFitnessGoal,
  deleteFitnessGoal,
  getFitnessGoalById,
  getFitnessGoals,
  updateFitnessGoal,
} from '../fitness-goals';

import type { FitnessGoal } from '@/types/personal-workouts';

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

const mockGoal: FitnessGoal = {
  id: 'goal-123',
  user_id: 'user-123',
  goal_type: 'strength_target',
  goal_name: 'Bench Press Target',
  description: 'Improve bench press strength',
  target_value: 100,
  measurement_unit: 'kg',
  start_date: '2026-11-01',
  target_date: '2027-02-01',
  goal_status: 'active',
  created_at: '2026-11-01T08:00:00.000Z',
  updated_at: '2026-11-01T08:00:00.000Z',
};

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, any> = {};

  const chain = jest.fn(() => query);

  ['select', 'insert', 'update', 'delete', 'eq', 'order'].forEach((method) => {
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

describe('Fitness Goals service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getFitnessGoals', () => {
    it('retrieves the authenticated user’s goals', async () => {
      const query = createQuery({
        data: [mockGoal],
        error: null,
      });

      queueQueries(query);

      await expect(getFitnessGoals()).resolves.toEqual([mockGoal]);

      expect(mockedFrom).toHaveBeenCalledWith('fitness_goals');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.order).toHaveBeenCalledWith('start_date', {
        ascending: false,
      });
      expect(query.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('filters goals by status', async () => {
      const query = createQuery({
        data: [mockGoal],
        error: null,
      });

      queueQueries(query);

      await expect(getFitnessGoals({ status: 'active' })).resolves.toEqual([mockGoal]);

      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.eq).toHaveBeenCalledWith('goal_status', 'active');
    });

    it('returns an empty array when the user has no goals', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(getFitnessGoals()).resolves.toEqual([]);
    });

    it('rejects an invalid status filter', async () => {
      await expect(getFitnessGoals({ status: 'invalid' as never })).rejects.toThrow(
        'Please select a valid fitness goal status.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(getFitnessGoals()).rejects.toThrow('Please sign in to continue.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(getFitnessGoals()).rejects.toThrow(
        'Unable to load your fitness goals. Please try again.',
      );
    });
  });

  describe('getFitnessGoalById', () => {
    it('retrieves a goal belonging to the authenticated user', async () => {
      const query = createQuery({
        data: mockGoal,
        error: null,
      });

      queueQueries(query);

      await expect(getFitnessGoalById('goal-123')).resolves.toEqual(mockGoal);

      expect(mockedFrom).toHaveBeenCalledWith('fitness_goals');
      expect(query.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.maybeSingle).toHaveBeenCalled();
    });

    it('rejects an empty goal ID', async () => {
      await expect(getFitnessGoalById(' ')).rejects.toThrow(
        'A valid fitness goal ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the goal does not exist or belong to the user', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(getFitnessGoalById('goal-123')).rejects.toThrow(
        'Fitness goal not found.',
      );
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(getFitnessGoalById('goal-123')).rejects.toThrow(
        'Unable to load your fitness goal. Please try again.',
      );
    });
  });

  describe('createFitnessGoal', () => {
    const validInput = {
      goal_type: 'strength_target' as const,
      goal_name: 'Bench Press Target',
      description: 'Improve bench press strength',
      target_value: 100,
      measurement_unit: 'kg',
      start_date: '2026-11-01',
      target_date: '2027-02-01',
    };

    it('creates a goal for the authenticated user', async () => {
      const query = createQuery({
        data: mockGoal,
        error: null,
      });

      queueQueries(query);

      await expect(createFitnessGoal(validInput)).resolves.toEqual(mockGoal);

      expect(mockedFrom).toHaveBeenCalledWith('fitness_goals');
      expect(query.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        goal_type: 'strength_target',
        goal_name: 'Bench Press Target',
        description: 'Improve bench press strength',
        target_value: 100,
        measurement_unit: 'kg',
        start_date: '2026-11-01',
        target_date: '2027-02-01',
      });
      expect(query.single).toHaveBeenCalled();
    });

    it('trims goal names and descriptions', async () => {
      const query = createQuery({
        data: mockGoal,
        error: null,
      });

      queueQueries(query);

      await createFitnessGoal({
        ...validInput,
        goal_name: '  Bench Press Target  ',
        description: '  Improve strength  ',
      });

      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_name: 'Bench Press Target',
          description: 'Improve strength',
        }),
      );
    });

    it('uses database defaults when optional dates are omitted', async () => {
      const query = createQuery({
        data: mockGoal,
        error: null,
      });

      queueQueries(query);

      await createFitnessGoal({
        goal_type: 'workout_frequency',
        goal_name: 'Weekly workouts',
        target_value: 4,
      });

      expect(query.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        goal_type: 'workout_frequency',
        goal_name: 'Weekly workouts',
        description: null,
        target_value: 4,
        measurement_unit: null,
      });
    });

    it('rejects an invalid goal type', async () => {
      await expect(
        createFitnessGoal({
          ...validInput,
          goal_type: 'invalid' as never,
        }),
      ).rejects.toThrow('Please select a valid fitness goal type.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty goal name', async () => {
      await expect(
        createFitnessGoal({
          ...validInput,
          goal_name: '  ',
        }),
      ).rejects.toThrow('Please provide a fitness goal name.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects zero, negative and non-finite target values', async () => {
      for (const targetValue of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expect(
          createFitnessGoal({
            ...validInput,
            target_value: targetValue,
          }),
        ).rejects.toThrow('Goal target must be a positive number.');
      }

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid calendar dates', async () => {
      await expect(
        createFitnessGoal({
          ...validInput,
          start_date: '2026-02-30',
        }),
      ).rejects.toThrow('Please provide a valid goal start date.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects a target date before the start date', async () => {
      await expect(
        createFitnessGoal({
          ...validInput,
          start_date: '2027-02-01',
          target_date: '2027-01-01',
        }),
      ).rejects.toThrow('Goal target date cannot be before its start date.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(createFitnessGoal(validInput)).rejects.toThrow(
        'Please sign in to continue.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(createFitnessGoal(validInput)).rejects.toThrow(
        'Unable to create your fitness goal. Please try again.',
      );
    });
  });

  describe('updateFitnessGoal', () => {
    it('updates a goal belonging to the authenticated user', async () => {
      const updatedGoal = {
        ...mockGoal,
        goal_name: 'Updated Bench Press Target',
        target_value: 110,
      };

      const query = createQuery({
        data: updatedGoal,
        error: null,
      });

      queueQueries(query);

      await expect(
        updateFitnessGoal('goal-123', {
          goal_name: 'Updated Bench Press Target',
          target_value: 110,
        }),
      ).resolves.toEqual(updatedGoal);

      expect(query.update).toHaveBeenCalledWith({
        goal_name: 'Updated Bench Press Target',
        target_value: 110,
      });
      expect(query.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.maybeSingle).toHaveBeenCalled();
    });

    it('allows a goal to be paused', async () => {
      const query = createQuery({
        data: { ...mockGoal, goal_status: 'paused' },
        error: null,
      });

      queueQueries(query);

      await updateFitnessGoal('goal-123', {
        goal_status: 'paused',
      });

      expect(query.update).toHaveBeenCalledWith({
        goal_status: 'paused',
      });
    });

    it('rejects an empty goal ID', async () => {
      await expect(updateFitnessGoal('', { goal_name: 'Updated goal' })).rejects.toThrow(
        'A valid fitness goal ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty update', async () => {
      await expect(updateFitnessGoal('goal-123', {})).rejects.toThrow(
        'Please provide at least one field to update.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid goal statuses', async () => {
      await expect(
        updateFitnessGoal('goal-123', {
          goal_status: 'invalid' as never,
        }),
      ).rejects.toThrow('Please select a valid fitness goal status.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an invalid target value', async () => {
      await expect(
        updateFitnessGoal('goal-123', {
          target_value: -5,
        }),
      ).rejects.toThrow('Goal target must be a positive number.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an invalid date combination when both dates are supplied', async () => {
      await expect(
        updateFitnessGoal('goal-123', {
          start_date: '2027-02-01',
          target_date: '2027-01-01',
        }),
      ).rejects.toThrow('Goal target date cannot be before its start date.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects a start date later than the existing target date', async () => {
      const existingGoalQuery = createQuery({
        data: {
          start_date: mockGoal.start_date,
          target_date: mockGoal.target_date,
        },
        error: null,
      });

      queueQueries(existingGoalQuery);

      await expect(
        updateFitnessGoal('goal-123', {
          start_date: '2027-03-01',
        }),
      ).rejects.toThrow('Goal target date cannot be before its start date.');

      expect(existingGoalQuery.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(existingGoalQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('rejects a target date earlier than the existing start date', async () => {
      const existingGoalQuery = createQuery({
        data: {
          start_date: mockGoal.start_date,
          target_date: mockGoal.target_date,
        },
        error: null,
      });

      queueQueries(existingGoalQuery);

      await expect(
        updateFitnessGoal('goal-123', {
          target_date: '2026-10-01',
        }),
      ).rejects.toThrow('Goal target date cannot be before its start date.');

      expect(existingGoalQuery.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(existingGoalQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('allows clearing the target date', async () => {
      const existingGoalQuery = createQuery({
        data: {
          start_date: mockGoal.start_date,
          target_date: mockGoal.target_date,
        },
        error: null,
      });

      const updateQuery = createQuery({
        data: { ...mockGoal, target_date: null },
        error: null,
      });

      queueQueries(existingGoalQuery, updateQuery);

      await updateFitnessGoal('goal-123', {
        target_date: null,
      });

      expect(updateQuery.update).toHaveBeenCalledWith({
        target_date: null,
      });
    });

    it('throws when the goal does not exist or belong to the user', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(
        updateFitnessGoal('goal-123', { goal_name: 'Updated goal' }),
      ).rejects.toThrow('Fitness goal not found.');
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(
        updateFitnessGoal('goal-123', { goal_name: 'Updated goal' }),
      ).rejects.toThrow('Unable to update your fitness goal. Please try again.');
    });
  });

  describe('completeFitnessGoal', () => {
    it('marks the goal as completed', async () => {
      const completedGoal = {
        ...mockGoal,
        goal_status: 'completed' as const,
      };

      const query = createQuery({
        data: completedGoal,
        error: null,
      });

      queueQueries(query);

      await expect(completeFitnessGoal('goal-123')).resolves.toEqual(completedGoal);

      expect(query.update).toHaveBeenCalledWith({
        goal_status: 'completed',
      });
      expect(query.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('rejects an empty goal ID', async () => {
      await expect(completeFitnessGoal('')).rejects.toThrow(
        'A valid fitness goal ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });
  });

  describe('deleteFitnessGoal', () => {
    it('deletes a goal belonging to the authenticated user', async () => {
      const query = createQuery({
        data: { id: 'goal-123' },
        error: null,
      });

      queueQueries(query);

      await expect(deleteFitnessGoal('goal-123')).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenCalledWith('fitness_goals');
      expect(query.delete).toHaveBeenCalled();
      expect(query.eq).toHaveBeenCalledWith('id', 'goal-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.select).toHaveBeenCalledWith('id');
      expect(query.maybeSingle).toHaveBeenCalled();
    });

    it('rejects an empty goal ID', async () => {
      await expect(deleteFitnessGoal(' ')).rejects.toThrow(
        'A valid fitness goal ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(deleteFitnessGoal('goal-123')).rejects.toThrow(
        'Please sign in to continue.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the goal does not exist or belong to the user', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: null,
        }),
      );

      await expect(deleteFitnessGoal('goal-123')).rejects.toThrow(
        'Fitness goal not found.',
      );
    });

    it('handles database errors', async () => {
      queueQueries(
        createQuery({
          data: null,
          error: { message: 'Database error' },
        }),
      );

      await expect(deleteFitnessGoal('goal-123')).rejects.toThrow(
        'Unable to delete your fitness goal. Please try again.',
      );
    });
  });
});
