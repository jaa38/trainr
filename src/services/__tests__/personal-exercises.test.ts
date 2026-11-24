import { supabase } from '@/lib/supabase';

import {
  archivePersonalExercise,
  createPersonalExercise,
  getPersonalExerciseById,
  getPersonalExercises,
  restorePersonalExercise,
  updatePersonalExercise,
} from '../personal-exercises';

import type { PersonalExercise } from '@/types/personal-workouts';

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

const mockExercise: PersonalExercise = {
  id: 'exercise-123',
  user_id: 'user-123',
  name: 'Barbell Squat',
  description: 'Compound lower-body exercise',
  category: 'strength',
  muscle_group: 'Quadriceps',
  equipment: ['Barbell', 'Weight plates'],
  instructions: 'Maintain a neutral spine.',
  archived_at: null,
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

  ['select', 'insert', 'update', 'delete', 'eq', 'is', 'not', 'order'].forEach(
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

describe('Personal Exercises service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getPersonalExercises', () => {
    it('retrieves active exercises belonging to the authenticated user', async () => {
      const query = createQuery({
        data: [mockExercise],
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalExercises()).resolves.toEqual([mockExercise]);

      expect(mockedFrom).toHaveBeenCalledWith('personal_exercises');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.is).toHaveBeenCalledWith('archived_at', null);
      expect(query.order).toHaveBeenCalledWith('name', {
        ascending: true,
      });
    });

    it('includes archived exercises when requested', async () => {
      const query = createQuery({
        data: [mockExercise],
        error: null,
      });

      queueQueries(query);

      await getPersonalExercises({ includeArchived: true });

      expect(query.is).not.toHaveBeenCalledWith('archived_at', null);
    });

    it('returns an empty array when no exercises exist', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalExercises()).resolves.toEqual([]);
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(getPersonalExercises()).rejects.toThrow('Please sign in to continue.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      const query = createQuery({
        data: null,
        error: { message: 'Database error' },
      });

      queueQueries(query);

      await expect(getPersonalExercises()).rejects.toThrow(
        'Unable to load personal exercises. Please try again.',
      );
    });
  });

  describe('getPersonalExerciseById', () => {
    it('retrieves an exercise using its ID and authenticated owner ID', async () => {
      const query = createQuery({
        data: mockExercise,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalExerciseById('exercise-123')).resolves.toEqual(
        mockExercise,
      );

      expect(query.eq).toHaveBeenCalledWith('id', 'exercise-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('rejects an empty exercise ID', async () => {
      await expect(getPersonalExerciseById('  ')).rejects.toThrow(
        'An exercise ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the exercise does not exist or is not owned by the user', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalExerciseById('exercise-456')).rejects.toThrow(
        'Personal exercise not found.',
      );
    });
  });

  describe('createPersonalExercise', () => {
    it('creates a personal exercise for the authenticated user', async () => {
      const query = createQuery({
        data: mockExercise,
        error: null,
      });

      queueQueries(query);

      await expect(
        createPersonalExercise({
          name: ' Barbell Squat ',
          category: 'strength',
          muscle_group: ' Quadriceps ',
          equipment: [' Barbell ', 'Weight plates', ' '],
        }),
      ).resolves.toEqual(mockExercise);

      expect(mockedFrom).toHaveBeenCalledWith('personal_exercises');

      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          name: 'Barbell Squat',
          category: 'strength',
          muscle_group: 'Quadriceps',
          equipment: ['Barbell', 'Weight plates'],
        }),
      );
    });

    it('rejects an empty exercise name', async () => {
      await expect(
        createPersonalExercise({
          name: '  ',
          category: 'strength',
        }),
      ).rejects.toThrow('Exercise name is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an exercise name longer than 120 characters', async () => {
      await expect(
        createPersonalExercise({
          name: 'A'.repeat(121),
          category: 'strength',
        }),
      ).rejects.toThrow('Exercise name must be 120 characters or fewer.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an invalid exercise category', async () => {
      await expect(
        createPersonalExercise({
          name: 'Test exercise',
          category: 'invalid' as never,
        }),
      ).rejects.toThrow('Please select a valid exercise category.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      const query = createQuery({
        data: null,
        error: { message: 'Database error' },
      });

      queueQueries(query);

      await expect(
        createPersonalExercise({
          name: 'Barbell Squat',
          category: 'strength',
        }),
      ).rejects.toThrow('Unable to create personal exercise. Please try again.');
    });
  });

  describe('updatePersonalExercise', () => {
    it('updates an active personal exercise', async () => {
      const query = createQuery({
        data: { ...mockExercise, name: 'Front Squat' },
        error: null,
      });

      queueQueries(query);

      await expect(
        updatePersonalExercise('exercise-123', {
          name: 'Front Squat',
        }),
      ).resolves.toMatchObject({
        name: 'Front Squat',
      });

      expect(query.eq).toHaveBeenCalledWith('id', 'exercise-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.is).toHaveBeenCalledWith('archived_at', null);
      expect(query.update).toHaveBeenCalledWith({
        name: 'Front Squat',
      });
    });

    it('rejects an empty update', async () => {
      await expect(updatePersonalExercise('exercise-123', {})).rejects.toThrow(
        'Please provide at least one field to update.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an invalid category', async () => {
      await expect(
        updatePersonalExercise('exercise-123', {
          category: 'invalid' as never,
        }),
      ).rejects.toThrow('Please select a valid exercise category.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the exercise does not exist or is archived', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(
        updatePersonalExercise('exercise-123', {
          name: 'Front Squat',
        }),
      ).rejects.toThrow('Personal exercise not found or it is no longer active.');
    });
  });

  describe('archivePersonalExercise', () => {
    it('archives an active personal exercise', async () => {
      const archivedExercise = {
        ...mockExercise,
        archived_at: '2026-11-24T10:00:00.000Z',
      };

      const query = createQuery({
        data: archivedExercise,
        error: null,
      });

      queueQueries(query);

      await expect(archivePersonalExercise('exercise-123')).resolves.toEqual(
        archivedExercise,
      );

      expect(query.eq).toHaveBeenCalledWith('id', 'exercise-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.is).toHaveBeenCalledWith('archived_at', null);
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: expect.any(String),
        }),
      );
    });

    it('rejects an exercise that is already archived or missing', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(archivePersonalExercise('exercise-123')).rejects.toThrow(
        'Personal exercise not found or it has already been archived.',
      );
    });
  });

  describe('restorePersonalExercise', () => {
    it('restores an archived personal exercise', async () => {
      const query = createQuery({
        data: mockExercise,
        error: null,
      });

      queueQueries(query);

      await expect(restorePersonalExercise('exercise-123')).resolves.toEqual(
        mockExercise,
      );

      expect(query.eq).toHaveBeenCalledWith('id', 'exercise-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.not).toHaveBeenCalledWith('archived_at', 'is', null);
      expect(query.update).toHaveBeenCalledWith({
        archived_at: null,
      });
    });

    it('throws when no archived exercise is found', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(restorePersonalExercise('exercise-123')).rejects.toThrow(
        'Archived personal exercise not found.',
      );
    });
  });
});
