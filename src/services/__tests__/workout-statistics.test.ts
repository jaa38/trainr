import { getPersonalWorkoutHistory } from '@/services/personal-workouts';

import type { PersonalWorkout } from '@/types/personal-workouts';

import {
  calculatePersonalWorkoutStatistics,
  getPersonalWorkoutStatistics,
} from '../workout-statistics';

jest.mock('@/services/personal-workouts', () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

const mockedGetPersonalWorkoutHistory = jest.mocked(getPersonalWorkoutHistory);

const referenceDate = new Date(2026, 10, 26, 12, 0, 0);

function createWorkout(
  overrides: Partial<PersonalWorkout> = {},
): PersonalWorkout {
  return {
    id: 'workout-1',
    user_id: 'user-123',
    workout_name: 'Strength Training',
    workout_type: 'strength',
    workout_date: '2026-11-26',
    started_at: '2026-11-26T09:00:00.000Z',
    completed_at: '2026-11-26T10:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    status: 'completed',
    created_at: '2026-11-26T09:00:00.000Z',
    updated_at: '2026-11-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('calculatePersonalWorkoutStatistics', () => {
  it('counts only valid completed workouts', () => {
    const workouts = [
      createWorkout({ id: 'completed-1' }),
      createWorkout({ id: 'draft', status: 'draft', completed_at: null }),
      createWorkout({
        id: 'in-progress',
        status: 'in_progress',
        completed_at: null,
      }),
      createWorkout({
        id: 'invalid-completion',
        completed_at: null,
      }),
    ];

    const result = calculatePersonalWorkoutStatistics(
      workouts,
      referenceDate,
    );

    expect(result.completedWorkoutCount).toBe(1);
    expect(result.recordedDurationSeconds).toBe(3600);
  });

  it('does not treat missing durations as zero', () => {
    const workouts = [
      createWorkout({ id: 'one', duration_seconds: 3600 }),
      createWorkout({ id: 'two', duration_seconds: null }),
      createWorkout({ id: 'three', duration_seconds: 1800 }),
    ];

    const result = calculatePersonalWorkoutStatistics(
      workouts,
      referenceDate,
    );

    expect(result.completedWorkoutCount).toBe(3);
    expect(result.recordedDurationSeconds).toBe(5400);
    expect(result.workoutsWithRecordedDuration).toBe(2);
    expect(result.averageDurationSeconds).toBe(2700);
  });

  it('returns null duration statistics when no durations are recorded', () => {
    const result = calculatePersonalWorkoutStatistics(
      [createWorkout({ duration_seconds: null })],
      referenceDate,
    );

    expect(result.recordedDurationSeconds).toBeNull();
    expect(result.averageDurationSeconds).toBeNull();
    expect(result.workoutsWithRecordedDuration).toBe(0);
  });

  it('counts workouts within the current Monday-to-Sunday week', () => {
    const workouts = [
      createWorkout({ id: 'monday', workout_date: '2026-11-23' }),
      createWorkout({ id: 'wednesday', workout_date: '2026-11-25' }),
      createWorkout({ id: 'thursday', workout_date: '2026-11-26' }),
      createWorkout({ id: 'previous-week', workout_date: '2026-11-22' }),
      createWorkout({ id: 'future', workout_date: '2026-11-27' }),
    ];

    const result = calculatePersonalWorkoutStatistics(
      workouts,
      referenceDate,
    );

    expect(result.workoutsThisWeek).toBe(3);
    expect(result.activeDaysThisWeek).toBe(3);
  });

  it('counts current-month workouts and distinct active days', () => {
    const workouts = [
      createWorkout({ id: 'first', workout_date: '2026-11-02' }),
      createWorkout({ id: 'second', workout_date: '2026-11-02' }),
      createWorkout({ id: 'third', workout_date: '2026-11-15' }),
      createWorkout({ id: 'previous-month', workout_date: '2026-10-31' }),
      createWorkout({ id: 'future', workout_date: '2026-11-27' }),
    ];

    const result = calculatePersonalWorkoutStatistics(
      workouts,
      referenceDate,
    );

    expect(result.workoutsThisMonth).toBe(3);
    expect(result.activeDaysThisMonth).toBe(2);
  });

  it('excludes invalid calendar dates from period statistics', () => {
    const result = calculatePersonalWorkoutStatistics(
      [createWorkout({ workout_date: '2026-02-30' })],
      referenceDate,
    );

    expect(result.completedWorkoutCount).toBe(1);
    expect(result.workoutsThisWeek).toBe(0);
    expect(result.workoutsThisMonth).toBe(0);
  });
});

describe('getPersonalWorkoutStatistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retrieves all completed workouts across multiple pages', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      createWorkout({ id: `workout-${index}` }),
    );
    const secondPage = [createWorkout({ id: 'workout-100' })];

    mockedGetPersonalWorkoutHistory
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const result = await getPersonalWorkoutStatistics();

    expect(mockedGetPersonalWorkoutHistory).toHaveBeenNthCalledWith(1, {
      status: 'completed',
      limit: 100,
      offset: 0,
    });

    expect(mockedGetPersonalWorkoutHistory).toHaveBeenNthCalledWith(2, {
      status: 'completed',
      limit: 100,
      offset: 100,
    });

    expect(result.completedWorkoutCount).toBe(101);
  });

  it('stops pagination when the final page is shorter than the page size', async () => {
    mockedGetPersonalWorkoutHistory.mockResolvedValue([
      createWorkout(),
    ]);

    await getPersonalWorkoutStatistics();

    expect(mockedGetPersonalWorkoutHistory).toHaveBeenCalledTimes(1);
  });

  it('propagates history retrieval errors', async () => {
    mockedGetPersonalWorkoutHistory.mockRejectedValue(
      new Error('Unable to load your workout history. Please try again.'),
    );

    await expect(getPersonalWorkoutStatistics()).rejects.toThrow(
      'Unable to load your workout history. Please try again.',
    );
  });
});
