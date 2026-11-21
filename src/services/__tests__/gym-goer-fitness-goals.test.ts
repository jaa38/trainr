import { supabase } from '@/lib/supabase';

import {
  getGymGoerFitnessGoals,
  saveGymGoerFitnessGoals,
} from '../gym-goer-fitness-goals';

import type { GymGoerFitnessGoalsFormValues } from '@/schemas/gym-goer-fitness-goals';

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

const userId = 'gym-goer-123';
const anotherUserId = 'gym-goer-456';

const mockUser = {
  id: userId,
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

const validValues: GymGoerFitnessGoalsFormValues = {
  primaryGoal: 'lose_weight',
  additionalGoals: ['build_muscle'],
  experienceLevel: 'intermediate',
  trainingPreferences: ['strength', 'cardio'],
  trainingFormat: 'online',
  trainingFrequency: 4,
  location: '',
};

function createQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
    upsert: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    in: jest.fn(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(response);

  return query;
}

function mockAuthenticatedUser() {
  mockedGetUser.mockResolvedValue({
    data: { user: mockUser },
    error: null,
  } as never);
}

describe('Gym-Goer Fitness Goals service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser();
  });

  describe('getGymGoerFitnessGoals', () => {
    it('retrieves the fitness profile and saved goals', async () => {
      const profile = {
        primary_goal: 'lose_weight',
        experience_level: 'intermediate',
        training_preferences: ['strength', 'cardio'],
        training_format: 'online',
        training_frequency: 4,
        location: null,
      };

      const profileQuery = createQuery({
        data: profile,
        error: null,
      });

      const goalsQuery = createQuery({
        data: [{ goal: 'lose_weight' }, { goal: 'build_muscle' }],
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(profileQuery as never)
        .mockReturnValueOnce(goalsQuery as never);

      await expect(getGymGoerFitnessGoals(userId)).resolves.toEqual({
        profile,
        goals: ['lose_weight', 'build_muscle'],
      });

      expect(mockedGetUser).toHaveBeenCalled();
      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'gym_goer_profiles');
      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'gym_goer_fitness_goals');

      expect(profileQuery.eq).toHaveBeenCalledWith('user_id', userId);
      expect(goalsQuery.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('returns a null profile and empty goals when no records exist', async () => {
      const profileQuery = createQuery({
        data: null,
        error: null,
      });

      const goalsQuery = createQuery({
        data: null,
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(profileQuery as never)
        .mockReturnValueOnce(goalsQuery as never);

      await expect(getGymGoerFitnessGoals(userId)).resolves.toEqual({
        profile: null,
        goals: [],
      });
    });

    it('rejects access when no user is authenticated', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(getGymGoerFitnessGoals(userId)).rejects.toThrow(
        'You can only access your own fitness preferences.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects access to another user profile', async () => {
      mockedGetUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            id: anotherUserId,
          },
        },
        error: null,
      } as never);

      await expect(getGymGoerFitnessGoals(userId)).rejects.toThrow(
        'You can only access your own fitness preferences.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when authentication lookup fails', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed'),
      } as never);

      await expect(getGymGoerFitnessGoals(userId)).rejects.toThrow(
        'Authentication failed',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the profile query fails', async () => {
      mockedFrom.mockReturnValueOnce(
        createQuery({
          data: null,
          error: new Error('Profile query failed'),
        }) as never,
      );

      mockedFrom.mockReturnValueOnce(
        createQuery({
          data: [],
          error: null,
        }) as never,
      );

      await expect(getGymGoerFitnessGoals(userId)).rejects.toThrow(
        'Profile query failed',
      );
    });

    it('throws when the fitness goals query fails', async () => {
      mockedFrom
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: new Error('Goals query failed'),
          }) as never,
        );

      await expect(getGymGoerFitnessGoals(userId)).rejects.toThrow('Goals query failed');
    });
  });

  describe('saveGymGoerFitnessGoals', () => {
    it('saves profile preferences and synchronises selected goals', async () => {
      const existingGoalsQuery = createQuery({
        data: [{ goal: 'lose_weight' }, { goal: 'improve_health' }],
        error: null,
      });

      const profileQuery = createQuery({
        data: null,
        error: null,
      });

      const insertQuery = createQuery({
        data: null,
        error: null,
      });

      const deleteQuery = createQuery({
        data: null,
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(existingGoalsQuery as never)
        .mockReturnValueOnce(profileQuery as never)
        .mockReturnValueOnce(insertQuery as never)
        .mockReturnValueOnce(deleteQuery as never);

      await expect(saveGymGoerFitnessGoals(userId, validValues)).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'gym_goer_fitness_goals');

      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'gym_goer_profiles');

      expect(profileQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          primary_goal: 'lose_weight',
          experience_level: 'intermediate',
          training_preferences: ['strength', 'cardio'],
          training_format: 'online',
          training_frequency: 4,
          location: null,
          updated_at: expect.any(String),
        }),
        { onConflict: 'user_id' },
      );

      expect(insertQuery.insert).toHaveBeenCalledWith([
        {
          user_id: userId,
          goal: 'build_muscle',
        },
      ]);

      expect(deleteQuery.delete).toHaveBeenCalled();
      expect(deleteQuery.in).toHaveBeenCalledWith('goal', ['improve_health']);
    });

    it('does not insert or delete goals when selections are unchanged', async () => {
      const existingGoalsQuery = createQuery({
        data: [{ goal: 'lose_weight' }, { goal: 'build_muscle' }],
        error: null,
      });

      const profileQuery = createQuery({
        data: null,
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(existingGoalsQuery as never)
        .mockReturnValueOnce(profileQuery as never);

      await expect(saveGymGoerFitnessGoals(userId, validValues)).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenCalledTimes(2);
    });

    it('rejects saving when no user is authenticated', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'You can only update your own fitness preferences.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects saving preferences for another user', async () => {
      mockedGetUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            id: anotherUserId,
          },
        },
        error: null,
      } as never);

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'You can only update your own fitness preferences.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when authentication lookup fails', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed'),
      } as never);

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'Authentication failed',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when existing goals cannot be retrieved', async () => {
      mockedFrom.mockReturnValueOnce(
        createQuery({
          data: null,
          error: new Error('Existing goals query failed'),
        }) as never,
      );

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'Existing goals query failed',
      );

      expect(mockedFrom).toHaveBeenCalledTimes(1);
    });

    it('throws when the profile upsert fails', async () => {
      mockedFrom
        .mockReturnValueOnce(
          createQuery({
            data: [],
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: new Error('Profile save failed'),
          }) as never,
        );

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'Profile save failed',
      );
    });

    it('throws when inserting additional goals fails', async () => {
      mockedFrom
        .mockReturnValueOnce(
          createQuery({
            data: [],
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: new Error('Goal insertion failed'),
          }) as never,
        );

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'Goal insertion failed',
      );
    });

    it('throws when deleting deselected goals fails', async () => {
      mockedFrom
        .mockReturnValueOnce(
          createQuery({
            data: [{ goal: 'lose_weight' }, { goal: 'improve_health' }],
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: null,
          }) as never,
        )
        .mockReturnValueOnce(
          createQuery({
            data: null,
            error: new Error('Goal deletion failed'),
          }) as never,
        );

      await expect(saveGymGoerFitnessGoals(userId, validValues)).rejects.toThrow(
        'Goal deletion failed',
      );
    });

    it('trims the saved location', async () => {
      const valuesWithLocation = {
        ...validValues,
        trainingFormat: 'in_person',
        location: '  Lekki, Lagos  ',
      } as GymGoerFitnessGoalsFormValues;

      const existingGoalsQuery = createQuery({
        data: [{ goal: 'lose_weight' }, { goal: 'build_muscle' }],
        error: null,
      });

      const profileQuery = createQuery({
        data: null,
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(existingGoalsQuery as never)
        .mockReturnValueOnce(profileQuery as never);

      await saveGymGoerFitnessGoals(userId, valuesWithLocation);

      expect(profileQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Lekki, Lagos',
        }),
        { onConflict: 'user_id' },
      );
    });
  });
});
