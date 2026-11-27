import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/providers/AuthProvider';
import { getBodyWeightHistory } from '@/services/fitness-progress';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { getExercisePerformanceHistory } from '@/services/exercise-performance-history';
import { getPersonalWorkoutStatistics } from '@/services/workout-statistics';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';

jest.mock('lucide-react-native', () => ({
  ArrowRight: jest.fn(() => null),
  Dumbbell: jest.fn(() => null),
  Minus: jest.fn(() => null),
  Scale: jest.fn(() => null),
  TrendingDown: jest.fn(() => null),
  TrendingUp: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
      push: jest.fn(),
    },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

jest.mock('@/services/fitness-progress', () => ({
  getBodyWeightHistory: jest.fn(),
}));

jest.mock('@/services/personal-workouts', () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

jest.mock('@/services/workout-statistics', () => ({
  getPersonalWorkoutStatistics: jest.fn(),
}));

jest.mock('@/services/exercise-performance-history', () => ({
  getExercisePerformanceHistory: jest.fn(),
}));

import HomeTabScreen from '../index';

const mockedUseAuth = jest.mocked(useAuth);
const mockedGetBodyWeightHistory = jest.mocked(getBodyWeightHistory);
const mockedGetPersonalWorkoutHistory = jest.mocked(getPersonalWorkoutHistory);
const mockedGetPersonalWorkoutStatistics = jest.mocked(
  getPersonalWorkoutStatistics,
);
const mockedGetExercisePerformanceHistory = jest.mocked(
  getExercisePerformanceHistory,
);

const exercisePerformanceHistory = [
  {
    exerciseKey: 'shared:bench-press',
    exerciseId: 'bench-press',
    exerciseSource: 'shared',
    exerciseName: 'Bench Press',
    totalSessions: 1,
    latestPerformanceAt: '2026-11-25T10:00:00.000Z',
    sessions: [
      {
        workoutId: 'workout-1',
        workoutName: 'Upper body strength',
        workoutDate: '2026-11-25',
        completedAt: '2026-11-25T10:00:00.000Z',
        exerciseOrder: 0,
        notes: null,
        sets: [
          {
            id: 'set-1',
            workout_exercise_id: 'workout-exercise-1',
            set_number: 1,
            repetitions: 8,
            weight: 60,
            weight_unit: 'kg',
            duration_seconds: null,
            distance: null,
            distance_unit: null,
            notes: null,
            created_at: '2026-11-25T09:30:00.000Z',
          },
        ],
      },
    ],
  },
  {
    exerciseKey: 'personal:bench-press',
    exerciseId: 'personal-bench-press',
    exerciseSource: 'personal',
    exerciseName: 'Bench Press',
    totalSessions: 1,
    latestPerformanceAt: '2026-11-25T10:00:00.000Z',
    sessions: [
      {
        workoutId: 'workout-1',
        workoutName: 'Upper body strength',
        workoutDate: '2026-11-25',
        completedAt: '2026-11-25T10:00:00.000Z',
        exerciseOrder: 1,
        notes: null,
        sets: [
          {
            id: 'set-2',
            workout_exercise_id: 'workout-exercise-2',
            set_number: 1,
            repetitions: 12,
            weight: null,
            weight_unit: null,
            duration_seconds: null,
            distance: null,
            distance_unit: null,
            notes: 'Bodyweight',
            created_at: '2026-11-25T09:40:00.000Z',
          },
        ],
      },
    ],
  },
];



const personalWorkout = {
  id: 'workout-1',
  user_id: 'gym-goer-123',
  workout_name: 'Upper body strength',
  workout_type: 'strength',
  workout_date: '2026-11-25',
  started_at: '2026-11-25T09:00:00.000Z',
  completed_at: '2026-11-25T10:00:00.000Z',
  duration_seconds: 3600,
  notes: null,
  status: 'completed',
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
};

const workoutStatistics = {
  completedWorkoutCount: 12,
  recordedDurationSeconds: 36000,
  averageDurationSeconds: 3000,
  workoutsWithRecordedDuration: 12,
  workoutsThisWeek: 3,
  workoutsThisMonth: 8,
  activeDaysThisWeek: 3,
  activeDaysThisMonth: 7,
};

async function renderScreen() {
  const rendered = await render(
    <TrainrThemeProvider>
      <HomeTabScreen />
    </TrainrThemeProvider>,
  );

  await fireEvent.press(
    rendered.getByRole('tab', { name: 'Workout tab' }),
  );

  return rendered;
}

describe('Gym-Goer Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: { id: 'gym-goer-123' },
    } as never);

    mockedGetBodyWeightHistory.mockResolvedValue([]);
    mockedGetPersonalWorkoutHistory.mockResolvedValue([
      personalWorkout,
    ] as never);
    mockedGetPersonalWorkoutStatistics.mockResolvedValue(
      workoutStatistics as never,
    );
    mockedGetExercisePerformanceHistory.mockResolvedValue(
      exercisePerformanceHistory as never,
    );
  });

  it('loads and displays personal workout statistics and recent activity', async () => {
    const { getByText, getAllByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('WORKOUT PROGRESS')).toBeTruthy();
      expect(getByText('COMPLETED WORKOUTS')).toBeTruthy();
      expect(getByText('12')).toBeTruthy();
      expect(getByText('THIS WEEK')).toBeTruthy();
      expect(getByText('THIS MONTH')).toBeTruthy();
      expect(getByText('ACTIVE DAYS')).toBeTruthy();
      expect(getByText('TOTAL RECORDED TIME')).toBeTruthy();
      expect(getByText('AVERAGE DURATION')).toBeTruthy();
      expect(getByText('10h 0m')).toBeTruthy();
      expect(getByText('50 min')).toBeTruthy();
      expect(getByText('MOST RECENT WORKOUT')).toBeTruthy();
      expect(getAllByText('Upper body strength')).toHaveLength(3);
      expect(getByText('EXERCISE PERFORMANCE')).toBeTruthy();
      expect(getAllByText('Bench Press')).toHaveLength(2);
      expect(getByText(/TRAINR exercise/)).toBeTruthy();
      expect(getByText(/Personal exercise/)).toBeTruthy();
      expect(getByText('Set 1: 8 reps · 60 kg')).toBeTruthy();
      expect(getByText('Set 1: 12 reps')).toBeTruthy();
    });

    expect(mockedGetBodyWeightHistory).toHaveBeenCalledTimes(1);
    expect(mockedGetPersonalWorkoutStatistics).toHaveBeenCalledTimes(1);
    expect(mockedGetExercisePerformanceHistory).toHaveBeenCalledTimes(1);
    expect(mockedGetPersonalWorkoutHistory).toHaveBeenCalledWith({
      limit: 1,
    });
  });

  it('shows the empty state when no personal workouts exist', async () => {
    mockedGetPersonalWorkoutHistory.mockResolvedValue([]);

    mockedGetPersonalWorkoutStatistics.mockResolvedValue({
      ...workoutStatistics,
      completedWorkoutCount: 0,
      recordedDurationSeconds: null,
      averageDurationSeconds: null,
      workoutsWithRecordedDuration: 0,
      workoutsThisWeek: 0,
      workoutsThisMonth: 0,
      activeDaysThisWeek: 0,
      activeDaysThisMonth: 0,
    } as never);

    const { getByText, getAllByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('YOUR TRAINING STARTS HERE')).toBeTruthy();
      expect(getAllByText('Not recorded')).toHaveLength(2);
    });
  });

  it('shows a retry action when workout progress fails to load', async () => {
    mockedGetPersonalWorkoutStatistics.mockRejectedValue(
      new Error('Unable to load workout statistics.'),
    );

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(
        getByText('Unable to load workout statistics.'),
      ).toBeTruthy();
      expect(getByText('Try again')).toBeTruthy();
    });
  });

  it('does not request personal progress without an authenticated user', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
    } as never);

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('COMPLETED WORKOUTS')).toBeTruthy();
    });

    expect(mockedGetPersonalWorkoutStatistics).not.toHaveBeenCalled();
    expect(mockedGetPersonalWorkoutHistory).not.toHaveBeenCalled();
    expect(mockedGetBodyWeightHistory).not.toHaveBeenCalled();
  });
});
