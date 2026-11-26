import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getFitnessGoals } from '@/services/fitness-goals';
import { getPersonalRecords } from '@/services/personal-records';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { getTrainerDashboard } from '@/services/trainer-dashboard';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';

jest.mock('lucide-react-native', () => ({
  ArrowRight: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    useRouter: () => ({
      push: jest.fn(),
    }),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

jest.mock('@/services/trainer-dashboard', () => ({
  getTrainerDashboard: jest.fn(),
}));

jest.mock('@/services/personal-workouts', () => ({
  getPersonalWorkoutHistory: jest.fn(),
}));

jest.mock('@/services/fitness-goals', () => ({
  getFitnessGoals: jest.fn(),
}));

jest.mock('@/services/personal-records', () => ({
  getPersonalRecords: jest.fn(),
}));

import PersonalTrainerHomeScreen from '../index';

const mockedGetTrainerDashboard = jest.mocked(getTrainerDashboard);
const mockedGetPersonalWorkoutHistory = jest.mocked(getPersonalWorkoutHistory);
const mockedGetFitnessGoals = jest.mocked(getFitnessGoals);
const mockedGetPersonalRecords = jest.mocked(getPersonalRecords);

const dashboard = {
  metrics: {
    activeClients: 4,
    pendingRequests: 2,
    upcomingSessions: 3,
    completedSessions: 12,
  },
  timezone: 'Africa/Lagos',
  upcomingSessions: [
    {
      id: 'session-1',
      client_name: 'Alex Smith',
      scheduled_start: '2026-11-27T10:00:00.000Z',
      scheduled_end: '2026-11-27T11:00:00.000Z',
      status: 'confirmed',
    },
  ],
};

const personalWorkouts = [
  {
    id: 'workout-1',
    user_id: 'trainer-123',
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
  },
];

const fitnessGoals = [
  {
    id: 'goal-1',
    user_id: 'trainer-123',
    goal_type: 'strength_target',
    goal_name: 'Improve squat strength',
    description: null,
    target_value: 100,
    measurement_unit: 'kg',
    start_date: '2026-11-01',
    target_date: '2026-12-31',
    goal_status: 'active',
    created_at: '2026-11-01T09:00:00.000Z',
    updated_at: '2026-11-01T09:00:00.000Z',
  },
];

const personalRecords = [
  {
    id: 'record-1',
    user_id: 'trainer-123',
    exercise_id: null,
    personal_exercise_id: 'exercise-1',
    exercise_category: 'strength',
    source_category: 'personal',
    record_type: 'max_weight',
    record_value: 80,
    measurement_unit: 'kg',
    workout_set_id: 'set-1',
    achieved_at: '2026-11-25T10:00:00.000Z',
    comparison_distance_meters: null,
  },
];

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <PersonalTrainerHomeScreen />
    </TrainrThemeProvider>,
  );
}

describe('Personal Trainer Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetTrainerDashboard.mockResolvedValue(dashboard as never);
    mockedGetPersonalWorkoutHistory.mockResolvedValue(personalWorkouts as never);
    mockedGetFitnessGoals.mockResolvedValue(fitnessGoals as never);
    mockedGetPersonalRecords.mockResolvedValue(personalRecords as never);
  });

  it('renders the three dashboard tabs and defaults to Clients', async () => {
    const { getByRole, getByText } = await renderScreen();

    expect(getByRole('tab', { name: 'Clients tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Progress tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'My Progress tab' })).toBeTruthy();

    expect(getByRole('tab', { name: 'Clients tab' }).props.accessibilityState).toEqual({
      selected: true,
    });

    await waitFor(() => {
      expect(getByText('CLIENT OVERVIEW')).toBeTruthy();
      expect(getByText('UPCOMING SESSIONS')).toBeTruthy();
      expect(getByText('QUICK ACTIONS')).toBeTruthy();
      expect(getByText('Alex Smith')).toBeTruthy();
    });

    expect(mockedGetTrainerDashboard).toHaveBeenCalled();
    expect(mockedGetPersonalWorkoutHistory).not.toHaveBeenCalled();
    expect(mockedGetFitnessGoals).not.toHaveBeenCalled();
    expect(mockedGetPersonalRecords).not.toHaveBeenCalled();
  });

  it('shows professional coaching metrics in the Progress tab', async () => {
    const { getByRole, getByText, queryByText } = await renderScreen();

    await fireEvent.press(getByRole('tab', { name: 'Progress tab' }));

    await waitFor(() => {
      expect(getByText('Your professional performance')).toBeTruthy();
      expect(getByText('ACTIVE CLIENTS')).toBeTruthy();
      expect(getByText('PENDING REQUESTS')).toBeTruthy();
      expect(getByText('UPCOMING SESSIONS')).toBeTruthy();
      expect(getByText('COMPLETED SESSIONS')).toBeTruthy();
    });

    expect(queryByText('RECENT WORKOUTS')).toBeNull();
    expect(mockedGetPersonalWorkoutHistory).not.toHaveBeenCalled();
    expect(mockedGetFitnessGoals).not.toHaveBeenCalled();
    expect(mockedGetPersonalRecords).not.toHaveBeenCalled();
  });

  it('loads and displays the trainer’s own workouts, goals and personal records', async () => {
    const { getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('tab', { name: 'My Progress tab' }));

    await waitFor(() => {
      expect(getByText('Your personal fitness')).toBeTruthy();
      expect(getByText('RECENT WORKOUTS')).toBeTruthy();
      expect(getByText('Upper body strength')).toBeTruthy();
      expect(getByText('ACTIVE FITNESS GOALS')).toBeTruthy();
      expect(getByText('Improve squat strength')).toBeTruthy();
      expect(getByText('PERSONAL RECORDS')).toBeTruthy();
      expect(getByText('80 kg')).toBeTruthy();
    });

    expect(mockedGetPersonalWorkoutHistory).toHaveBeenCalledWith({ limit: 3 });
    expect(mockedGetFitnessGoals).toHaveBeenCalledWith({ status: 'active' });
    expect(mockedGetPersonalRecords).toHaveBeenCalledWith({ limit: 3 });
  });

  it('keeps successful personal sections visible when another section fails', async () => {
    mockedGetPersonalWorkoutHistory.mockRejectedValue(
      new Error('Unable to load workout history. Please try again.'),
    );

    const { getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('tab', { name: 'My Progress tab' }));

    await waitFor(() => {
      expect(
        getByText('Unable to load workout history. Pull down to try again.'),
      ).toBeTruthy();

      expect(getByText('Improve squat strength')).toBeTruthy();
      expect(getByText('80 kg')).toBeTruthy();
    });
  });

  it('provides a route to the personal workout feature', async () => {
    const { getByRole } = await renderScreen();

    await fireEvent.press(getByRole('tab', { name: 'My Progress tab' }));

    expect(getByRole('button', { name: 'Open your personal workouts' })).toBeTruthy();
  });
});
