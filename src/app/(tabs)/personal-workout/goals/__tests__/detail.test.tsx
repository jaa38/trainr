import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  completeFitnessGoal,
  deleteFitnessGoal,
  getFitnessGoalById,
  updateFitnessGoal,
} from '@/services/fitness-goals';
import {
  getFitnessGoalProgress,
} from '@/services/fitness-goal-progress';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';

jest.mock('lucide-react-native', () => ({
  Archive: jest.fn(() => null),
  ArrowLeft: jest.fn(() => null),
  CalendarDays: jest.fn(() => null),
  CheckCircle2: jest.fn(() => null),
  Edit3: jest.fn(() => null),
  Pause: jest.fn(() => null),
  Play: jest.fn(() => null),
  Target: jest.fn(() => null),
  Trash2: jest.fn(() => null),
  TrendingUp: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    router: {
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({ id: 'goal-123' })),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/services/fitness-goals', () => ({
  completeFitnessGoal: jest.fn(),
  deleteFitnessGoal: jest.fn(),
  getFitnessGoalById: jest.fn(),
  updateFitnessGoal: jest.fn(),
}));

jest.mock('@/services/fitness-goal-progress', () => ({
  getFitnessGoalProgress: jest.fn(),
}));

import { router } from 'expo-router';
import FitnessGoalDetailScreen from '../[id]';

const mockedGetGoal = jest.mocked(getFitnessGoalById);
const mockedGetProgress = jest.mocked(getFitnessGoalProgress);
const mockedUpdateGoal = jest.mocked(updateFitnessGoal);
const mockedCompleteGoal = jest.mocked(completeFitnessGoal);
const mockedDeleteGoal = jest.mocked(deleteFitnessGoal);
const mockedRouterPush = jest.mocked(router.push);
const mockedRouterReplace = jest.mocked(router.replace);
const mockedRouterBack = jest.mocked(router.back);

const customGoal = {
  id: 'goal-123',
  user_id: 'user-123',
  goal_type: 'custom' as const,
  goal_name: 'Read 12 books',
  description: 'Build a consistent reading habit.',
  target_value: 12,
  current_value: 3,
  measurement_unit: 'books',
  exercise_id: null,
  personal_exercise_id: null,
  start_date: '2026-11-01',
  target_date: '2027-02-01',
  goal_status: 'active' as const,
  created_at: '2026-11-01T08:00:00.000Z',
  updated_at: '2026-11-01T08:00:00.000Z',
};

const activeGoal = {
  ...customGoal,
  goal_type: 'workout_frequency' as const,
  goal_name: 'Four workouts per week',
  description: null,
  current_value: null,
  measurement_unit: 'workouts/week',
};

const progress = {
  goalId: 'goal-123',
  goalName: customGoal.goal_name,
  goalType: 'custom' as const,
  currentValue: 3,
  targetValue: 12,
  unit: 'books',
  progressPercentage: 25,
  isAvailable: true,
};

const unavailableProgress = {
  ...progress,
  currentValue: null,
  progressPercentage: null,
  isAvailable: false,
};

async function renderScreen() {
  return render(
    <TrainrThemeProvider>
      <FitnessGoalDetailScreen />
    </TrainrThemeProvider>,
  );
}

function getAlertButtons(alertSpy: jest.SpyInstance) {
  const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  return lastCall?.[2] ?? [];
}

async function confirmAlertAction(
  alertSpy: jest.SpyInstance,
  buttonText: string,
) {
  const buttons = getAlertButtons(alertSpy);
  const action = buttons.find(
    (button: { text?: string }) => button.text === buttonText,
  );

  expect(action).toBeTruthy();

  await act(async () => {
    action.onPress?.();
  });
}

describe('Fitness Goal Detail screen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetGoal.mockResolvedValue(customGoal as never);
    mockedGetProgress.mockResolvedValue(progress as never);
    mockedUpdateGoal.mockResolvedValue(customGoal as never);
    mockedCompleteGoal.mockResolvedValue({
      ...customGoal,
      goal_status: 'completed',
    } as never);
    mockedDeleteGoal.mockResolvedValue(undefined);

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('loads and displays goal details and calculated progress', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Read 12 books')).toBeTruthy();
      expect(getByText('Build a consistent reading habit.')).toBeTruthy();
      expect(getByText('25%')).toBeTruthy();
      expect(getByText('3 books of 12 books')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();
    });

    expect(mockedGetGoal).toHaveBeenCalledWith('goal-123');
    expect(mockedGetProgress).toHaveBeenCalledWith('goal-123');
  });

  it('explains when progress is not available', async () => {
    mockedGetProgress.mockResolvedValue(unavailableProgress as never);

    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Progress is not available yet. Record the required activity to start tracking this goal.')).toBeTruthy();
    });
  });

  it('saves manually updated custom goal progress', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Current progress')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Current progress'), '5');
    await fireEvent.press(getByRole('button', { name: 'Save progress' }));

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith('goal-123', {
        current_value: 5,
      });
    });
  });

  it('rejects invalid manual progress', async () => {
    const { getByLabelText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByLabelText('Current progress')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Current progress'), '-2');
    await fireEvent.press(getByRole('button', { name: 'Save progress' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid progress',
      'Enter a valid number greater than or equal to zero.',
    );
    expect(mockedUpdateGoal).not.toHaveBeenCalled();
  });

  it('navigates to the edit form', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Edit goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Edit goal' }));

    expect(mockedRouterPush).toHaveBeenCalledWith(
      '/(tabs)/personal-workout/goals/edit/goal-123',
    );
  });

  it('pauses a goal after confirmation', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Pause goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Pause goal' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Pause goal',
      'You can resume this goal whenever you are ready.',
      expect.any(Array),
    );

    await confirmAlertAction(alertSpy, 'Pause goal');

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith('goal-123', {
        goal_status: 'paused',
      });
    });
  });

  it('resumes a paused goal after confirmation', async () => {
    mockedGetGoal.mockResolvedValue({
      ...activeGoal,
      goal_status: 'paused',
    } as never);

    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Resume goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Resume goal' }));
    await confirmAlertAction(alertSpy, 'Resume goal');

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith('goal-123', {
        goal_status: 'active',
      });
    });
  });

  it('completes a goal after confirmation', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Mark as completed' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Mark as completed' }));
    await confirmAlertAction(alertSpy, 'Mark completed');

    await waitFor(() => {
      expect(mockedCompleteGoal).toHaveBeenCalledWith('goal-123');
    });
  });

  it('archives a goal after confirmation', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Archive goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Archive goal' }));
    await confirmAlertAction(alertSpy, 'Archive goal');

    await waitFor(() => {
      expect(mockedUpdateGoal).toHaveBeenCalledWith('goal-123', {
        goal_status: 'archived',
      });
    });
  });

  it('deletes a goal only after confirmation', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Delete goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Delete goal' }));

    expect(mockedDeleteGoal).not.toHaveBeenCalled();

    await confirmAlertAction(alertSpy, 'Delete');

    await waitFor(() => {
      expect(mockedDeleteGoal).toHaveBeenCalledWith('goal-123');
      expect(mockedRouterReplace).toHaveBeenCalledWith(
        '/(tabs)/personal-workout/goals',
      );
    });
  });

  it('does not perform a status change when confirmation is cancelled', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Pause goal' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Pause goal' }));

    const cancel = getAlertButtons(alertSpy).find(
      (button: { text?: string }) => button.text === 'Cancel',
    );

    cancel.onPress?.();

    expect(mockedUpdateGoal).not.toHaveBeenCalled();
  });

  it('shows a loading error and allows retry', async () => {
    mockedGetGoal
      .mockRejectedValueOnce(new Error('Goal could not be loaded'))
      .mockResolvedValueOnce(customGoal as never);

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Goal could not be loaded')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(getByText('Read 12 books')).toBeTruthy();
    });

    expect(mockedGetGoal).toHaveBeenCalledTimes(2);
  });

  it('returns to the previous screen using the back control', async () => {
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Go back' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Go back' }));

    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });
});
