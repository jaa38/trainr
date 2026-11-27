import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getFitnessGoals } from '@/services/fitness-goals';
import { getPersonalRecords } from '@/services/personal-records';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PersonalWorkout } from '@/types/personal-workouts';

jest.mock('lucide-react-native', () => ({
  Activity: jest.fn(() => null),
  ArrowLeft: jest.fn(() => null),
  Dumbbell: jest.fn(() => null),
  Flag: jest.fn(() => null),
  SlidersHorizontal: jest.fn(() => null),
  Trophy: jest.fn(() => null),
  TrendingUp: jest.fn(() => null),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return function MockDateTimePicker({
    onChange,
    minimumDate,
  }: {
    onChange: (event: { type: string }, date?: Date) => void;
    minimumDate?: Date;
  }) {
    const selectedDate = minimumDate
      ? new Date('2026-11-30T12:00:00')
      : new Date('2026-11-01T12:00:00');

    return React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: 'Mock date picker',
        onPress: () => onChange({ type: 'set' }, selectedDate),
      },
      React.createElement(Text, null, 'Date picker'),
    );
  };
});

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
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

jest.mock('@/services/personal-records', () => ({
  getPersonalRecords: jest.fn(),
}));

jest.mock('@/services/personal-workouts', () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

import { router } from 'expo-router';
import PersonalWorkoutOverviewScreen from '../index';

const mockedGetHistory = jest.mocked(getPersonalWorkoutHistory);
const mockedGetGoals = jest.mocked(getFitnessGoals);
const mockedGetRecords = jest.mocked(getPersonalRecords);
const mockedPush = jest.mocked(router.push);

const workout: PersonalWorkout = {
  id: 'workout-123',
  user_id: 'user-123',
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

async function renderScreen() {
  const rendered = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <TrainrThemeProvider>
        <PersonalWorkoutOverviewScreen />
      </TrainrThemeProvider>
    </SafeAreaProvider>,
  );

  const {
    getByRole,
    getByText,
    getByLabelText,
    queryByRole,
    queryByText,
    queryByLabelText,
  } = rendered;

  await fireEvent.press(getByRole('tab', { name: 'Workout History tab' }));

  await waitFor(() => {
    expect(getByLabelText('Search workouts by name')).toBeTruthy();
  });

  return {
    ...rendered,
    getByRole,
    getByText,
    getByLabelText,
    queryByRole,
    queryByText,
    queryByLabelText,
  };
}

describe('Personal Workout History screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetHistory.mockResolvedValue([workout]);
    mockedGetGoals.mockResolvedValue([]);
    mockedGetRecords.mockResolvedValue([]);
  });

  it('loads and displays workout history', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Upper body strength')).toBeTruthy();
      expect(getByText('Strength · 25 Nov 2026')).toBeTruthy();
      expect(getByText('60 min')).toBeTruthy();
    });

    expect(mockedGetHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
      }),
    );
  });

  it('applies search, category and date filters together', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Search workouts by name')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Search workouts by name'), 'upper body');
    await fireEvent.press(getByRole('button', { name: 'Filter workouts' }));
    await fireEvent.press(getByRole('button', { name: 'Filter by Cardio' }));
    await fireEvent.press(getByLabelText('Select start date'));
    await fireEvent.press(getByRole('button', { name: 'Mock date picker' }));
    await fireEvent.press(getByRole('button', { name: 'Done selecting date' }));

    await fireEvent.press(getByLabelText('Select end date'));
    await fireEvent.press(getByRole('button', { name: 'Mock date picker' }));
    await fireEvent.press(getByRole('button', { name: 'Done selecting date' }));
    await fireEvent.press(getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(mockedGetHistory).toHaveBeenLastCalledWith({
        limit: 20,
        offset: 0,
        search: 'upper body',
        workout_type: 'cardio',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      });
    });
  });

  it('clears applied filters', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Search workouts by name')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Search workouts by name'), 'upper body');
    await fireEvent.press(getByRole('button', { name: 'Filter workouts' }));
    await fireEvent.press(getByRole('button', { name: 'Filter by Cardio' }));
    await fireEvent.press(getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(mockedGetHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'upper body',
          workout_type: 'cardio',
        }),
      );
    });

    await fireEvent.press(getByRole('button', { name: 'Edit workout filters' }));
    await fireEvent.press(getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(mockedGetHistory).toHaveBeenLastCalledWith({
        limit: 20,
        offset: 0,
        search: undefined,
        workout_type: undefined,
        start_date: undefined,
        end_date: undefined,
      });
    });
  });

  it('navigates to the selected workout details', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'View Upper body strength' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'View Upper body strength' }));

    expect(mockedPush).toHaveBeenCalledWith('/(tabs)/personal-workout/workout-123');
  });

  it('loads the next page of workout history', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      ...workout,
      id: `workout-${index + 1}`,
      workout_name: `Workout ${index + 1}`,
    }));

    mockedGetHistory.mockResolvedValueOnce(firstPage);
    mockedGetHistory.mockResolvedValueOnce([
      {
        ...workout,
        id: 'workout-21',
        workout_name: 'Workout 21',
      },
    ]);

    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Load more workouts' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Load more workouts' }));

    await waitFor(() => {
      expect(getByText('Workout 21')).toBeTruthy();
    });

    expect(mockedGetHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 20,
      }),
    );
  });

  it('shows an empty state when no workouts match', async () => {
    mockedGetHistory.mockResolvedValue([]);

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('No workouts found')).toBeTruthy();
    });
  });

  it('shows a retry action when history loading fails', async () => {
    mockedGetHistory.mockRejectedValue(
      new Error('Unable to load your workout history. Please try again.'),
    );

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(
        getByText('Unable to load your workout history. Please try again.'),
      ).toBeTruthy();
      expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });
});
