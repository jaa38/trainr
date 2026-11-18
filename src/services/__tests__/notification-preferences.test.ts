
import { supabase } from '@/lib/supabase';

import {
  ensureNotificationPreferences,
  getNotificationPreferences,
  updateNotificationPreference,
} from '../notifications/notification-preferences';

import type {
  NotificationPreferenceKey,
} from '../notifications/notification-preferences';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockedFrom = jest.mocked(supabase.from);

const userId = 'user-123';

const mockPreferences = {
  user_id: userId,
  booking_updates: true,
  session_reminders: true,
  workout_updates: false,
  feedback_updates: true,
  post_session_followups: false,
  created_at: '2026-11-15T09:00:00.000Z',
  updated_at: '2026-11-15T09:00:00.000Z',
};

function mockUpdateQueries(updateError: unknown = null) {
  const initialiseQuery = {
    upsert: jest.fn(),
  };

  const updateQuery = {
    update: jest.fn(),
    eq: jest.fn(),
  };

  initialiseQuery.upsert.mockResolvedValue({
    error: null,
  });

  updateQuery.update.mockReturnValue(updateQuery);

  updateQuery.eq.mockResolvedValue({
    error: updateError,
  });

  mockedFrom
    .mockReturnValueOnce(initialiseQuery as never)
    .mockReturnValueOnce(updateQuery as never);

  return {
    initialiseQuery,
    updateQuery,
  };
}

describe('notification-preferences service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureNotificationPreferences', () => {
    it('creates a default preference row without overwriting an existing row', async () => {
      const query = {
        upsert: jest.fn(),
      };

      query.upsert.mockResolvedValue({ error: null });
      mockedFrom.mockReturnValue(query as never);

      await expect(
        ensureNotificationPreferences(userId),
      ).resolves.toBeUndefined();

      expect(mockedFrom).toHaveBeenCalledWith(
        'notification_preferences',
      );

      expect(query.upsert).toHaveBeenCalledWith(
        { user_id: userId },
        {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        },
      );
    });

    it('rejects an empty user ID', async () => {
      await expect(
        ensureNotificationPreferences(' '),
      ).rejects.toThrow('A valid user ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('returns a user-friendly error when initialisation fails', async () => {
      const query = {
        upsert: jest.fn(),
      };

      query.upsert.mockResolvedValue({
        error: new Error('Database unavailable'),
      });

      mockedFrom.mockReturnValue(query as never);

      await expect(
        ensureNotificationPreferences(userId),
      ).rejects.toThrow(
        'Unable to initialise notification preferences. Please try again.',
      );
    });
  });

  describe('getNotificationPreferences', () => {
    it('retrieves saved notification preferences', async () => {
      const query = {
        upsert: jest.fn(),
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
      };

      query.upsert.mockResolvedValue({ error: null });
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);

      query.single.mockResolvedValue({
        data: mockPreferences,
        error: null,
      });

      mockedFrom.mockReturnValue(query as never);

      await expect(
        getNotificationPreferences(userId),
      ).resolves.toEqual(mockPreferences);

      expect(query.select).toHaveBeenCalledWith(
        'user_id, booking_updates, session_reminders, workout_updates, feedback_updates, post_session_followups, created_at, updated_at',
      );

      expect(query.eq).toHaveBeenCalledWith(
        'user_id',
        userId,
      );

      expect(query.single).toHaveBeenCalledTimes(1);
    });

    it('returns a user-friendly error when retrieval fails', async () => {
      const query = {
        upsert: jest.fn(),
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
      };

      query.upsert.mockResolvedValue({ error: null });
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);

      query.single.mockResolvedValue({
        data: null,
        error: new Error('Unable to retrieve preferences'),
      });

      mockedFrom.mockReturnValue(query as never);

      await expect(
        getNotificationPreferences(userId),
      ).rejects.toThrow(
        'Unable to load notification preferences. Please try again.',
      );
    });

    it('rejects an empty user ID', async () => {
      await expect(
        getNotificationPreferences(''),
      ).rejects.toThrow('A valid user ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateNotificationPreference', () => {
    it.each([
      ['booking_updates', false],
      ['session_reminders', false],
      ['workout_updates', true],
      ['feedback_updates', false],
      ['post_session_followups', true],
    ] as [NotificationPreferenceKey, boolean][])(
      'updates the %s preference to %s',
      async (preference, enabled) => {
        const { initialiseQuery, updateQuery } =
          mockUpdateQueries();

        await expect(
          updateNotificationPreference(
            userId,
            preference,
            enabled,
          ),
        ).resolves.toBeUndefined();

        expect(initialiseQuery.upsert).toHaveBeenCalledWith(
          { user_id: userId },
          {
            onConflict: 'user_id',
            ignoreDuplicates: true,
          },
        );

        expect(updateQuery.update).toHaveBeenCalledWith({
          [preference]: enabled,
        });

        expect(updateQuery.eq).toHaveBeenCalledWith(
          'user_id',
          userId,
        );

        expect(mockedFrom).toHaveBeenCalledTimes(2);
      },
    );

    it('ensures preferences exist before attempting an update', async () => {
      const { initialiseQuery, updateQuery } =
        mockUpdateQueries();

      await updateNotificationPreference(
        userId,
        'booking_updates',
        false,
      );

      expect(initialiseQuery.upsert).toHaveBeenCalledTimes(1);
      expect(updateQuery.update).toHaveBeenCalledTimes(1);

      // The preference row is initialised before the update query.
      expect(mockedFrom).toHaveBeenNthCalledWith(
        1,
        'notification_preferences',
      );

      expect(mockedFrom).toHaveBeenNthCalledWith(
        2,
        'notification_preferences',
      );
    });

    it('rejects an empty user ID without making a database request', async () => {
      await expect(
        updateNotificationPreference(
          '',
          'booking_updates',
          false,
        ),
      ).rejects.toThrow('A valid user ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('returns a user-friendly error when the update fails', async () => {
      mockUpdateQueries(
        new Error('Database update failed'),
      );

      await expect(
        updateNotificationPreference(
          userId,
          'booking_updates',
          false,
        ),
      ).rejects.toThrow(
        'Unable to save your notification preference. Please try again.',
      );
    });

    it('does not attempt an update if preference initialisation fails', async () => {
      const initialiseQuery = {
        upsert: jest.fn(),
      };

      initialiseQuery.upsert.mockResolvedValue({
        error: new Error('Database unavailable'),
      });

      mockedFrom.mockReturnValue(
        initialiseQuery as never,
      );

      await expect(
        updateNotificationPreference(
          userId,
          'booking_updates',
          false,
        ),
      ).rejects.toThrow(
        'Unable to initialise notification preferences. Please try again.',
      );

      expect(mockedFrom).toHaveBeenCalledTimes(1);
    });
  });
});
