import { supabase } from '@/lib/supabase';

import {
  getPersonalRecordById,
  getPersonalRecords,
  getPersonalRecordsByExercise,
} from '../personal-records';

import type { PersonalRecord } from '@/types/personal-workouts';

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

const mockRecord: PersonalRecord = {
  id: 'record-123',
  user_id: 'user-123',
  exercise_id: 'exercise-123',
  personal_exercise_id: null,
  exercise_category: 'strength',
  source_category: 'Strength Training',
  record_type: 'max_weight',
  record_value: 100,
  measurement_unit: 'kg',
  workout_set_id: 'set-123',
  achieved_at: '2026-11-24T10:00:00.000Z',
  comparison_distance_meters: null,
};

type QueryResponse = {
  data: unknown;
  error: unknown;
};

function createQuery(response: QueryResponse) {
  const query: Record<string, any> = {};

  const chain = jest.fn(() => query);

  ['select', 'eq', 'order', 'range'].forEach((method) => {
    query[method] = chain;
  });

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

describe('Personal Records service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getPersonalRecords', () => {
    it('retrieves the authenticated user’s personal records', async () => {
      const query = createQuery({
        data: [mockRecord],
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalRecords()).resolves.toEqual([mockRecord]);

      expect(mockedFrom).toHaveBeenCalledWith('personal_records');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.order).toHaveBeenCalledWith('achieved_at', {
        ascending: false,
      });
      expect(query.range).toHaveBeenCalledWith(0, 49);
    });

    it('returns an empty array when no records exist', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalRecords()).resolves.toEqual([]);
    });

    it('filters records by record type', async () => {
      const query = createQuery({
        data: [mockRecord],
        error: null,
      });

      queueQueries(query);

      await getPersonalRecords({ record_type: 'max_weight' });

      expect(query.eq).toHaveBeenCalledWith('record_type', 'max_weight');
    });

    it('filters records by exercise category', async () => {
      const query = createQuery({
        data: [mockRecord],
        error: null,
      });

      queueQueries(query);

      await getPersonalRecords({ exercise_category: 'strength' });

      expect(query.eq).toHaveBeenCalledWith('exercise_category', 'strength');
    });

    it('supports pagination', async () => {
      const query = createQuery({
        data: [mockRecord],
        error: null,
      });

      queueQueries(query);

      await getPersonalRecords({ limit: 20, offset: 20 });

      expect(query.range).toHaveBeenCalledWith(20, 39);
    });

    it('rejects invalid record types', async () => {
      await expect(
        getPersonalRecords({ record_type: 'invalid' as never }),
      ).rejects.toThrow('Please select a valid personal record type.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid exercise categories', async () => {
      await expect(
        getPersonalRecords({ exercise_category: 'invalid' as never }),
      ).rejects.toThrow('Please select a valid exercise category.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects invalid pagination limits', async () => {
      await expect(getPersonalRecords({ limit: 101 })).rejects.toThrow(
        'Personal record limit must be between 1 and 100.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects negative offsets', async () => {
      await expect(getPersonalRecords({ offset: -1 })).rejects.toThrow(
        'Personal record offset must be a non-negative whole number.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an exercise source without an exercise ID', async () => {
      await expect(getPersonalRecords({ exerciseSource: 'personal' })).rejects.toThrow(
        'An exercise ID is required when specifying its source.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(getPersonalRecords()).rejects.toThrow('Please sign in to continue.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      const query = createQuery({
        data: null,
        error: { message: 'Database error' },
      });

      queueQueries(query);

      await expect(getPersonalRecords()).rejects.toThrow(
        'Unable to load your personal records. Please try again.',
      );
    });
  });

  describe('getPersonalRecordById', () => {
    it('retrieves a record belonging to the authenticated user', async () => {
      const query = createQuery({
        data: mockRecord,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalRecordById('record-123')).resolves.toEqual(mockRecord);

      expect(query.eq).toHaveBeenCalledWith('id', 'record-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(query.maybeSingle).toHaveBeenCalled();
    });

    it('rejects an empty record ID', async () => {
      await expect(getPersonalRecordById(' ')).rejects.toThrow(
        'Personal record ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the record does not exist or belong to the user', async () => {
      const query = createQuery({
        data: null,
        error: null,
      });

      queueQueries(query);

      await expect(getPersonalRecordById('record-123')).rejects.toThrow(
        'Personal record not found.',
      );
    });

    it('handles database errors', async () => {
      const query = createQuery({
        data: null,
        error: { message: 'Database error' },
      });

      queueQueries(query);

      await expect(getPersonalRecordById('record-123')).rejects.toThrow(
        'Unable to load this personal record. Please try again.',
      );
    });
  });

  describe('getPersonalRecordsByExercise', () => {
    it('retrieves records for a shared exercise', async () => {
      const query = createQuery({
        data: [mockRecord],
        error: null,
      });

      queueQueries(query);

      await expect(
        getPersonalRecordsByExercise('exercise-123', 'shared'),
      ).resolves.toEqual([mockRecord]);

      expect(query.eq).toHaveBeenCalledWith('exercise_id', 'exercise-123');
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('retrieves records for a personal exercise', async () => {
      const personalRecord = {
        ...mockRecord,
        exercise_id: null,
        personal_exercise_id: 'personal-exercise-123',
      };

      const query = createQuery({
        data: [personalRecord],
        error: null,
      });

      queueQueries(query);

      await expect(
        getPersonalRecordsByExercise('personal-exercise-123', 'personal'),
      ).resolves.toEqual([personalRecord]);

      expect(query.eq).toHaveBeenCalledWith(
        'personal_exercise_id',
        'personal-exercise-123',
      );
      expect(query.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('rejects an empty exercise ID', async () => {
      await expect(getPersonalRecordsByExercise('', 'shared')).rejects.toThrow(
        'Exercise ID is required.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an invalid exercise source', async () => {
      await expect(
        getPersonalRecordsByExercise('exercise-123', 'invalid' as never),
      ).rejects.toThrow('Please select a valid exercise source.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });
  });
});
