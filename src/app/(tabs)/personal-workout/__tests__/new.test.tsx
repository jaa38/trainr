import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createPersonalWorkout } from '@/services/personal-workouts';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: jest.fn(() => null),
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/services/personal-workouts', () => ({
  createPersonalWorkout: jest.fn(),
}));

import { router } from 'expo-router';
import NewPersonalWorkoutScreen from '../new';

const mockedCreatePersonalWorkout = jest.mocked(createPersonalWorkout);
const mockedRouterBack = jest.mocked(router.back);
const mockedRouterReplace = jest.mocked(router.replace);

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <NewPersonalWorkoutScreen />
    </TrainrThemeProvider>,
  );
}

describe('New Personal Workout screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreatePersonalWorkout.mockResolvedValue({ id: 'workout-123' } as never);
  });

  it('renders the workout setup form', async () => {
    const { getByText, getByLabelText, getByRole } = await renderScreen();

    expect(getByText('New workout')).toBeTruthy();
    expect(getByLabelText('Workout name')).toBeTruthy();
    expect(getByText('Workout category')).toBeTruthy();
    expect(getByLabelText('Workout date')).toBeTruthy();
    expect(getByLabelText('Notes (optional)')).toBeTruthy();
    expect(getByRole('button', { name: 'Start workout' })).toBeTruthy();
    expect(getByRole('button', { name: 'Save as draft' })).toBeTruthy();
  });

  it('shows all supported workout categories', async () => {
    const { getByRole } = await renderScreen();

    for (const category of [
      'Strength',
      'Cardio',
      'Bodyweight',
      'Flexibility',
      'Functional',
      'Custom',
    ]) {
      expect(getByRole('radio', { name: category })).toBeTruthy();
    }
  });

  it('allows the user to change the workout category', async () => {
    const { getByRole, getByLabelText } = await renderScreen();

    await fireEvent.press(getByRole('radio', { name: 'Cardio' }));
    await fireEvent.changeText(getByLabelText('Workout name'), 'Morning run');
    await fireEvent.press(getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(mockedCreatePersonalWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workout_name: 'Morning run',
          workout_type: 'cardio',
          status: 'draft',
        }),
      );
    });
  });

  it('requires a workout name', async () => {
    const { getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('button', { name: 'Save as draft' }));

    expect(getByText('Enter a workout name to continue.')).toBeTruthy();
    expect(mockedCreatePersonalWorkout).not.toHaveBeenCalled();
  });

  it('rejects an invalid workout date', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Workout name'), 'Leg day');
    await fireEvent.changeText(getByLabelText('Workout date'), 'not-a-date');
    await fireEvent.press(getByRole('button', { name: 'Save as draft' }));

    expect(getByText('Enter the date in YYYY-MM-DD format.')).toBeTruthy();
    expect(mockedCreatePersonalWorkout).not.toHaveBeenCalled();
  });

  it('creates a workout as a draft', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Workout name'), 'Upper body strength');
    await fireEvent.changeText(getByLabelText('Notes (optional)'), 'Focus on form');
    await fireEvent.press(getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(mockedCreatePersonalWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workout_name: 'Upper body strength',
          workout_type: 'strength',
          notes: 'Focus on form',
          status: 'draft',
        }),
      );
      expect(mockedRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/personal-workout/[id]',
        params: { id: 'workout-123' },
      });
    });
  });

  it('starts a workout as in progress', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Workout name'), 'Full body session');
    await fireEvent.press(getByRole('button', { name: 'Start workout' }));

    await waitFor(() => {
      expect(mockedCreatePersonalWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workout_name: 'Full body session',
          status: 'in_progress',
        }),
      );
      expect(mockedRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/personal-workout/[id]',
        params: { id: 'workout-123' },
      });
    });
  });

  it('displays an error when workout creation fails', async () => {
    mockedCreatePersonalWorkout.mockRejectedValue(
      new Error('Unable to create your workout. Please try again.'),
    );

    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Workout name'), 'Evening workout');
    await fireEvent.press(getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(getByText('Unable to create your workout. Please try again.')).toBeTruthy();
    });

    expect(mockedRouterBack).not.toHaveBeenCalled();
  });
});
