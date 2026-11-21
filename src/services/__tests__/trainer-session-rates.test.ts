import { supabase } from '@/lib/supabase';

import {
  createTrainerSessionRate,
  deleteTrainerSessionRate,
  getTrainerSessionRateById,
  getTrainerSessionRates,
  setTrainerSessionRateDefault,
  type TrainerSessionRate,
  updateTrainerSessionRate,
} from '../trainer-session-rates';

import type { TrainerSessionRateFormValues } from '@/schemas/trainer-session-rates';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockedGetUser = jest.mocked(supabase.auth.getUser);
const mockedFrom = jest.mocked(supabase.from);
const mockedRpc = jest.mocked(supabase.rpc);

const trainerId = 'trainer-123';
const rateId = 'rate-123';

const mockUser = {
  id: trainerId,
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

const validValues: TrainerSessionRateFormValues = {
  sessionType: 'one_to_one',
  sessionDurationMinutes: 60,
  sessionRate: 15000,
  currency: 'NGN',
  trainingFormat: 'in_person',
  status: 'active',
};

const mockRate: TrainerSessionRate = {
  id: rateId,
  trainer_id: trainerId,
  session_type: 'one_to_one',
  session_duration_minutes: 60,
  session_rate: 15000,
  currency: 'NGN',
  training_format: 'in_person',
  status: 'active',
  is_default: false,
  requires_confirmation: false,
  sort_order: 0,
  created_at: '2026-11-20T10:00:00.000Z',
  updated_at: '2026-11-20T10:00:00.000Z',
};

function mockGetRatesQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  query.order.mockReturnValueOnce(query).mockResolvedValueOnce(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

function mockInsertRateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    insert: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };

  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

function mockUpdateRateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

function mockDeleteRateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    delete: jest.fn(),
    eq: jest.fn(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };

  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

function mockSingleRateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe('Trainer session rates service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);

    mockedRpc.mockResolvedValue({
      data: null,
      error: null,
    } as never);
  });

  describe('getTrainerSessionRates', () => {
    it('retrieves session rates for a trainer', async () => {
      const query = mockGetRatesQuery({
        data: [mockRate],
        error: null,
      });

      await expect(getTrainerSessionRates(trainerId)).resolves.toEqual([mockRate]);

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_rates');
      expect(query.eq).toHaveBeenCalledWith('trainer_id', trainerId);
      expect(query.order).toHaveBeenNthCalledWith(1, 'sort_order', {
        ascending: true,
      });
      expect(query.order).toHaveBeenNthCalledWith(2, 'created_at', {
        ascending: true,
      });
    });

    it('returns an empty array when no rates exist', async () => {
      mockGetRatesQuery({
        data: null,
        error: null,
      });

      await expect(getTrainerSessionRates(trainerId)).resolves.toEqual([]);
    });

    it('throws when the database query fails', async () => {
      mockGetRatesQuery({
        data: null,
        error: new Error('Permission denied'),
      });

      await expect(getTrainerSessionRates(trainerId)).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  describe('createTrainerSessionRate', () => {
    it('creates a confirmed session rate', async () => {
      const query = mockInsertRateQuery({
        data: mockRate,
        error: null,
      });

      await expect(createTrainerSessionRate(trainerId, validValues)).resolves.toEqual(
        mockRate,
      );

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_rates');

      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trainer_id: trainerId,
          session_type: validValues.sessionType,
          session_duration_minutes: validValues.sessionDurationMinutes,
          session_rate: validValues.sessionRate,
          currency: validValues.currency,
          training_format: validValues.trainingFormat,
          status: validValues.status,
          requires_confirmation: false,
          is_default: false,
          sort_order: 0,
          updated_at: expect.any(String),
        }),
      );
    });

    it('sets a newly created rate as default when requested', async () => {
      const createdRate = {
        ...mockRate,
        is_default: false,
      };

      const defaultRate = {
        ...mockRate,
        is_default: true,
      };

      const insertQuery = {
        insert: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
      };

      insertQuery.insert.mockReturnValue(insertQuery);
      insertQuery.select.mockReturnValue(insertQuery);
      insertQuery.single.mockResolvedValue({
        data: createdRate,
        error: null,
      });

      const lookupQuery = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
      };

      lookupQuery.select.mockReturnValue(lookupQuery);
      lookupQuery.eq.mockReturnValue(lookupQuery);
      lookupQuery.single.mockResolvedValue({
        data: defaultRate,
        error: null,
      });

      mockedFrom
        .mockReturnValueOnce(insertQuery as never)
        .mockReturnValueOnce(lookupQuery as never);

      await expect(
        createTrainerSessionRate(trainerId, validValues, true),
      ).resolves.toEqual(defaultRate);

      expect(mockedRpc).toHaveBeenCalledWith('set_trainer_session_rate_default', {
        p_rate_id: rateId,
      });

      expect(mockedFrom).toHaveBeenCalledTimes(2);
    });

    it('throws when creation fails', async () => {
      mockInsertRateQuery({
        data: null,
        error: new Error('Insert failed'),
      });

      await expect(createTrainerSessionRate(trainerId, validValues)).rejects.toThrow(
        'Insert failed',
      );
    });
  });

  describe('updateTrainerSessionRate', () => {
    it('updates an existing rate and confirms it', async () => {
      const query = mockUpdateRateQuery({
        data: mockRate,
        error: null,
      });

      await expect(
        updateTrainerSessionRate(trainerId, rateId, validValues),
      ).resolves.toEqual(mockRate);

      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          session_type: validValues.sessionType,
          session_duration_minutes: validValues.sessionDurationMinutes,
          session_rate: validValues.sessionRate,
          currency: validValues.currency,
          training_format: validValues.trainingFormat,
          status: validValues.status,
          requires_confirmation: false,
          updated_at: expect.any(String),
        }),
      );

      expect(query.eq).toHaveBeenNthCalledWith(1, 'id', rateId);
      expect(query.eq).toHaveBeenNthCalledWith(2, 'trainer_id', trainerId);
    });

    it('throws when the update fails', async () => {
      mockUpdateRateQuery({
        data: null,
        error: new Error('Update failed'),
      });

      await expect(
        updateTrainerSessionRate(trainerId, rateId, validValues),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteTrainerSessionRate', () => {
    it('deletes a rate belonging to the trainer', async () => {
      const query = mockDeleteRateQuery({
        data: null,
        error: null,
      });

      await expect(deleteTrainerSessionRate(trainerId, rateId)).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_rates');
      expect(query.delete).toHaveBeenCalled();
      expect(query.eq).toHaveBeenNthCalledWith(1, 'id', rateId);
      expect(query.eq).toHaveBeenNthCalledWith(2, 'trainer_id', trainerId);
    });

    it('throws when deletion fails', async () => {
      mockDeleteRateQuery({
        data: null,
        error: new Error('Delete failed'),
      });

      await expect(deleteTrainerSessionRate(trainerId, rateId)).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('setTrainerSessionRateDefault', () => {
    it('sets a confirmed rate as the default through the RPC', async () => {
      await expect(
        setTrainerSessionRateDefault(trainerId, rateId),
      ).resolves.toBeUndefined();

      expect(mockedGetUser).toHaveBeenCalled();

      expect(mockedRpc).toHaveBeenCalledWith('set_trainer_session_rate_default', {
        p_rate_id: rateId,
      });
    });

    it('rejects when no user is authenticated', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(setTrainerSessionRateDefault(trainerId, rateId)).rejects.toThrow(
        'You can only manage your own session rates.',
      );

      expect(mockedRpc).not.toHaveBeenCalled();
    });

    it('rejects when the authenticated user does not own the rates', async () => {
      mockedGetUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            id: 'another-trainer',
          },
        },
        error: null,
      } as never);

      await expect(setTrainerSessionRateDefault(trainerId, rateId)).rejects.toThrow(
        'You can only manage your own session rates.',
      );

      expect(mockedRpc).not.toHaveBeenCalled();
    });

    it('throws when authentication lookup fails', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed'),
      } as never);

      await expect(setTrainerSessionRateDefault(trainerId, rateId)).rejects.toThrow(
        'Authentication failed',
      );

      expect(mockedRpc).not.toHaveBeenCalled();
    });

    it('throws when the default-rate RPC fails', async () => {
      mockedRpc.mockResolvedValue({
        data: null,
        error: new Error('Default selection failed'),
      } as never);

      await expect(setTrainerSessionRateDefault(trainerId, rateId)).rejects.toThrow(
        'Default selection failed',
      );
    });
  });

  describe('getTrainerSessionRateById', () => {
    it('retrieves a rate by ID and trainer ID', async () => {
      const query = mockSingleRateQuery({
        data: mockRate,
        error: null,
      });

      await expect(getTrainerSessionRateById(trainerId, rateId)).resolves.toEqual(
        mockRate,
      );

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_rates');
      expect(query.eq).toHaveBeenNthCalledWith(1, 'id', rateId);
      expect(query.eq).toHaveBeenNthCalledWith(2, 'trainer_id', trainerId);
    });

    it('throws when the rate cannot be retrieved', async () => {
      mockSingleRateQuery({
        data: null,
        error: new Error('Rate not found'),
      });

      await expect(getTrainerSessionRateById(trainerId, rateId)).rejects.toThrow(
        'Rate not found',
      );
    });
  });
});
