import { supabase } from '@/lib/supabase';
import {
  getTrainerFeedback,
  createTrainerFeedback,
  updateTrainerFeedback,
  type TrainerFeedback,
} from '../trainer-feedback';

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

const mockFeedback: TrainerFeedback = {
  id: 'feedback-123',
  trainer_id: 'trainer-123',
  gym_goer_id: 'client-123',
  assigned_workout_plan_id: 'assignment-123',
  workout_log_id: 'workout-123',
  feedback: 'Excellent progress this week.',
  recommendations: 'Continue increasing resistance gradually.',
  created_at: '2026-11-10T08:00:00.000Z',
  updated_at: '2026-11-10T08:00:00.000Z',
};

function mockFeedbackQuery(response: {
  data: unknown;
  error: unknown;
}) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(response);

  mockedFrom.mockReturnValue(query as never);
}

function mockCreateFeedbackQuery(response: {
  data: unknown;
  error: unknown;
}) {
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

function mockUpdateFeedbackQuery(response: {
  data: unknown;
  error: unknown;
}) {
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

  mockedFrom.mockReturnValue(query as never);

  return query;
}

describe('Trainer feedback service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  describe('getTrainerFeedback', () => {
    it('retrieves feedback for a client', async () => {
      mockFeedbackQuery({
        data: [mockFeedback],
        error: null,
      });

      await expect(
        getTrainerFeedback('client-123'),
      ).resolves.toEqual([mockFeedback]);

      expect(mockedFrom).toHaveBeenCalledWith('trainer_feedback');
    });

    it('returns an empty array when no feedback exists', async () => {
      mockFeedbackQuery({
        data: [],
        error: null,
      });

      await expect(
        getTrainerFeedback('client-123'),
      ).resolves.toEqual([]);
    });

    it('rejects an empty client ID', async () => {
      await expect(getTrainerFeedback('')).rejects.toThrow(
        'A valid client is required.',
      );

      expect(mockedGetUser).not.toHaveBeenCalled();
      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when the database query fails', async () => {
      mockFeedbackQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        getTrainerFeedback('client-123'),
      ).rejects.toThrow(
        'Unable to load client feedback. Please try again.',
      );
    });
  });

  describe('createTrainerFeedback', () => {
    it('creates feedback for a client', async () => {
      const query = mockCreateFeedbackQuery({
        data: mockFeedback,
        error: null,
      });

      await expect(
        createTrainerFeedback({
          gymGoerId: 'client-123',
          assignedWorkoutPlanId: 'assignment-123',
          workoutLogId: 'workout-123',
          feedback: '  Excellent progress this week.  ',
          recommendations: '  Continue increasing resistance gradually.  ',
        }),
      ).resolves.toEqual(mockFeedback);

      expect(query.insert).toHaveBeenCalledWith({
        trainer_id: 'trainer-123',
        gym_goer_id: 'client-123',
        assigned_workout_plan_id: 'assignment-123',
        workout_log_id: 'workout-123',
        feedback: 'Excellent progress this week.',
        recommendations: 'Continue increasing resistance gradually.',
      });
    });

    it('rejects empty feedback', async () => {
      await expect(
        createTrainerFeedback({
          gymGoerId: 'client-123',
          assignedWorkoutPlanId: 'assignment-123',
          feedback: '   ',
        }),
      ).rejects.toThrow('Feedback cannot be empty.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('requires a workout or programme reference', async () => {
      await expect(
        createTrainerFeedback({
          gymGoerId: 'client-123',
          feedback: 'Good progress.',
        }),
      ).rejects.toThrow(
        'Feedback must reference a workout or programme.',
      );

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty client ID', async () => {
      await expect(
        createTrainerFeedback({
          gymGoerId: '',
          assignedWorkoutPlanId: 'assignment-123',
          feedback: 'Good progress.',
        }),
      ).rejects.toThrow('A valid client is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when feedback cannot be saved', async () => {
      mockCreateFeedbackQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        createTrainerFeedback({
          gymGoerId: 'client-123',
          assignedWorkoutPlanId: 'assignment-123',
          feedback: 'Good progress.',
        }),
      ).rejects.toThrow(
        'Unable to save feedback. Please try again.',
      );
    });
  });

  describe('updateTrainerFeedback', () => {
    it('updates feedback written by the authenticated trainer', async () => {
      const query = mockUpdateFeedbackQuery({
        data: mockFeedback,
        error: null,
      });

      await expect(
        updateTrainerFeedback('feedback-123', {
          feedback: '  Updated feedback.  ',
          recommendations: '  Keep progressing.  ',
        }),
      ).resolves.toEqual(mockFeedback);

      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: 'Updated feedback.',
          recommendations: 'Keep progressing.',
        }),
      );

      expect(query.eq).toHaveBeenNthCalledWith(
        1,
        'id',
        'feedback-123',
      );

      expect(query.eq).toHaveBeenNthCalledWith(
        2,
        'trainer_id',
        'trainer-123',
      );
    });

    it('rejects an empty feedback ID', async () => {
      await expect(
        updateTrainerFeedback('', {
          feedback: 'Updated feedback.',
        }),
      ).rejects.toThrow('A valid feedback ID is required.');

      expect(mockedGetUser).not.toHaveBeenCalled();
    });

    it('rejects empty feedback text', async () => {
      await expect(
        updateTrainerFeedback('feedback-123', {
          feedback: '   ',
        }),
      ).rejects.toThrow('Feedback cannot be empty.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when feedback cannot be found or edited', async () => {
      mockUpdateFeedbackQuery({
        data: null,
        error: null,
      });

      await expect(
        updateTrainerFeedback('feedback-123', {
          feedback: 'Updated feedback.',
        }),
      ).rejects.toThrow(
        'Feedback not found or you are not authorised to edit it.',
      );
    });

    it('throws when the database update fails', async () => {
      mockUpdateFeedbackQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(
        updateTrainerFeedback('feedback-123', {
          feedback: 'Updated feedback.',
        }),
      ).rejects.toThrow(
        'Unable to update feedback. Please try again.',
      );
    });
  });
});
