import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  createFitnessProgress,
  deleteFitnessProgress,
  getFitnessProgress,
  updateFitnessProgress,
} from '@/services/fitness-progress';
import { useAuth } from '@/providers/AuthProvider';
import { TrainrThemeProvider } from '@/theme/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: jest.fn(() => null),
  CalendarDays: jest.fn(() => null),
  Pencil: jest.fn(() => null),
  Plus: jest.fn(() => null),
  Scale: jest.fn(() => null),
  Trash2: jest.fn(() => null),
  TrendingUp: jest.fn(() => null),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockDateTimePicker() {
    return React.createElement(Text, null, 'Date picker');
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/fitness-progress', () => ({
  createFitnessProgress: jest.fn(),
  deleteFitnessProgress: jest.fn(),
  getFitnessProgress: jest.fn(),
  updateFitnessProgress: jest.fn(),
}));

import PersonalProgressScreen from '../progress';

const mockedUseAuth = jest.mocked(useAuth);
const mockedGetProgress = jest.mocked(getFitnessProgress);
const mockedCreate = jest.mocked(createFitnessProgress);
const mockedUpdate = jest.mocked(updateFitnessProgress);
const mockedDelete = jest.mocked(deleteFitnessProgress);

const weightRecord = {
  id: 'measurement-1',
  user_id: 'user-123',
  metric_type: 'body_weight' as const,
  value: 80,
  unit: 'kg' as const,
  recorded_at: '2026-11-25T09:00:00.000Z',
  notes: null,
  created_at: '2026-11-25T09:00:00.000Z',
};

const waistRecord = {
  ...weightRecord,
  id: 'measurement-2',
  metric_type: 'waist' as const,
  value: 85,
  unit: 'cm' as const,
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
        <PersonalProgressScreen />
      </TrainrThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Personal Progress screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-123' },
    } as never);
    mockedGetProgress.mockResolvedValue([weightRecord, waistRecord]);
    mockedCreate.mockResolvedValue(weightRecord);
    mockedUpdate.mockResolvedValue(weightRecord);
    mockedDelete.mockResolvedValue(undefined);
  });

  it('loads and displays the latest body-weight measurement', async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('LATEST BODY WEIGHT')).toBeTruthy();
      expect(getByText('80')).toBeTruthy();
      expect(getByText('kg')).toBeTruthy();
    });

    expect(mockedGetProgress).toHaveBeenCalledTimes(1);
  });

  it('switches the measurement history when another metric is selected', async () => {
    const { getByRole, getByText, queryByText } = await renderScreen();

    await waitFor(() => {
      expect(getByText('80')).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Waist' }));

    await waitFor(() => {
      expect(getByText('LATEST WAIST')).toBeTruthy();
      expect(getByText('85')).toBeTruthy();
    });

    expect(queryByText('LATEST BODY WEIGHT')).toBeNull();
  });

  it('opens the record form and saves a new measurement', async () => {
    const { getByRole, getByLabelText, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: 'Record measurement' })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: 'Record measurement' }));

    await waitFor(() => {
      expect(getByText('RECORD MEASUREMENT')).toBeTruthy();
    });

    await fireEvent.changeText(getByLabelText('Body weight'), '82');
    await fireEvent.press(getByRole('button', { name: 'Save measurement' }));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'body_weight',
          value: 82,
          unit: 'kg',
        }),
      );
    });
  });

  it('opens the edit form with the selected record values', async () => {
    const { getByRole, getByLabelText, getByText } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: /Edit measurement from/ })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: /Edit measurement from/ }));

    await waitFor(() => {
      expect(getByText('EDIT MEASUREMENT')).toBeTruthy();
      expect(getByLabelText('Body weight').props.value).toBe('80');
    });
  });

  it('asks for confirmation before deleting a measurement', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByRole('button', { name: /Delete measurement from/ })).toBeTruthy();
    });

    await fireEvent.press(getByRole('button', { name: /Delete measurement from/ }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete measurement?',
      expect.stringContaining('body weight'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep record' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ]),
    );

    alertSpy.mockRestore();
  });

  it('shows a retry action when measurements cannot be loaded', async () => {
    mockedGetProgress.mockRejectedValue(new Error('Unable to load measurements.'));

    const { getByText, getByRole } = await renderScreen();

    await waitFor(() => {
      expect(getByText('Unable to load measurements.')).toBeTruthy();
      expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });
});
