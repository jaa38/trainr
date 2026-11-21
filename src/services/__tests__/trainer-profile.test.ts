import { supabase } from '@/lib/supabase';

import {
  getTrainerSpecialities,
  TRAINER_SPECIALITY_OPTIONS,
  updateTrainerSpecialities,
} from '../trainer-profile';

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

const trainerId = 'trainer-123';

const mockUser = {
  id: trainerId,
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

const validSpecialities = ['Strength training', 'Weight loss'];

function mockGetSpecialitiesQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

function mockUpdateSpecialitiesQuery(response: { data: unknown; error: unknown }) {
  const query = {
    upsert: jest.fn(),
  };

  query.upsert.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe('Trainer profile specialities service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getTrainerSpecialities', () => {
    it('retrieves saved specialities for the authenticated trainer', async () => {
      const query = mockGetSpecialitiesQuery({
        data: {
          specialities: validSpecialities,
        },
        error: null,
      });

      await expect(getTrainerSpecialities(trainerId)).resolves.toEqual(validSpecialities);

      expect(mockedGetUser).toHaveBeenCalled();
      expect(mockedFrom).toHaveBeenCalledWith('trainer_profiles');
      expect(query.select).toHaveBeenCalledWith('specialities');
      expect(query.eq).toHaveBeenCalledWith('user_id', trainerId);
    });

    it('returns an empty array when no specialities exist', async () => {
      mockGetSpecialitiesQuery({
        data: null,
        error: null,
      });

      await expect(getTrainerSpecialities(trainerId)).resolves.toEqual([]);
    });

    it('throws when the database query fails', async () => {
      mockGetSpecialitiesQuery({
        data: null,
        error: new Error('Permission denied'),
      });

      await expect(getTrainerSpecialities(trainerId)).rejects.toThrow(
        'Permission denied',
      );
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(getTrainerSpecialities(trainerId)).rejects.toThrow(
        'You can only manage your own trainer profile.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects access to another trainer profile', async () => {
      mockedGetUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            id: 'another-trainer',
          },
        },
        error: null,
      } as never);

      await expect(getTrainerSpecialities(trainerId)).rejects.toThrow(
        'You can only manage your own trainer profile.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when authentication lookup fails', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed'),
      } as never);

      await expect(getTrainerSpecialities(trainerId)).rejects.toThrow(
        'Authentication failed',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateTrainerSpecialities', () => {
    it('saves valid specialities for the authenticated trainer', async () => {
      const query = mockUpdateSpecialitiesQuery({
        data: null,
        error: null,
      });

      await expect(
        updateTrainerSpecialities(trainerId, validSpecialities),
      ).resolves.toBeUndefined();

      expect(mockedGetUser).toHaveBeenCalled();
      expect(mockedFrom).toHaveBeenCalledWith('trainer_profiles');

      expect(query.upsert).toHaveBeenCalledWith(
        {
          user_id: trainerId,
          specialities: validSpecialities,
          updated_at: expect.any(String),
        },
        { onConflict: 'user_id' },
      );
    });

    it('removes duplicate specialities before saving', async () => {
      const query = mockUpdateSpecialitiesQuery({
        data: null,
        error: null,
      });

      await updateTrainerSpecialities(trainerId, [
        'Strength training',
        'Weight loss',
        'Strength training',
      ]);

      expect(query.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          specialities: ['Strength training', 'Weight loss'],
        }),
        { onConflict: 'user_id' },
      );
    });

    it('rejects an empty speciality selection', async () => {
      await expect(updateTrainerSpecialities(trainerId, [])).rejects.toThrow(
        'Select at least one speciality.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects unsupported specialities', async () => {
      await expect(
        updateTrainerSpecialities(trainerId, [
          'Strength training',
          'Unsupported speciality',
        ]),
      ).rejects.toThrow('One or more selected specialities are not supported.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('accepts all supported speciality options', async () => {
      mockUpdateSpecialitiesQuery({
        data: null,
        error: null,
      });

      await expect(
        updateTrainerSpecialities(trainerId, [...TRAINER_SPECIALITY_OPTIONS]),
      ).resolves.toBeUndefined();
    });

    it('rejects unauthenticated users', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        updateTrainerSpecialities(trainerId, validSpecialities),
      ).rejects.toThrow('You can only manage your own trainer profile.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects attempts to update another trainer profile', async () => {
      mockedGetUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            id: 'another-trainer',
          },
        },
        error: null,
      } as never);

      await expect(
        updateTrainerSpecialities(trainerId, validSpecialities),
      ).rejects.toThrow('You can only manage your own trainer profile.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when authentication lookup fails', async () => {
      mockedGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed'),
      } as never);

      await expect(
        updateTrainerSpecialities(trainerId, validSpecialities),
      ).rejects.toThrow('Authentication failed');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the database update fails', async () => {
      mockUpdateSpecialitiesQuery({
        data: null,
        error: new Error('Update failed'),
      });

      await expect(
        updateTrainerSpecialities(trainerId, validSpecialities),
      ).rejects.toThrow('Update failed');
    });
  });
});
