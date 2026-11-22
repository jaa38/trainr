import React from 'react';
import { Linking } from 'react-native';

import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';

import NotificationSettingsScreen from '@/app/(tabs)/notification-settings';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/notifications/NotificationProvider';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/notifications/notification-preferences';
import { scheduleLocalTestNotification } from '@/services/notifications/notification-presentation';

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

jest.mock('@/services/notifications/notification-presentation', () => ({
  scheduleLocalTestNotification: jest.fn(),
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
      xxl: 32,
    },
  }),
}));

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    AppText: ({ children }: React.PropsWithChildren) =>
      React.createElement(Text, null, children),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockUseNotifications = jest.mocked(useNotifications);
const mockGetPreferences = jest.mocked(getNotificationPreferences);
const mockUpdatePreference = jest.mocked(updateNotificationPreference);
const mockScheduleTestNotification = jest.mocked(
  scheduleLocalTestNotification,
);

const userId = 'test-user-id';

const mockPreferences = {
  user_id: userId,
  booking_updates: true,
  session_reminders: true,
  workout_updates: true,
  feedback_updates: true,
  post_session_followups: true,
  created_at: '2026-11-21T09:00:00.000Z',
  updated_at: '2026-11-21T09:00:00.000Z',
};

const grantedPermission = {
  granted: true,
  canAskAgain: true,
  status: 'granted' as const,
};

const requestableDeniedPermission = {
  granted: false,
  canAskAgain: true,
  status: 'denied' as const,
};

const permanentlyDeniedPermission = {
  granted: false,
  canAskAgain: false,
  status: 'denied' as const,
};

function setupMocks({
  permissionStatus = requestableDeniedPermission,
  isRegistered = false,
  isCheckingPermission = false,
  isRegistering = false,
  error = null,
  requestPermissionAndRegister = jest.fn().mockResolvedValue(null),
  refreshPermissionStatus = jest.fn().mockResolvedValue(grantedPermission),
}: {
  permissionStatus?: typeof grantedPermission | typeof requestableDeniedPermission | typeof permanentlyDeniedPermission;
  isRegistered?: boolean;
  isCheckingPermission?: boolean;
  isRegistering?: boolean;
  error?: string | null;
  requestPermissionAndRegister?: jest.Mock;
  refreshPermissionStatus?: jest.Mock;
} = {}) {
  mockUseAuth.mockReturnValue({
    user: { id: userId },
  } as never);

  mockUseNotifications.mockReturnValue({
    permissionStatus,
    isCheckingPermission,
    isRegistering,
    isRegistered,
    error,
    refreshPermissionStatus,
    requestPermissionAndRegister,
  } as never);

  mockGetPreferences.mockResolvedValue(mockPreferences);
  mockUpdatePreference.mockResolvedValue(undefined);

  return {
    requestPermissionAndRegister,
    refreshPermissionStatus,
  };
}

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetPreferences.mockResolvedValue(mockPreferences);
    mockUpdatePreference.mockResolvedValue(undefined);
    mockScheduleTestNotification.mockResolvedValue('test-notification-id');
  });

  it('loads and displays notification preferences', async () => {
    setupMocks();

    const { getByText, getByRole } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByText('Notification Preferences')).toBeTruthy();
      expect(getByRole('switch', { name: 'Booking Updates notifications' })).toBeTruthy();
      expect(getByRole('switch', { name: 'Session Reminders notifications' })).toBeTruthy();
      expect(getByRole('switch', { name: 'Workout Updates notifications' })).toBeTruthy();
    });

    expect(mockGetPreferences).toHaveBeenCalledWith(userId);
  });

  it('shows the enable action when permission has not been requested', async () => {
    setupMocks({
      permissionStatus: {
        granted: false,
        canAskAgain: true,
        status: 'undetermined' as never,
      },
    });

    const { getByText, getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByText('Not requested')).toBeTruthy();
      expect(getByLabelText('Enable TRAINR notifications')).toBeTruthy();
    });
  });

  it('allows the user to request permission again after a requestable denial', async () => {
    const { requestPermissionAndRegister } = setupMocks({
      permissionStatus: requestableDeniedPermission,
    });

    const { getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByLabelText('Enable TRAINR notifications')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Enable TRAINR notifications'));
    });

    expect(requestPermissionAndRegister).toHaveBeenCalledTimes(1);
  });

  it('shows device settings when permission can no longer be requested', async () => {
    setupMocks({
      permissionStatus: permanentlyDeniedPermission,
    });

    const { getByText, getByLabelText, queryByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByText('Not enabled')).toBeTruthy();
      expect(getByLabelText('Open device settings')).toBeTruthy();
    });

    expect(queryByLabelText('Enable TRAINR notifications')).toBeNull();
  });

  it('opens device settings and refreshes permission status', async () => {
    const { refreshPermissionStatus } = setupMocks({
      permissionStatus: permanentlyDeniedPermission,
    });

    const openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined);

    const { getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByLabelText('Open device settings')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Open device settings'));
    });

    expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    expect(refreshPermissionStatus).toHaveBeenCalledTimes(1);

    openSettingsSpy.mockRestore();
  });

  it('shows the enabled state when permission is granted', async () => {
    setupMocks({
      permissionStatus: grantedPermission,
      isRegistered: true,
    });

    const { getByText, getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByText('Enabled')).toBeTruthy();
      expect(getByText('This device has been registered.')).toBeTruthy();
      expect(getByLabelText('Enable TRAINR notifications')).toBeTruthy();
    });
  });

  it('displays a registration error when enabling notifications fails', async () => {
    const { requestPermissionAndRegister } = setupMocks({
      permissionStatus: requestableDeniedPermission,
      requestPermissionAndRegister: jest
        .fn()
        .mockRejectedValue(new Error('Unable to register this device. Please try again.')),
    });

    const { getByLabelText, getByText } = await render(
      <NotificationSettingsScreen />,
    );

    await waitFor(() => {
      expect(getByLabelText('Enable TRAINR notifications')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Enable TRAINR notifications'));
    });

    expect(requestPermissionAndRegister).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        getByText('Unable to register this device. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('does not allow permission requests while permission status is checking', async () => {
    const { requestPermissionAndRegister } = setupMocks({
      isCheckingPermission: true,
    });

    const { getByLabelText } = await render(
      <NotificationSettingsScreen />,
    );

    const enableButton = getByLabelText('Enable TRAINR notifications');

    expect(enableButton.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(enableButton);

    expect(requestPermissionAndRegister).not.toHaveBeenCalled();
  });
});
