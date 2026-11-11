import { supabase } from '@/lib/supabase';
import {
  startWorkoutLog,
  type StartWorkoutLogInput,
  type WorkoutLog,
} from '../workout-logs';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockedFrom = jest.mocked(supabase.from);

const mockInput: StartWorkoutLogInput = {
  assignmentId: 'assignment-123',
  gymGoerId: 'client-123',
  dayNumber: 1,
  dayName: 'Day 1',
  exercises: [
    {
      id: 'plan-exercise-123',
      exercise_id: 'exercise-123',
      exercise_order: 1,
      sets: 3,
      repetitions: '10-12',
      rest_seconds: 60,
      notes: null,
      exercise: {
        name: 'Bench Press',
      },
    },
  ],
};

const mockWorkout: WorkoutLog = {
  id: 'workout-123',
  assigned_workout_plan_id: 'assignment-123',
  gym_goer_id: 'client-123',
  started_at: '2026-11-10T18:00:00.000Z',
  completed_at: null,
  duration_minutes: null,
  exercise_logs: [
    {
      plan_exercise_id: 'plan-exercise-123',
      exercise_id: 'exercise-123',
      exercise_name: 'Bench Press',
      day_number: 1,
      day_name: 'Day 1',
      exercise_order: 1,
      target_sets: 3,
      target_repetitions: '10-12',
      rest_seconds: 60,
      notes: null,
      sets: [
        {
          set_number: 1,
          target_reps: '10-12',
          actual_reps: null,
          weight: null,
          weight_unit: null,
          completed: false,
        },
        {
          set_number: 2,
          target_reps: '10-12',
          actual_reps: null,
          weight: null,
          weight_unit: null,
          completed: false,
        },
        {
          set_number: 3,
          target_reps: '10-12',
          actual_reps: null,
          weight: null,
          weight_unit: null,
          completed: false,
        },
      ],
      completed: false,
    },
  ],
  notes: null,
  created_at: '2026-11-10T18:00:00.000Z',
};

function mockExistingWorkoutQuery(response: {
  data: unknown;
  error: unknown;
}) {
  const query: Record<string, jest.Mock> & {
    then?: (
      resolve: (value: typeof response) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.order.mockReturnValue(query);

  query.then = (resolve, reject) =>
    Promise.resolve(response).then(resolve, reject);

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

function mockInsertWorkoutQuery(response: {
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

  mockedFrom.mockReturnValueOnce(query as never);

  return query;
}

describe('Workout logs service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkoutLog', () => {
    it('creates a new workout when no in-progress workout exists', async () => {
      mockExistingWorkoutQuery({
        data: [],
        error: null,
      });

      const insertQuery = mockInsertWorkoutQuery({
        data: mockWorkout,
        error: null,
      });

      await expect(startWorkoutLog(mockInput)).resolves.toEqual(
        mockWorkout,
      );

      expect(mockedFrom).toHaveBeenNthCalledWith(1, 'workout_logs');
      expect(mockedFrom).toHaveBeenNthCalledWith(2, 'workout_logs');

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_workout_plan_id: 'assignment-123',
          gym_goer_id: 'client-123',
          exercise_logs: expect.arrayContaining([
            expect.objectContaining({
              day_number: 1,
              day_name: 'Day 1',
              exercise_name: 'Bench Press',
              target_sets: 3,
            }),
          ]),
        }),
      );
    });

    it('resumes an existing workout for the selected training day', async () => {
      mockExistingWorkoutQuery({
        data: [mockWorkout],
        error: null,
      });

      await expect(startWorkoutLog(mockInput)).resolves.toEqual(
        mockWorkout,
      );

      expect(mockedFrom).toHaveBeenCalledTimes(1);
    });

    it('creates a separate workout for a different training day', async () => {
      const dayOneWorkout = {
        ...mockWorkout,
        exercise_logs: mockWorkout.exercise_logs.map((exercise) => ({
          ...exercise,
          day_number: 1,
          day_name: 'Day 1',
        })),
      };

      const dayTwoInput: StartWorkoutLogInput = {
        ...mockInput,
        dayNumber: 2,
        dayName: 'Day 2',
      };

      mockExistingWorkoutQuery({
        data: [dayOneWorkout],
        error: null,
      });

      const dayTwoWorkout = {
        ...mockWorkout,
        id: 'workout-456',
        exercise_logs: mockWorkout.exercise_logs.map((exercise) => ({
          ...exercise,
          day_number: 2,
          day_name: 'Day 2',
        })),
      };

      const insertQuery = mockInsertWorkoutQuery({
        data: dayTwoWorkout,
        error: null,
      });

      await expect(startWorkoutLog(dayTwoInput)).resolves.toEqual(
        dayTwoWorkout,
      );

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          exercise_logs: expect.arrayContaining([
            expect.objectContaining({
              day_number: 2,
              day_name: 'Day 2',
            }),
          ]),
        }),
      );
    });

    it('rejects an empty assignment ID', async () => {
      await expect(
        startWorkoutLog({
          ...mockInput,
          assignmentId: '',
        }),
      ).rejects.toThrow('Assignment ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects an empty gym-goer ID', async () => {
      await expect(
        startWorkoutLog({
          ...mockInput,
          gymGoerId: '',
        }),
      ).rejects.toThrow('Gym-goer ID is required.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('rejects a training day without exercises', async () => {
      await expect(
        startWorkoutLog({
          ...mockInput,
          exercises: [],
        }),
      ).rejects.toThrow('This training day has no exercises.');

      expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('throws when checking existing workouts fails', async () => {
      mockExistingWorkoutQuery({
        data: null,
        error: { message: 'Permission denied' },
      });

      await expect(startWorkoutLog(mockInput)).rejects.toThrow(
        'Unable to check your existing workouts. Please try again.',
      );

      expect(mockedFrom).toHaveBeenCalledTimes(1);
    });

    it('throws when creating a new workout fails', async () => {
      mockExistingWorkoutQuery({
        data: [],
        error: null,
      });

      mockInsertWorkoutQuery({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(startWorkoutLog(mockInput)).rejects.toThrow(
        'Unable to start your workout. Please try again.',
      );

      expect(mockedFrom).toHaveBeenCalledTimes(2);
    });
  });
});
