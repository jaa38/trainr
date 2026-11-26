import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  completePersonalWorkout,
  deletePersonalWorkout,
  updatePersonalWorkout,
} from '@/services/personal-workouts';
import {
  createWorkoutExercise,
  deleteWorkoutExercise,
  getPersonalWorkoutDetails,
} from '@/services/personal-workout-exercises';
import {
  createPersonalExercise,
  getPersonalExercises,
} from '@/services/personal-exercises';
import { createWorkoutSet } from '@/services/personal-workout-sets';
import { getExercises } from '@/services/exercises';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';
import type { PersonalExercise, PersonalWorkoutDetails } from '@/types/personal-workouts';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: jest.fn(() => null),
  CheckCircle2: jest.fn(() => null),
  Plus: jest.fn(() => null),
  Dumbbell: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
      back: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({ id: 'workout-123' })),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/services/personal-workouts', () => ({
  completePersonalWorkout: jest.fn(),
  deletePersonalWorkout: jest.fn(),
  updatePersonalWorkout: jest.fn(),
}));

jest.mock('@/services/personal-workout-exercises', () => ({
  getPersonalWorkoutDetails: jest.fn(),
  createWorkoutExercise: jest.fn(),
  deleteWorkoutExercise: jest.fn(),
}));

jest.mock('@/services/personal-exercises', () => ({
  createPersonalExercise: jest.fn(),
  getPersonalExercises: jest.fn(),
}));

jest.mock('@/services/exercises', () => ({
  getExercises: jest.fn(),
}));

jest.mock('@/services/personal-workout-sets', () => ({
  createWorkoutSet: jest.fn(),
}));

import PersonalWorkoutDetailScreen from '../[id]';

const mockedGetWorkout = jest.mocked(getPersonalWorkoutDetails);
const mockedGetPersonalExercises = jest.mocked(getPersonalExercises);
const mockedGetExercises = jest.mocked(getExercises);
const mockedCreatePersonalExercise = jest.mocked(createPersonalExercise);
const mockedCreateWorkoutExercise = jest.mocked(createWorkoutExercise);
const mockedCreateWorkoutSet = jest.mocked(createWorkoutSet);
const mockedCompleteWorkout = jest.mocked(completePersonalWorkout);
const mockedUpdateWorkout = jest.mocked(updatePersonalWorkout);
const mockedDeleteWorkout = jest.mocked(deletePersonalWorkout);
const mockedDeleteWorkoutExercise = jest.mocked(deleteWorkoutExercise);

const personalExercise: PersonalExercise = {
  id: 'exercise-1',
  user_id: 'user-123',
  name: 'Dumbbell press',
  description: null,
  category: 'strength',
  muscle_group: 'Chest',
  equipment: ['Dumbbells'],
  instructions: null,
  archived_at: null,
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T09:00:00.000Z',
};

const workout: PersonalWorkoutDetails = {
  id: 'workout-123',
  user_id: 'user-123',
  workout_name: 'Upper body strength',
  workout_type: 'strength',
  workout_date: '2026-11-25',
  started_at: '2026-11-25T09:00:00.000Z',
  completed_at: null,
  duration_seconds: null,
  notes: 'Focus on form',
  status: 'in_progress',
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T09:00:00.000Z',
  exercises: [
    {
      id: 'workout-exercise-1',
      workout_id: 'workout-123',
      exercise_id: null,
      personal_exercise_id: 'exercise-1',
      exercise_order: 0,
      notes: null,
      created_at: '2026-11-25T09:00:00.000Z',
      sets: [],
    },
  ],
};

const completedWorkout: PersonalWorkoutDetails = {
  ...workout,
  status: 'completed',
  completed_at: '2026-11-25T10:00:00.000Z',
  duration_seconds: 3600,
};

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <PersonalWorkoutDetailScreen />
    </TrainrThemeProvider>,
  );
}

describe('Personal Workout Detail screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetWorkout.mockResolvedValue(workout);
    mockedGetPersonalExercises.mockResolvedValue([personalExercise]);
    mockedGetExercises.mockResolvedValue([]);
    mockedCreatePersonalExercise.mockResolvedValue(personalExercise);
    mockedCreateWorkoutExercise.mockResolvedValue({} as never);
    mockedCreateWorkoutSet.mockResolvedValue({} as never);
    mockedCompleteWorkout.mockResolvedValue(completedWorkout);
    mockedUpdateWorkout.mockResolvedValue(workout);
    mockedDeleteWorkout.mockResolvedValue(undefined);
    mockedDeleteWorkoutExercise.mockResolvedValue(undefined);
  });

  it('loads and displays workout details and exercises', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Upper body strength')).toBeTruthy();
      expect(getByText('Dumbbell press')).toBeTruthy();
      expect(getByText('Focus on form')).toBeTruthy();
      expect(getByText('in progress')).toBeTruthy();
    });

    expect(mockedGetWorkout).toHaveBeenCalledWith('workout-123');
    expect(mockedGetPersonalExercises).toHaveBeenCalled();
  });

  it('shows an empty state when the workout has no exercises', async () => {
    mockedGetWorkout.mockResolvedValue({
      ...workout,
      exercises: [],
    });

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('No exercises added yet')).toBeTruthy();
    });
  });

  it('adds an existing personal exercise to the workout', async () => {
    mockedGetWorkout.mockResolvedValue({
      ...workout,
      exercises: [],
    });

    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(
      getByRole('button', { name: 'Add Dumbbell press from personal exercises' }),
    );

    await waitFor(() => {
      expect(mockedCreateWorkoutExercise).toHaveBeenCalledWith({
        workout_id: 'workout-123',
        personal_exercise_id: 'exercise-1',
        exercise_order: 0,
      });
    });
  });

  it('creates a personal exercise and adds it to the workout', async () => {
    const { getByRole, getByLabelText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(getByRole('button', { name: 'Create personal exercise' }));
    await fireEvent.changeText(
      getByLabelText('Exercise name'),
      'Dumbbell shoulder press',
    );
    await fireEvent.changeText(getByLabelText('Muscle group (optional)'), 'Shoulders');
    await fireEvent.press(getByRole('button', { name: 'Create and add exercise' }));

    await waitFor(() => {
      expect(mockedCreatePersonalExercise).toHaveBeenCalledWith({
        name: 'Dumbbell shoulder press',
        category: 'strength',
        muscle_group: 'Shoulders',
      });

      expect(mockedCreateWorkoutExercise).toHaveBeenCalledWith({
        workout_id: 'workout-123',
        personal_exercise_id: 'exercise-1',
        exercise_order: 1,
      });
    });
  });

  it('requires an exercise name before creating a personal exercise', async () => {
    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(getByRole('button', { name: 'Create personal exercise' }));
    await fireEvent.press(getByRole('button', { name: 'Create and add exercise' }));

    expect(getByText('Enter an exercise name to continue.')).toBeTruthy();
    expect(mockedCreatePersonalExercise).not.toHaveBeenCalled();
  });

  it('logs a set with repetitions and weight', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Repetitions for Dumbbell press')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Repetitions for Dumbbell press'), '10');
    await fireEvent.changeText(getByLabelText('Weight in kg for Dumbbell press'), '20');
    await fireEvent.press(getByRole('button', { name: 'Add set' }));

    await waitFor(() => {
      expect(mockedCreateWorkoutSet).toHaveBeenCalledWith({
        workout_exercise_id: 'workout-exercise-1',
        set_number: 1,
        repetitions: 10,
        weight: 20,
        weight_unit: 'kg',
      });
    });
  });

  it('rejects an empty set before calling the service', async () => {
    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Add set' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Add set' }));

    expect(getByText('Enter repetitions or weight before adding a set.')).toBeTruthy();
    expect(mockedCreateWorkoutSet).not.toHaveBeenCalled();
  });

  it('completes the workout and reloads its details', async () => {
    mockedGetWorkout
      .mockResolvedValueOnce(workout)
      .mockResolvedValueOnce(completedWorkout);

    const { getByRole, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Complete workout' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Complete workout' }));

    await waitFor(() => {
      expect(mockedCompleteWorkout).toHaveBeenCalledWith('workout-123');
      expect(mockedGetWorkout).toHaveBeenCalledTimes(2);
      expect(getByText('Duration: 60 min')).toBeTruthy();
    });
  });

  it('allows completed workouts to be updated without completing them again', async () => {
    mockedGetWorkout.mockResolvedValue(completedWorkout);

    const { getByText, getByRole, getByLabelText, queryByRole } =
      await renderScreen();

    await waitFor(() => {
      expect(getByText('Completed')).toBeTruthy();
    });

    expect(getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    expect(getByRole('button', { name: 'Add set' })).toBeTruthy();
    expect(getByLabelText('Repetitions for Dumbbell press')).toBeTruthy();
    expect(queryByRole('button', { name: 'Complete workout' })).toBeNull();
  });

  it('edits workout details and saves the changes', async () => {
    const { getByRole, getByLabelText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Edit workout' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Edit workout' }));
    await fireEvent.changeText(getByLabelText('Workout name'), 'Updated upper body');
    await fireEvent.changeText(getByLabelText('Workout date (YYYY-MM-DD)'), '2026-11-26');
    await fireEvent.changeText(
      getByLabelText('Notes (optional)'),
      'Updated training notes',
    );
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateWorkout).toHaveBeenCalledWith('workout-123', {
        workout_name: 'Updated upper body',
        workout_type: 'strength',
        workout_date: '2026-11-26',
        notes: 'Updated training notes',
      });
    });
  });

  it('rejects an empty workout name before saving', async () => {
    const { getByRole, getByLabelText, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Edit workout' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Edit workout' }));
    await fireEvent.changeText(getByLabelText('Workout name'), '');
    await fireEvent.press(getByRole('button', { name: 'Save changes' }));

    expect(getByText('Enter a workout name to continue.')).toBeTruthy();
    expect(mockedUpdateWorkout).not.toHaveBeenCalled();
  });

  it('deletes the workout only after confirmation', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === 'Delete')?.onPress?.();
      });

    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Delete workout' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Delete workout' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Delete workout?',
        expect.any(String),
        expect.any(Array),
      );
      expect(mockedDeleteWorkout).toHaveBeenCalledWith('workout-123');
    });

    alertSpy.mockRestore();
  });

  it('removes an exercise only after confirmation', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === 'Remove')?.onPress?.();
      });

    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Remove exercise' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Remove exercise' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Remove exercise?',
        expect.stringContaining('Dumbbell press'),
        expect.any(Array),
      );
      expect(mockedDeleteWorkoutExercise).toHaveBeenCalledWith('workout-exercise-1');
    });

    alertSpy.mockRestore();
  });

  it('allows completed workouts and their exercises to be edited or deleted', async () => {
    mockedGetWorkout.mockResolvedValue(completedWorkout);

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Completed')).toBeTruthy();
    });

    expect(getByRole('button', { name: 'Edit workout' })).toBeTruthy();
    expect(getByRole('button', { name: 'Delete workout' })).toBeTruthy();
    expect(getByRole('button', { name: 'Remove exercise' })).toBeTruthy();
  });

  it('displays a loading error and allows retrying', async () => {
    mockedGetWorkout
      .mockRejectedValueOnce(new Error('Unable to load workout.'))
      .mockResolvedValueOnce(workout);

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Unable to load workout.')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(getByText('Upper body strength')).toBeTruthy();
    });

    expect(mockedGetWorkout).toHaveBeenCalledTimes(2);
  });
});
