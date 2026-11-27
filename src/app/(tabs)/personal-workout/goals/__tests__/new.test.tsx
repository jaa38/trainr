import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createFitnessGoal } from '@/services/fitness-goals';
import { getExercises } from '@/services/exercises';
import { getPersonalExercises } from '@/services/personal-exercises';
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

jest.mock('@/services/fitness-goals', () => ({
  createFitnessGoal: jest.fn(),
}));

jest.mock('@/services/exercises', () => ({
  getExercises: jest.fn(),
}));

jest.mock('@/services/personal-exercises', () => ({
  getPersonalExercises: jest.fn(),
}));

import { router } from 'expo-router';
import NewFitnessGoalScreen from '../new';

const mockedCreateGoal = jest.mocked(createFitnessGoal);
const mockedGetExercises = jest.mocked(getExercises);
const mockedGetPersonalExercises = jest.mocked(getPersonalExercises);
const mockedRouterReplace = jest.mocked(router.replace);

const sharedExercises = [
  {
    id: 'exercise-1',
    name: 'Bench Press',
    description: null,
    muscle_group: 'Chest',
    category: 'strength',
    equipment: ['barbell'],
    instructions: null,
    image_url: null,
    video_url: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'exercise-2',
    name: 'Running',
    description: null,
    muscle_group: 'Cardio',
    category: 'cardio',
    equipment: [],
    instructions: null,
    image_url: null,
    video_url: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

const personalExercises = [
  {
    id: 'personal-exercise-1',
    user_id: 'user-123',
    name: 'My Squat',
    description: null,
    category: 'strength',
    muscle_group: 'Legs',
    equipment: [],
    instructions: null,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <NewFitnessGoalScreen />
    </TrainrThemeProvider>,
  );
}

describe('New Fitness Goal screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedCreateGoal.mockResolvedValue({ id: 'goal-123' } as never);
    mockedGetExercises.mockResolvedValue(sharedExercises as never);
    mockedGetPersonalExercises.mockResolvedValue(personalExercises as never);
  });

  it('renders the goal creation form and all supported goal types', async () => {
    const { getByText, getByLabelText, getByRole } = await renderScreen();

    expect(getByText('Create a goal')).toBeTruthy();
    expect(getByLabelText('Goal name')).toBeTruthy();
    expect(getByLabelText('Target value')).toBeTruthy();
    expect(getByLabelText('Start date')).toBeTruthy();
    expect(getByLabelText('Target date (optional)')).toBeTruthy();

    for (const type of [
      'Workout frequency',
      'Strength',
      'Cardio',
      'Workout duration',
      'Body weight',
      'Custom',
    ]) {
      expect(getByRole('radio', { name: type })).toBeTruthy();
    }
  });

  it('requires a goal name', async () => {
    const { getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    expect(getByText('Enter a name for this goal.')).toBeTruthy();
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it('requires a positive target value', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Goal name'), 'Weekly workouts');
    await fireEvent.changeText(getByLabelText('Target value'), '0');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    expect(getByText('Enter a target greater than zero.')).toBeTruthy();
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it('creates a workout frequency goal', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Goal name'), 'Four workouts per week');
    await fireEvent.changeText(getByLabelText('Target value'), '4');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_type: 'workout_frequency',
          goal_name: 'Four workouts per week',
          target_value: 4,
          measurement_unit: 'workouts/week',
        }),
      );
      expect(mockedRouterReplace).toHaveBeenCalledWith(
        '/(tabs)/personal-workout/goals',
      );
    });
  });

  it('shows manual progress and requires a unit for custom goals', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('radio', { name: 'Custom' }));
    await fireEvent.changeText(getByLabelText('Goal name'), 'Read 12 books');
    await fireEvent.changeText(getByLabelText('Target value'), '12');
    await fireEvent.changeText(getByLabelText('Current progress (optional)'), '3');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    expect(getByText(/Enter a unit for your custom goal/)).toBeTruthy();
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it('creates a custom goal with manual progress and a unit', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await fireEvent.press(getByRole('radio', { name: 'Custom' }));
    await fireEvent.changeText(getByLabelText('Goal name'), 'Read 12 books');
    await fireEvent.changeText(getByLabelText('Target value'), '12');
    await fireEvent.changeText(getByLabelText('Unit'), 'books');
    await fireEvent.changeText(getByLabelText('Current progress (optional)'), '3');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_type: 'custom',
          goal_name: 'Read 12 books',
          target_value: 12,
          current_value: 3,
          measurement_unit: 'books',
        }),
      );
    });
  });

  it('requires an exercise for a strength goal and saves the selected shared exercise', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.press(getByRole('radio', { name: 'Strength' }));
    await fireEvent.changeText(getByLabelText('Goal name'), 'Bench press 100kg');
    await fireEvent.changeText(getByLabelText('Target value'), '100');

    await waitFor(() => {
      expect(getByRole('radio', { name: 'Bench Press' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Create goal' }));
    expect(getByText('Select an exercise to track for this goal.')).toBeTruthy();
    expect(mockedCreateGoal).not.toHaveBeenCalled();

    await fireEvent.press(getByRole('radio', { name: 'Bench Press' }));
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_type: 'strength_target',
          exercise_id: 'exercise-1',
          measurement_unit: 'kg',
        }),
      );
    });
  });

  it('supports selecting a personal exercise', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await fireEvent.press(getByRole('radio', { name: 'Strength' }));
    await fireEvent.changeText(getByLabelText('Goal name'), 'Squat target');
    await fireEvent.changeText(getByLabelText('Target value'), '120');

    await fireEvent.press(getByRole('radio', { name: 'My exercises' }));

    await waitFor(() => {
      expect(getByRole('radio', { name: 'My Squat' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('radio', { name: 'My Squat' }));
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          personal_exercise_id: 'personal-exercise-1',
        }),
      );
    });
  });

  it('rejects a target date before the start date', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Goal name'), 'Weekly workouts');
    await fireEvent.changeText(getByLabelText('Target value'), '4');
    await fireEvent.changeText(getByLabelText('Start date'), '2026-11-20');
    await fireEvent.changeText(getByLabelText('Target date (optional)'), '2026-11-10');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    expect(getByText('Target date cannot be before the start date.')).toBeTruthy();
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it('displays service errors without navigating away', async () => {
    mockedCreateGoal.mockRejectedValue(
      new Error('Unable to create your fitness goal. Please try again.'),
    );

    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Goal name'), 'Weekly workouts');
    await fireEvent.changeText(getByLabelText('Target value'), '4');
    await fireEvent.press(getByRole('button', { name: 'Create goal' }));

    await waitFor(() => {
      expect(
        getByText('Unable to create your fitness goal. Please try again.'),
      ).toBeTruthy();
    });

    expect(mockedRouterReplace).not.toHaveBeenCalled();
  });
});
