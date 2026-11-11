import { supabase } from '@/lib/supabase';
import {
  getTrainerSessionNotes,
  getTrainerSessionNote,
  createTrainerSessionNote,
  updateTrainerSessionNote,
  type TrainerSessionNote,
} from '../trainer-session-notes';

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
  id: 'trainer-123',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

const mockNote: TrainerSessionNote = {
  id: 'note-123',
  booking_id: 'booking-123',
  trainer_id: 'trainer-123',
  gym_goer_id: 'client-123',
  session_summary: 'Completed strength training session.',
  observations: 'Improved squat technique.',
  recommendations: 'Increase resistance gradually.',
  created_at: '2026-11-11T08:00:00.000Z',
  updated_at: '2026-11-11T08:00:00.000Z',
};

function mockListQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(response);
  query.maybeSingle.mockResolvedValue(response);

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

function mockBookingQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(response);

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

function mockInsertQuery(response: { data: unknown; error: unknown }) {
  const query = {
    insert: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };

  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(response);

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

function mockUpdateQuery(response: { data: unknown; error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    maybeSingle: jest.fn(),
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(response);

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

describe('Trainer session notes service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getTrainerSessionNotes', () => {
    it('retrieves session notes for a client', async () => {
      const query = mockListQuery({
        data: [mockNote],
        error: null,
      });

      await expect(
        getTrainerSessionNotes('client-123'),
      ).resolves.toEqual([mockNote]);

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_notes');
      expect(query.eq).toHaveBeenNthCalledWith(1, 'trainer_id', 'trainer-123');
      expect(query.eq).toHaveBeenNthCalledWith(2, 'gym_goer_id', 'client-123');
    });

    it('returns an empty array when no notes exist', async () => {
      mockListQuery({ data: null, error: null });

      await expect(
        getTrainerSessionNotes('client-123'),
      ).resolves.toEqual([]);
    });

    it('rejects an empty client ID', async () => {
      await expect(getTrainerSessionNotes('')).rejects.toThrow(
        'A valid client is required.',
      );

      expect(mockedGetUser).not.toHaveBeenCalled();
    });

    it('throws when the database query fails', async () => {
      mockListQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        getTrainerSessionNotes('client-123'),
      ).rejects.toThrow(
        'Unable to load session notes. Please try again.',
      );
    });
  });

  describe('getTrainerSessionNote', () => {
    it('retrieves notes for a booking', async () => {
      const query = mockListQuery({
        data: mockNote,
        error: null,
      });

      await expect(
        getTrainerSessionNote('booking-123'),
      ).resolves.toEqual(mockNote);

      expect(mockedFrom).toHaveBeenCalledWith('trainer_session_notes');
      expect(query.eq).toHaveBeenNthCalledWith(1, 'booking_id', 'booking-123');
      expect(query.eq).toHaveBeenNthCalledWith(2, 'trainer_id', 'trainer-123');
    });

    it('returns null when no note exists', async () => {
      mockListQuery({ data: null, error: null });

      await expect(
        getTrainerSessionNote('booking-123'),
      ).resolves.toBeNull();
    });

    it('rejects an empty booking ID', async () => {
      await expect(getTrainerSessionNote('')).rejects.toThrow(
        'A valid booking ID is required.',
      );

      expect(mockedGetUser).not.toHaveBeenCalled();
    });
  });

  describe('createTrainerSessionNote', () => {
    const validInput = {
      bookingId: 'booking-123',
      gymGoerId: 'client-123',
      sessionSummary: '  Completed strength training session.  ',
      observations: '  Improved squat technique.  ',
      recommendations: '  Increase resistance gradually.  ',
    };

    it('creates notes for a completed booking owned by the trainer', async () => {
      const bookingQuery = mockBookingQuery({
        data: {
          id: 'booking-123',
          trainer_id: 'trainer-123',
          gym_goer_id: 'client-123',
          status: 'completed',
        },
        error: null,
      });

      const insertQuery = mockInsertQuery({
        data: mockNote,
        error: null,
      });

      await expect(
        createTrainerSessionNote(validInput),
      ).resolves.toEqual(mockNote);

      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'trainer_bookings');
      expect(bookingQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'booking-123');
      expect(bookingQuery.eq).toHaveBeenNthCalledWith(2, 'trainer_id', 'trainer-123');
      expect(bookingQuery.eq).toHaveBeenNthCalledWith(3, 'gym_goer_id', 'client-123');

      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'trainer_session_notes');
      expect(insertQuery.insert).toHaveBeenCalledWith({
        booking_id: 'booking-123',
        trainer_id: 'trainer-123',
        gym_goer_id: 'client-123',
        session_summary: 'Completed strength training session.',
        observations: 'Improved squat technique.',
        recommendations: 'Increase resistance gradually.',
      });
    });

    it('rejects an empty booking ID', async () => {
      await expect(
        createTrainerSessionNote({ ...validInput, bookingId: '' }),
      ).rejects.toThrow('A valid booking ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty client ID', async () => {
      await expect(
        createTrainerSessionNote({ ...validInput, gymGoerId: '' }),
      ).rejects.toThrow('A valid client is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty session summary', async () => {
      await expect(
        createTrainerSessionNote({ ...validInput, sessionSummary: '  ' }),
      ).rejects.toThrow('Session summary cannot be empty.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects a booking that does not belong to the trainer and client', async () => {
      mockBookingQuery({ data: null, error: null });

      await expect(
        createTrainerSessionNote(validInput),
      ).rejects.toThrow(
        'Session not found or you are not authorised to access it.',
      );
    });

    it('rejects a session that has not been completed', async () => {
      mockBookingQuery({
        data: {
          id: 'booking-123',
          trainer_id: 'trainer-123',
          gym_goer_id: 'client-123',
          status: 'confirmed',
        },
        error: null,
      });

      await expect(
        createTrainerSessionNote(validInput),
      ).rejects.toThrow(
        'Session notes can only be created for completed sessions.',
      );

      expect(mockedFrom).toHaveBeenCalledTimes(1);
    });

    it('throws when booking verification fails', async () => {
      mockBookingQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        createTrainerSessionNote(validInput),
      ).rejects.toThrow(
        'Unable to verify this session. Please try again.',
      );
    });

    it('throws when notes cannot be saved', async () => {
      mockBookingQuery({
        data: {
          id: 'booking-123',
          trainer_id: 'trainer-123',
          gym_goer_id: 'client-123',
          status: 'completed',
        },
        error: null,
      });

      mockInsertQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        createTrainerSessionNote(validInput),
      ).rejects.toThrow(
        'Unable to save session notes. Please try again.',
      );
    });
  });

  describe('updateTrainerSessionNote', () => {
    it('updates notes written by the authenticated trainer', async () => {
      const query = mockUpdateQuery({
        data: mockNote,
        error: null,
      });

      await expect(
        updateTrainerSessionNote('note-123', {
          sessionSummary: '  Updated session summary.  ',
          observations: '  Better form.  ',
          recommendations: '  Continue progression.  ',
        }),
      ).resolves.toEqual(mockNote);

      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          session_summary: 'Updated session summary.',
          observations: 'Better form.',
          recommendations: 'Continue progression.',
        }),
      );

      expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'note-123');
      expect(query.eq).toHaveBeenNthCalledWith(2, 'trainer_id', 'trainer-123');
    });

    it('rejects an empty note ID', async () => {
      await expect(
        updateTrainerSessionNote('', {
          sessionSummary: 'Updated summary.',
        }),
      ).rejects.toThrow('A valid session note ID is required.');

      expect(mockedGetUser).not.toHaveBeenCalled();
    });

    it('rejects an empty session summary', async () => {
      await expect(
        updateTrainerSessionNote('note-123', {
          sessionSummary: '  ',
        }),
      ).rejects.toThrow('Session summary cannot be empty.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the note cannot be found or edited', async () => {
      mockUpdateQuery({ data: null, error: null });

      await expect(
        updateTrainerSessionNote('note-123', {
          sessionSummary: 'Updated summary.',
        }),
      ).rejects.toThrow(
        'Session note not found or you are not authorised to edit it.',
      );
    });

    it('throws when the database update fails', async () => {
      mockUpdateQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        updateTrainerSessionNote('note-123', {
          sessionSummary: 'Updated summary.',
        }),
      ).rejects.toThrow(
        'Unable to update session notes. Please try again.',
      );
    });
  });
});
