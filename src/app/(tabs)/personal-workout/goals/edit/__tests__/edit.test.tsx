import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  getFitnessGoalById,
  updateFitnessGoal,
} from '@/services/fitness-goals';
import { getExercises } from '@/services/exercises';
import { getPersonalExercises } from '@/services/personal-exercises';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';
import type { FitnessGoal } from '@/types/personal-workouts';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
      back: jest.fn(),
      replace: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({ id: 'goal-123' })),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/services/fitness-goals', () => ({
  getFitnessGoalById: jest.fn(),
  updateFitnessGoal: jest.fn(),
}));

jest.mock('@/services/exercises', () => ({
  getExercises: jest.fn(),
}));

jest.mock('@/services/personal-exercises', () => ({
  getPersonalExercises: jest.fn(),
}));

import { router } from 'expo-router';
import EditFitnessGoalScreen from '../[id]';

const mockedGetGoal = jest.mocked(getFitnessGoalById);
const mockedUpdateGoal = jest.mocked(updateFitnessGoal);
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

const strengthGoal: FitnessGoal = {
  id: 'goal-123',
  user_id: 'user-123',
  goal_type: 'strength_target',
  goal_name: 'Bench Press Target',
  description: 'Improve bench press strength',
  target_value: 100,
  current_value: null,
  measurement_unit: 'kg',
  exercise_id: 'exercise-1',
  personal_exercise_id: null,
  start_date: '2026-11-01',
  target_date: '2027-02-01',
  goal_status: 'active',
  created_at: '2026-11-01T08:00:00.000Z',
  updated_at: '2026-11-01T08:00:00.000Z',
};

const customGoal: FitnessGoal = {
  ...strengthGoal,
  goal_type: 'custom',
  goal_name: 'Read 12 books',
  description: 'Read consistently',
  target_value: 12,
  current_value: 3,
  measurement_unit: 'books',
  exercise_id: null,
  personal_exercise_id: null,
};

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <EditFitnessGoalScreen />
    </TrainrThemeProvider>,
  );
}

describe('Edit Fitness Goal screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetGoal.mockResolvedValue(strengthGoal);
    mockedUpdateGoal.mockResolvedValue(strengthGoal);
    mockedGetExercises.mockResolvedValue(sharedExercises as never);
    mockedGetPersonalExercises.mockResolvedValue(personalExercises as never);
  });

  it('loads and prepopulates the existing goal', async () => {
    const { getByText, getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Edit goal')).toBeTruthy();
      expect(getByLabelText('Goal name').props.value).toBe('Bench Press Target');
      expect(getByLabelText('Description (optional)').props.value).toBe(
        'Improve bench press strength',
      );
      expect(getByLabelText('Target value').props.value).toBe('100');
      expect(getByLabelText('Start date').props.value).toBe('2026-11-01');
      expect(getByLabelText('Target date (optional)').props.value).toBe('2027-02-01');
      expect(getByRole('radio', { name: 'Strength' }).props.accessibilityState.selected).toBe(true);
      expect(getByRole('radio', { name: 'Bench Press' }).props.accessibilityState.selected).toBe(true);
    });

    expect(mockedGetGoal).toHaveBeenCalledWith('goal-123');
    expect(mockedGetExercises).toHaveBeenCalled();
    expect(mockedGetPersonalExercises).toHaveBeenCalled();
  });

  it('updates an existing strength goal and returns to its detail screen', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Goal name')).toBeTruthy();
    });

    await fireEvent.changeText(
      getByLabelText('Goal name'),
      'Bench Press 110kg',
    );
    await fireEvent.changeText(getByLabelText('Target value'), '110');

    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith(
        'goal-123',
        expect.objectContaining({
          goal_type: 'strength_target',
          goal_name: 'Bench Press 110kg',
          target_value: 110,
          measurement_unit: 'kg',
          exercise_id: 'exercise-1',
          personal_exercise_id: null,
          start_date: '2026-11-01',
          target_date: '2027-02-01',
        }),
      );

      expect(mockedRouterReplace).toHaveBeenCalledWith(
        '/(tabs)/personal-workout/goals/goal-123',
      );
    });
  });

  it('preserves existing custom progress when other fields are edited', async () => {
    mockedGetGoal.mockResolvedValue(customGoal);

    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Current progress').props.value).toBe('3');
      expect(getByLabelText('Unit').props.value).toBe('books');
    });

    await fireEvent.changeText(getByLabelText('Goal name'), 'Read 15 books');
    await fireEvent.changeText(getByLabelText('Target value'), '15');
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith(
        'goal-123',
        expect.objectContaining({
          goal_type: 'custom',
          goal_name: 'Read 15 books',
          target_value: 15,
          current_value: 3,
          measurement_unit: 'books',
        }),
      );
    });
  });

  it('saves an explicitly updated custom progress value', async () => {
    mockedGetGoal.mockResolvedValue(customGoal);

    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Current progress')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Current progress'), '5');
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith(
        'goal-123',
        expect.objectContaining({
          current_value: 5,
        }),
      );
    });
  });

  it('retains the existing shared exercise selection', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('radio', { name: 'Bench Press' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith(
        'goal-123',
        expect.objectContaining({
          exercise_id: 'exercise-1',
          personal_exercise_id: null,
        }),
      );
    });
  });

  it('allows changing to a personal exercise', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('radio', { name: 'Bench Press' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('radio', { name: 'My exercises' }));

    await waitFor(() => {
      expect(getByRole('radio', { name: 'My Squat' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('radio', { name: 'My Squat' }));
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith(
        'goal-123',
        expect.objectContaining({
          exercise_id: null,
          personal_exercise_id: 'personal-exercise-1',
        }),
      );
    });
  });

  it('rejects a non-positive target', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Target value')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Target value'), '0');
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    expect(getByText('Enter a target greater than zero.')).toBeTruthy();
    expect(mockedUpdateGoal).not.toHaveBeenCalled();
  });

  it('rejects a target date before the start date', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Start date')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Start date'), '2026-11-20');
    await fireEvent.changeText(
      getByLabelText('Target date (optional)'),
      '2026-11-10',
    );
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    expect(getByText('Target date cannot be before the start date.')).toBeTruthy();
    expect(mockedUpdateGoal).not.toHaveBeenCalled();
  });

  it('displays service errors without navigating away', async () => {
    mockedUpdateGoal.mockRejectedValue(
      new Error('Unable to update your fitness goal. Please try again.'),
    );

    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Save changes' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(
        getByText('Unable to update your fitness goal. Please try again.'),
      ).toBeTruthy();
    });

    expect(mockedRouterReplace).not.toHaveBeenCalled();
  });
});
