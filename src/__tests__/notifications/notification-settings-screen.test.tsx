import React from 'react';

import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { View } from 'react-native';

import NotificationSettingsScreen from '@/app/(tabs)/notification-settings';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/notifications/NotificationProvider';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/notifications/notification-preferences';
import type { NotificationPreferences } from '@/services/notifications/notification-preferences';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
  },
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    AlertCircle: (props: object) => React.createElement(View, props),
    ArrowLeft: (props: object) => React.createElement(View, props),
    Bell: (props: object) => React.createElement(View, props),
    CheckCircle2: (props: object) => React.createElement(View, props),
    Smartphone: (props: object) => React.createElement(View, props),
  };
});

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/providers/notifications/NotificationProvider', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('@/services/notifications/notification-preferences', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreference: jest.fn(),
}));

jest.mock('@/theme', () => ({
  useTrainrTheme: () => ({
    colors: {
      background: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
      },
      brand: {
        red: '#D71920',
        redLight: '#FDE8E9',
      },
      text: {
        primary: '#0B0B0B',
        secondary: '#666666',
        tertiary: '#999999',
        error: '#D71920',
      },
      border: {
        default: '#E5E5E5',
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxxl: 40,
    },
  }),
}));

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    AppText: ({
      children,
      style,
    }: React.PropsWithChildren<{ style?: object }>) =>
      React.createElement(Text, { style }, children),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockUseNotifications = jest.mocked(useNotifications);
const mockGetNotificationPreferences = jest.mocked(
  getNotificationPreferences,
);
const mockUpdateNotificationPreference = jest.mocked(
  updateNotificationPreference,
);

const mockPreferences: NotificationPreferences = {
  user_id: 'test-user-id',
  booking_updates: true,
  session_reminders: true,
  workout_updates: false,
  feedback_updates: true,
  post_session_followups: false,
  created_at: '2026-11-15T09:00:00.000Z',
  updated_at: '2026-11-15T09:00:00.000Z',
};

function createMockNotifications() {
  return {
    permissionStatus: {
      status: 'granted',
      granted: true,
      canAskAgain: true,
    },
    isCheckingPermission: false,
    isRegistering: false,
    isRegistered: true,
    error: null,
    refreshPermissionStatus: jest.fn(),
    requestPermissionAndRegister: jest.fn(),
  } as unknown as ReturnType<typeof useNotifications>;
}

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-id',
      },
    } as unknown as ReturnType<typeof useAuth>);

    mockUseNotifications.mockReturnValue(createMockNotifications());

    mockGetNotificationPreferences.mockResolvedValue(mockPreferences);
    mockUpdateNotificationPreference.mockResolvedValue(undefined);
  });

  it('loads and displays saved notification preferences', async () => {
    const { getByText, getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    expect(getByText('Notification Preferences')).toBeTruthy();

    await waitFor(() => {
      expect(
        getByLabelText('Booking Updates notifications').props.value,
      ).toBe(true);
    });

    expect(
      getByLabelText('Session Reminders notifications').props.value,
    ).toBe(true);

    expect(
      getByLabelText('Workout Updates notifications').props.value,
    ).toBe(false);

    expect(
      getByLabelText('Feedback Updates notifications').props.value,
    ).toBe(true);

    expect(
      getByLabelText('Post-session Follow-ups notifications').props.value,
    ).toBe(false);

    expect(mockGetNotificationPreferences).toHaveBeenCalledWith(
      'test-user-id',
    );
  });

  it('updates a preference when its switch is changed', async () => {
    const { getByLabelText } = await render(<NotificationSettingsScreen />);

    const bookingSwitch = getByLabelText(
      'Booking Updates notifications',
    );

    await waitFor(() => {
      expect(bookingSwitch.props.value).toBe(true);
    });

    fireEvent(bookingSwitch, 'valueChange', false);

    await waitFor(() => {
      expect(mockUpdateNotificationPreference).toHaveBeenCalledWith(
        'test-user-id',
        'booking_updates',
        false,
      );
    });

    await waitFor(() => {
      expect(
        getByLabelText('Booking Updates notifications').props.value,
      ).toBe(false);
    });
  });

  it('rolls back a preference and displays an error when saving fails', async () => {
    mockUpdateNotificationPreference.mockRejectedValueOnce(
      new Error('Unable to save your notification preference. Please try again.'),
    );

    const { getByLabelText, getByText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(
        getByLabelText('Booking Updates notifications').props.value,
      ).toBe(true);
    });

    fireEvent(
      getByLabelText('Booking Updates notifications'),
      'valueChange',
      false,
    );

    await waitFor(() => {
      expect(
        getByLabelText('Booking Updates notifications').props.value,
      ).toBe(true);

      expect(
        getByText(
          'Unable to save your notification preference. Please try again.',
        ),
      ).toBeTruthy();
    });
  });

  it('displays a load error and retries successfully', async () => {
    mockGetNotificationPreferences
      .mockRejectedValueOnce(
        new Error('Unable to load notification preferences. Please try again.'),
      )
      .mockResolvedValueOnce(mockPreferences);

    const { getByText, getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(
        getByText(
          'Unable to load notification preferences. Please try again.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(getByText('Try Again'));

    await waitFor(() => {
      expect(
        getByLabelText('Booking Updates notifications').props.value,
      ).toBe(true);
    });

    expect(mockGetNotificationPreferences).toHaveBeenCalledTimes(2);
  });
});
