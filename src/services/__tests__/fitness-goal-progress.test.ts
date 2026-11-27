jest.mock("@/services/fitness-goals", () => ({
  getFitnessGoalById: jest.fn(),
  getFitnessGoals: jest.fn(),
}));
jest.mock("@/services/fitness-progress", () => ({
  getFitnessProgress: jest.fn(),
}));
jest.mock("@/services/exercise-performance-history", () => ({
  getExercisePerformanceHistory: jest.fn(),
}));
jest.mock("@/services/personal-workouts", () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

import {
  calculateFitnessGoalProgress,
  getFitnessGoalProgress,
  getFitnessGoalsProgress,
  type GoalProgressData,
} from '../fitness-goal-progress';

import {
  getFitnessGoalById,
  getFitnessGoals,
} from '@/services/fitness-goals';
import { getFitnessProgress } from '@/services/fitness-progress';
import { getExercisePerformanceHistory } from '@/services/exercise-performance-history';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';

import type {
  FitnessGoal,
  PersonalWorkout,
  WorkoutSet,
} from '@/types/personal-workouts';

import type { FitnessProgress } from '../fitness-progress';

import type {
  ExercisePerformanceHistoryItem,
} from '../exercise-performance-history';

const REFERENCE_DATE = new Date(2026, 10, 27, 12, 0, 0);

function makeGoal(overrides: Partial<FitnessGoal> = {}): FitnessGoal {
  return {
    id: 'goal-123',
    user_id: 'user-123',
    goal_type: 'workout_frequency',
    goal_name: 'Weekly workouts',
    description: null,
    target_value: 4,
    current_value: null,
    measurement_unit: null,
    exercise_id: null,
    personal_exercise_id: null,
    start_date: '2026-11-01',
    target_date: '2027-02-01',
    goal_status: 'active',
    created_at: '2026-11-01T08:00:00.000Z',
    updated_at: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}

function makeWorkout(
  overrides: Partial<PersonalWorkout> = {},
): PersonalWorkout {
  return {
    id: 'workout-123',
    user_id: 'user-123',
    workout_name: 'Strength workout',
    workout_type: 'strength',
    workout_date: '2026-11-25',
    started_at: '2026-11-25T09:00:00.000Z',
    completed_at: '2026-11-25T10:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    status: 'completed',
    created_at: '2026-11-25T09:00:00.000Z',
    updated_at: '2026-11-25T10:00:00.000Z',
    ...overrides,
  };
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 'set-123',
    workout_exercise_id: 'workout-exercise-123',
    set_number: 1,
    repetitions: 8,
    weight: 50,
    weight_unit: 'kg',
    duration_seconds: null,
    distance: null,
    distance_unit: null,
    notes: null,
    created_at: '2026-11-25T09:30:00.000Z',
    ...overrides,
  };
}

function makeMeasurement(
  overrides: Partial<FitnessProgress> = {},
): FitnessProgress {
  return {
    id: 'measurement-123',
    user_id: 'user-123',
    metric_type: 'body_weight',
    value: 80,
    unit: 'kg',
    recorded_at: '2026-11-01T08:00:00.000Z',
    notes: null,
    created_at: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}

function makeExerciseHistory(
  sets: WorkoutSet[],
  overrides: Partial<ExercisePerformanceHistoryItem> = {},
): ExercisePerformanceHistoryItem {
  return {
    exerciseKey: 'shared:exercise-123',
    exerciseId: 'exercise-123',
    exerciseSource: 'shared',
    exerciseName: 'Bench Press',
    totalSessions: 1,
    latestPerformanceAt: '2026-11-25T10:00:00.000Z',
    sessions: [
      {
        workoutId: 'workout-123',
        workoutName: 'Strength workout',
        workoutDate: '2026-11-25',
        completedAt: '2026-11-25T10:00:00.000Z',
        exerciseOrder: 1,
        notes: null,
        sets,
      },
    ],
    ...overrides,
  };
}

function makeData(overrides: Partial<GoalProgressData> = {}): GoalProgressData {
  return {
    workouts: [],
    measurements: [],
    exerciseHistory: [],
    ...overrides,
  };
}

describe('Fitness goal progress calculations', () => {
  describe('workout frequency', () => {
    it('calculates completed workouts against the weekly target', () => {
      const goal = makeGoal({
        target_value: 4,
      });

      const data = makeData({
        workouts: [
          makeWorkout({ id: 'one', workout_date: '2026-11-23' }),
          makeWorkout({ id: 'two', workout_date: '2026-11-25' }),
          makeWorkout({ id: 'three', workout_date: '2026-11-27' }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(3);
      expect(result.targetValue).toBe(4);
      expect(result.progressPercentage).toBe(75);
      expect(result.isAvailable).toBe(true);
    });

    it('excludes draft, incomplete, invalid and out-of-week workouts', () => {
      const goal = makeGoal();

      const data = makeData({
        workouts: [
          makeWorkout({ id: 'completed' }),
          makeWorkout({
            id: 'draft',
            status: 'draft',
            completed_at: null,
          }),
          makeWorkout({
            id: 'in-progress',
            status: 'in_progress',
            completed_at: null,
          }),
          makeWorkout({
            id: 'invalid-date',
            completed_at: 'invalid-date',
          }),
          makeWorkout({
            id: 'previous-week',
            workout_date: '2026-11-20',
          }),
          makeWorkout({
            id: 'future',
            workout_date: '2026-11-28',
          }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(1);
      expect(result.progressPercentage).toBe(25);
    });

    it('does not count workouts before the goal start date', () => {
      const goal = makeGoal({
        start_date: '2026-11-25',
      });

      const data = makeData({
        workouts: [
          makeWorkout({
            id: 'before-start',
            workout_date: '2026-11-24',
          }),
          makeWorkout({
            id: 'after-start',
            workout_date: '2026-11-26',
          }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(1);
    });

    it('caps displayed progress at 100 percent', () => {
      const goal = makeGoal({ target_value: 2 });

      const data = makeData({
        workouts: [
          makeWorkout({ id: 'one' }),
          makeWorkout({ id: 'two' }),
          makeWorkout({ id: 'three' }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(3);
      expect(result.progressPercentage).toBe(100);
    });
  });

  describe('workout duration', () => {
    it('calculates recorded completed workout minutes', () => {
      const goal = makeGoal({
        goal_type: 'workout_duration',
        goal_name: 'Weekly exercise minutes',
        target_value: 150,
        measurement_unit: 'minutes',
      });

      const data = makeData({
        workouts: [
          makeWorkout({
            id: 'one',
            duration_seconds: 3600,
          }),
          makeWorkout({
            id: 'two',
            duration_seconds: 1800,
          }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(90);
      expect(result.targetValue).toBe(150);
      expect(result.progressPercentage).toBe(60);
      expect(result.unit).toBe('minutes/week');
    });

    it('converts hour-based targets into minutes', () => {
      const goal = makeGoal({
        goal_type: 'workout_duration',
        target_value: 2,
        measurement_unit: 'hours',
      });

      const data = makeData({
        workouts: [
          makeWorkout({ duration_seconds: 3600 }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(60);
      expect(result.targetValue).toBe(120);
      expect(result.progressPercentage).toBe(50);
    });

    it('returns unavailable when no workout duration is recorded', () => {
      const goal = makeGoal({
        goal_type: 'workout_duration',
      });

      const data = makeData({
        workouts: [
          makeWorkout({ duration_seconds: null }),
        ],
      });

      const result = calculateFitnessGoalProgress(
        goal,
        data,
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBeNull();
      expect(result.progressPercentage).toBeNull();
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('strength targets', () => {
    it('uses the best comparable weight for the selected shared exercise', () => {
      const goal = makeGoal({
        goal_type: 'strength_target',
        goal_name: 'Bench press target',
        target_value: 60,
        measurement_unit: 'kg',
        exercise_id: 'exercise-123',
      });

      const history = makeExerciseHistory(
        [
          makeSet({ weight: 40, weight_unit: 'kg' }),
          makeSet({ id: 'set-2', weight: 50, weight_unit: 'kg' }),
        ],
        {
          exerciseId: 'exercise-123',
          exerciseKey: 'shared:exercise-123',
        },
      );

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(50);
      expect(result.progressPercentage).toBeCloseTo(83.333, 2);
    });

    it('converts pounds to kilograms before comparison', () => {
      const goal = makeGoal({
        goal_type: 'strength_target',
        target_value: 60,
        measurement_unit: 'kg',
        exercise_id: 'exercise-123',
      });

      const history = makeExerciseHistory([
        makeSet({
          weight: 110.231,
          weight_unit: 'lb',
        }),
      ]);

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBeCloseTo(50, 1);
      expect(result.progressPercentage).toBeCloseTo(83.333, 1);
    });

    it('does not match a personal exercise with the same ID', () => {
      const goal = makeGoal({
        goal_type: 'strength_target',
        exercise_id: 'exercise-123',
      });

      const history = makeExerciseHistory(
        [makeSet()],
        {
          exerciseSource: 'personal',
          exerciseKey: 'personal:exercise-123',
        },
      );

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.currentValue).toBeNull();
    });

    it('returns unavailable when no comparable weight is recorded', () => {
      const goal = makeGoal({
        goal_type: 'strength_target',
        exercise_id: 'exercise-123',
      });

      const history = makeExerciseHistory([
        makeSet({
          weight: null,
          weight_unit: null,
        }),
      ]);

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(false);
    });
  });

  describe('cardio targets', () => {
    it('calculates progress from the best recorded exercise distance', () => {
      const goal = makeGoal({
        goal_type: 'cardio_target',
        goal_name: 'Running distance',
        target_value: 5,
        measurement_unit: 'km',
        exercise_id: 'run-123',
      });

      const history = makeExerciseHistory(
        [
          makeSet({
            distance: 2,
            distance_unit: 'km',
          }),
          makeSet({
            id: 'set-2',
            distance: 3,
            distance_unit: 'km',
          }),
        ],
        {
          exerciseId: 'run-123',
          exerciseKey: 'shared:run-123',
        },
      );

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(3);
      expect(result.progressPercentage).toBe(60);
    });

    it('converts miles into kilometres before comparison', () => {
      const goal = makeGoal({
        goal_type: 'cardio_target',
        target_value: 5,
        measurement_unit: 'km',
        exercise_id: 'run-123',
      });

      const history = makeExerciseHistory(
        [
          makeSet({
            distance: 1.86411,
            distance_unit: 'mi',
          }),
        ],
        {
          exerciseId: 'run-123',
          exerciseKey: 'shared:run-123',
        },
      );

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ exerciseHistory: [history] }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBeCloseTo(3, 2);
      expect(result.progressPercentage).toBeCloseTo(60, 1);
    });
  });

  describe('body-weight targets', () => {
    it('calculates progress from the baseline towards a weight-loss target', () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
        goal_name: 'Reach target weight',
        target_value: 70,
        measurement_unit: 'kg',
        start_date: '2026-11-01',
      });

      const measurements = [
        makeMeasurement({
          id: 'baseline',
          value: 80,
          unit: 'kg',
          recorded_at: '2026-11-01T08:00:00.000Z',
        }),
        makeMeasurement({
          id: 'current',
          value: 77,
          unit: 'kg',
          recorded_at: '2026-11-27T08:00:00.000Z',
        }),
      ];

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ measurements }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBe(77);
      expect(result.progressPercentage).toBe(30);
      expect(result.isAvailable).toBe(true);
    });

    it('supports weight-gain targets and mixed measurement units', () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
        target_value: 90,
        measurement_unit: 'kg',
        start_date: '2026-11-01',
      });

      const measurements = [
        makeMeasurement({
          id: 'baseline',
          value: 80,
          unit: 'kg',
          recorded_at: '2026-11-01T08:00:00.000Z',
        }),
        makeMeasurement({
          id: 'current',
          value: 187.393,
          unit: 'lb',
          recorded_at: '2026-11-27T08:00:00.000Z',
        }),
      ];

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({ measurements }),
        REFERENCE_DATE,
      );

      expect(result.currentValue).toBeCloseTo(85, 1);
      expect(result.progressPercentage).toBeCloseTo(50, 1);
    });

    it('returns unavailable when no baseline exists', () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
        target_value: 70,
        measurement_unit: 'kg',
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({
          measurements: [
            makeMeasurement({
              recorded_at: '2026-11-20T08:00:00.000Z',
            }),
          ],
        }),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.currentValue).toBeNull();
      expect(result.progressPercentage).toBeNull();
    });

    it('returns unavailable when there is no measurement after the baseline', () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
        target_value: 70,
        measurement_unit: 'kg',
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData({
          measurements: [
            makeMeasurement({
              recorded_at: '2026-10-25T08:00:00.000Z',
            }),
          ],
        }),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(false);
    });
  });

  describe('custom goals', () => {
    it('calculates manually recorded custom goal progress', () => {
      const goal = makeGoal({
        goal_type: 'custom',
        target_value: 100,
        current_value: 40,
        measurement_unit: 'pages',
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData(),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(true);
      expect(result.currentValue).toBe(40);
      expect(result.targetValue).toBe(100);
      expect(result.unit).toBe('pages');
      expect(result.progressPercentage).toBe(40);
    });

    it('treats zero as an available custom goal progress value', () => {
      const goal = makeGoal({
        goal_type: 'custom',
        target_value: 10,
        current_value: 0,
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData(),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(true);
      expect(result.currentValue).toBe(0);
      expect(result.progressPercentage).toBe(0);
    });

    it('caps custom goal progress at 100 percent', () => {
      const goal = makeGoal({
        goal_type: 'custom',
        target_value: 10,
        current_value: 15,
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData(),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(true);
      expect(result.currentValue).toBe(15);
      expect(result.progressPercentage).toBe(100);
    });

    it('does not invent an automatic progress value', () => {
      const goal = makeGoal({
        goal_type: 'custom',
        goal_name: 'Build a consistent routine',
        target_value: 1,
      });

      const result = calculateFitnessGoalProgress(
        goal,
        makeData(),
        REFERENCE_DATE,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.currentValue).toBeNull();
      expect(result.progressPercentage).toBeNull();
    });
  });
});

describe('Fitness goal progress data retrieval', () => {
  const mockedGetGoalById = getFitnessGoalById as jest.Mock;
  const mockedGetGoals = getFitnessGoals as jest.Mock;
  const mockedGetMeasurements = getFitnessProgress as jest.Mock;
  const mockedGetExerciseHistory = getExercisePerformanceHistory as jest.Mock;
  const mockedGetWorkoutHistory = getPersonalWorkoutHistory as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetGoalById.mockResolvedValue(makeGoal());
    mockedGetGoals.mockResolvedValue([]);
    mockedGetMeasurements.mockResolvedValue([]);
    mockedGetExerciseHistory.mockResolvedValue([]);
    mockedGetWorkoutHistory.mockResolvedValue([]);
  });

  describe('getFitnessGoalProgress', () => {
    it('loads one goal and only the data required by its type', async () => {
      const goal = makeGoal({
        goal_type: 'strength_target',
        exercise_id: 'exercise-123',
        measurement_unit: 'kg',
        target_value: 60,
      });

      mockedGetGoalById.mockResolvedValue(goal);
      mockedGetExerciseHistory.mockResolvedValue([
        makeExerciseHistory([makeSet({ weight: 50 })]),
      ]);

      const result = await getFitnessGoalProgress(
        goal.id,
        REFERENCE_DATE,
      );

      expect(mockedGetGoalById).toHaveBeenCalledWith(goal.id);
      expect(mockedGetExerciseHistory).toHaveBeenCalledTimes(1);
      expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
      expect(mockedGetMeasurements).not.toHaveBeenCalled();

      expect(result.currentValue).toBe(50);
      expect(result.progressPercentage).toBeCloseTo(83.33, 1);
    });

    it('loads workout history for workout-frequency goals', async () => {
      const goal = makeGoal({
        goal_type: 'workout_frequency',
        target_value: 4,
      });

      mockedGetGoalById.mockResolvedValue(goal);
      mockedGetWorkoutHistory.mockResolvedValue([
        makeWorkout(),
        makeWorkout({ id: 'workout-456' }),
      ]);

      const result = await getFitnessGoalProgress(
        goal.id,
        REFERENCE_DATE,
      );

      expect(mockedGetWorkoutHistory).toHaveBeenCalledTimes(1);
      expect(mockedGetWorkoutHistory).toHaveBeenCalledWith({
        status: 'completed',
        limit: 100,
        offset: 0,
      });
      expect(result.currentValue).toBe(2);
      expect(result.progressPercentage).toBe(50);
    });

    it('loads measurements for body-weight goals', async () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
        target_value: 70,
        measurement_unit: 'kg',
        start_date: '2026-11-01',
      });

      mockedGetGoalById.mockResolvedValue(goal);
      mockedGetMeasurements.mockResolvedValue([
        makeMeasurement({
          value: 80,
          recorded_at: '2026-11-01T08:00:00.000Z',
        }),
        makeMeasurement({
          id: 'measurement-current',
          value: 77,
          recorded_at: '2026-11-27T08:00:00.000Z',
        }),
      ]);

      const result = await getFitnessGoalProgress(
        goal.id,
        REFERENCE_DATE,
      );

      expect(mockedGetMeasurements).toHaveBeenCalledTimes(1);
      expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
      expect(mockedGetExerciseHistory).not.toHaveBeenCalled();
      expect(result.progressPercentage).toBeCloseTo(30);
    });

    it('propagates data retrieval errors', async () => {
      const goal = makeGoal({
        goal_type: 'body_weight',
      });

      mockedGetGoalById.mockResolvedValue(goal);
      mockedGetMeasurements.mockRejectedValue(
        new Error('Unable to load measurements'),
      );

      await expect(
        getFitnessGoalProgress(goal.id, REFERENCE_DATE),
      ).rejects.toThrow('Unable to load measurements');
    });
  });

  describe('getFitnessGoalsProgress', () => {
    it('returns an empty array without loading progress data when no goals exist', async () => {
      mockedGetGoals.mockResolvedValue([]);

      const result = await getFitnessGoalsProgress(REFERENCE_DATE);

      expect(result).toEqual([]);
      expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
      expect(mockedGetExerciseHistory).not.toHaveBeenCalled();
      expect(mockedGetMeasurements).not.toHaveBeenCalled();
    });

    it('loads each required dataset once for multiple goals', async () => {
      const goals = [
        makeGoal({
          id: 'frequency-goal',
          goal_type: 'workout_frequency',
          target_value: 4,
        }),
        makeGoal({
          id: 'duration-goal',
          goal_type: 'workout_duration',
          target_value: 150,
          measurement_unit: 'minutes',
        }),
        makeGoal({
          id: 'strength-goal',
          goal_type: 'strength_target',
          exercise_id: 'exercise-123',
          measurement_unit: 'kg',
          target_value: 60,
        }),
        makeGoal({
          id: 'body-weight-goal',
          goal_type: 'body_weight',
          measurement_unit: 'kg',
          target_value: 70,
        }),
        makeGoal({
          id: 'custom-goal',
          goal_type: 'custom',
        }),
      ];

      mockedGetGoals.mockResolvedValue(goals);

      mockedGetWorkoutHistory.mockResolvedValue([
        makeWorkout(),
        makeWorkout({ id: 'workout-456' }),
      ]);

      mockedGetExerciseHistory.mockResolvedValue([
        makeExerciseHistory([makeSet({ weight: 50 })]),
      ]);

      mockedGetMeasurements.mockResolvedValue([
        makeMeasurement({
          value: 80,
          recorded_at: '2026-11-01T08:00:00.000Z',
        }),
        makeMeasurement({
          id: 'measurement-current',
          value: 77,
          recorded_at: '2026-11-27T08:00:00.000Z',
        }),
      ]);

      const results = await getFitnessGoalsProgress(REFERENCE_DATE);

      expect(results).toHaveLength(5);
      expect(mockedGetGoals).toHaveBeenCalledTimes(1);
      expect(mockedGetWorkoutHistory).toHaveBeenCalledTimes(1);
      expect(mockedGetExerciseHistory).toHaveBeenCalledTimes(1);
      expect(mockedGetMeasurements).toHaveBeenCalledTimes(1);

      expect(results.find((item) => item.goalId === 'frequency-goal')
        ?.progressPercentage).toBe(50);

      expect(results.find((item) => item.goalId === 'strength-goal')
        ?.progressPercentage).toBeCloseTo(83.33, 1);

      expect(results.find((item) => item.goalId === 'body-weight-goal')
        ?.progressPercentage).toBeCloseTo(30);

      expect(results.find((item) => item.goalId === 'custom-goal')
        ?.isAvailable).toBe(false);
    });

    it('does not load unrelated datasets for custom-only goals', async () => {
      mockedGetGoals.mockResolvedValue([
        makeGoal({
          id: 'custom-goal',
          goal_type: 'custom',
        }),
      ]);

      const results = await getFitnessGoalsProgress(REFERENCE_DATE);

      expect(results).toHaveLength(1);
      expect(results[0].isAvailable).toBe(false);
      expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
      expect(mockedGetExerciseHistory).not.toHaveBeenCalled();
      expect(mockedGetMeasurements).not.toHaveBeenCalled();
    });
  });

  describe('workout history pagination', () => {
    it('retrieves subsequent pages when more than 100 workouts exist', async () => {
      const firstPage = Array.from(
        { length: 100 },
        (_, index) => makeWorkout({
          id: `workout-${index}`,
        }),
      );

      const secondPage = [
        makeWorkout({ id: 'workout-101' }),
      ];

      const goal = makeGoal({
        goal_type: 'workout_frequency',
        target_value: 150,
      });

      mockedGetGoalById.mockResolvedValue(goal);
      mockedGetWorkoutHistory
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      const result = await getFitnessGoalProgress(
        goal.id,
        REFERENCE_DATE,
      );

      expect(mockedGetWorkoutHistory).toHaveBeenCalledTimes(2);

      expect(mockedGetWorkoutHistory).toHaveBeenNthCalledWith(1, {
        status: 'completed',
        limit: 100,
        offset: 0,
      });

      expect(mockedGetWorkoutHistory).toHaveBeenNthCalledWith(2, {
        status: 'completed',
        limit: 100,
        offset: 100,
      });

      expect(result.currentValue).toBe(101);
    });
  });
});
