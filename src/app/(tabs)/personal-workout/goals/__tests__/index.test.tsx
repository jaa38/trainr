import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getFitnessGoals } from '@/services/fitness-goals';
import { getFitnessGoalsProgress } from '@/services/fitness-goal-progress';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: jest.fn(() => null),
  CalendarDays: jest.fn(() => null),
  Plus: jest.fn(() => null),
  Target: jest.fn(() => null),
  TrendingUp: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
      back: jest.fn(),
      push: jest.fn(),
    },
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/services/fitness-goals', () => ({
  getFitnessGoals: jest.fn(),
}));

jest.mock('@/services/fitness-goal-progress', () => ({
  getFitnessGoalsProgress: jest.fn(),
}));

import { router } from 'expo-router';
import FitnessGoalsScreen from '../index';

const mockedGetGoals = jest.mocked(getFitnessGoals);
const mockedGetProgress = jest.mocked(getFitnessGoalsProgress);
const mockedRouterPush = jest.mocked(router.push);

const activeGoal = {
  id: 'goal-active',
  user_id: 'user-123',
  goal_type: 'workout_frequency' as const,
  goal_name: 'Four workouts per week',
  description: null,
  target_value: 4,
  current_value: null,
  measurement_unit: 'workouts/week',
  exercise_id: null,
  personal_exercise_id: null,
  start_date: '2026-11-01',
  target_date: '2027-02-01',
  goal_status: 'active' as const,
  created_at: '2026-11-01T08:00:00.000Z',
  updated_at: '2026-11-01T08:00:00.000Z',
};

const pausedGoal = {
  ...activeGoal,
  id: 'goal-paused',
  goal_name: 'Run 5 kilometres',
  goal_type: 'cardio_target' as const,
  goal_status: 'paused' as const,
  measurement_unit: 'km',
  target_value: 5,
  exercise_id: 'exercise-123',
};

const activeProgress = {
  goalId: 'goal-active',
  goalName: activeGoal.goal_name,
  goalType: 'workout_frequency' as const,
  currentValue: 3,
  targetValue: 4,
  unit: 'workouts/week',
  progressPercentage: 75,
  isAvailable: true,
};

const pausedProgress = {
  goalId: 'goal-paused',
  goalName: pausedGoal.goal_name,
  goalType: 'cardio_target' as const,
  currentValue: null,
  targetValue: 5,
  unit: 'km',
  progressPercentage: null,
  isAvailable: false,
};

async function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <TrainrThemeProvider>
        <FitnessGoalsScreen />
      </TrainrThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Fitness Goals overview screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetGoals.mockResolvedValue([activeGoal, pausedGoal] as never);
    mockedGetProgress.mockResolvedValue([
      activeProgress,
      pausedProgress,
    ] as never);
  });

  it('loads and displays goals and overview counts', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Your goals')).toBeTruthy();
      expect(getByText('Four workouts per week')).toBeTruthy();
      expect(getByText('Run 5 kilometres')).toBeTruthy();
      expect(getByText('Total goals')).toBeTruthy();
      expect(getByText('Active goals')).toBeTruthy();
    });

    expect(mockedGetGoals).toHaveBeenCalledTimes(1);
    expect(mockedGetProgress).toHaveBeenCalledTimes(1);
  });

  it('displays calculated progress and an unavailable state', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('75%')).toBeTruthy();
      expect(getByText('3 workouts/week of 4 workouts/week')).toBeTruthy();
      expect(
        getByText('Progress will appear when the required activity is recorded.'),
      ).toBeTruthy();
    });
  });

  it('filters goals by status', async () => {
    const { getByRole, getByText, queryByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Four workouts per week')).toBeTruthy();
      expect(getByText('Run 5 kilometres')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Paused' }));

    expect(getByText('Run 5 kilometres')).toBeTruthy();
    expect(queryByText('Four workouts per week')).toBeNull();

    await fireEvent.press(getByRole('button', { name: 'Active' }));

    expect(getByText('Four workouts per week')).toBeTruthy();
    expect(queryByText('Run 5 kilometres')).toBeNull();
  });

  it('shows an empty state when no goals exist', async () => {
    mockedGetGoals.mockResolvedValue([]);
    mockedGetProgress.mockResolvedValue([]);

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('No goals yet')).toBeTruthy();
      expect(
        getByText(
          'Create your first fitness goal and start tracking your progress.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows an empty state when the selected filter has no goals', async () => {
    mockedGetGoals.mockResolvedValue([activeGoal] as never);
    mockedGetProgress.mockResolvedValue([activeProgress] as never);

    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Four workouts per week')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Archived' }));

    expect(getByText('No archived goals')).toBeTruthy();
  });

  it('navigates to the selected goal details', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Open Four workouts per week' }),
      ).toBeTruthy();
    });

    await fireEvent.press(
      getByRole('button', { name: 'Open Four workouts per week' }),
    );

    expect(mockedRouterPush).toHaveBeenCalledWith(
      '/(tabs)/personal-workout/goals/goal-active',
    );
  });

  it('navigates to the create goal form', async () => {
    const { getByRole } = await renderScreen();

    await fireEvent.press(getByRole('button', { name: 'Create a goal' }));

    expect(mockedRouterPush).toHaveBeenCalledWith(
      '/(tabs)/personal-workout/goals/new',
    );
  });

  it('displays a loading error and retries the request', async () => {
    mockedGetGoals
      .mockRejectedValueOnce(new Error('Unable to load goals'))
      .mockResolvedValueOnce([activeGoal] as never);

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Unable to load goals')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(getByText('Four workouts per week')).toBeTruthy();
    });

    expect(mockedGetGoals).toHaveBeenCalledTimes(2);
  });
});
