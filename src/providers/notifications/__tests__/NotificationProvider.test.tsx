import * as Notifications from 'expo-notifications';

import type { User } from '@supabase/supabase-js';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import {
  NotificationProvider,
  useNotifications,
} from '@/providers/notifications/NotificationProvider';
import {
  getNotificationPermissionStatus,
  getPushNotificationDeviceIfPermitted,
  requestPushNotificationPermission,
} from '@/services/notifications/notification-permissions';
import { registerDevicePushToken } from '@/services/notifications/notification-registration';

// Controls whether the test represents a physical device or simulator.
let mockIsPhysicalDevice = true;

// Captures the AppState listener so tests can simulate foreground events.
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;

const mockAppStateSubscriptionRemove = jest.fn();

// Mock AppState once for the entire test file.
// Every subscription receives a valid remove() method.
const mockAddAppStateListener = jest
  .spyOn(AppState, 'addEventListener')
  .mockImplementation((event, listener) => {
    if (event === 'change') {
      mockAppStateListener = listener;
    }

    return {
      remove: mockAppStateSubscriptionRemove,
    } as ReturnType<typeof AppState.addEventListener>;
  });

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsPhysicalDevice;
  },
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/notifications/notification-permissions', () => ({
  getNotificationPermissionStatus: jest.fn(),
  getPushNotificationDeviceIfPermitted: jest.fn(),
  requestPushNotificationPermission: jest.fn(),
}));

jest.mock('@/services/notifications/notification-registration', () => ({
  registerDevicePushToken: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({
    granted: false,
    canAskAgain: true,
    status: 'denied',
  }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted',
  }),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockGetPermissionStatus = jest.mocked(getNotificationPermissionStatus);
const mockGetDeviceIfPermitted = jest.mocked(getPushNotificationDeviceIfPermitted);
const mockRequestPermission = jest.mocked(requestPushNotificationPermission);
const mockRegisterDevice = jest.mocked(registerDevicePushToken);

const mockAddNotificationReceivedListener = jest.mocked(
  Notifications.addNotificationReceivedListener,
);
const mockAddNotificationResponseReceivedListener = jest.mocked(
  Notifications.addNotificationResponseReceivedListener,
);
const mockGetLastNotificationResponse = jest.mocked(
  Notifications.getLastNotificationResponseAsync,
);
const mockGetOSPermissionStatus = jest.mocked(Notifications.getPermissionsAsync);
const mockRequestOSPermission = jest.mocked(Notifications.requestPermissionsAsync);

const testUserId = 'test-user-123';

const mockPermissionGranted = {
  granted: true,
  canAskAgain: true,
  status: 'granted',
};

const mockPermissionDenied = {
  granted: false,
  canAskAgain: true,
  status: 'denied',
};

const mockDevice = {
  expoPushToken: 'ExponentPushToken[test-token]',
  platform: 'ios' as const,
  deviceName: 'Test iPhone',
  timezone: 'Africa/Lagos',
};

const mockRegisteredToken = {
  id: 'test-device-token-id',
  user_id: testUserId,
  expo_push_token: mockDevice.expoPushToken,
  platform: 'ios' as const,
  device_id: null,
  device_name: mockDevice.deviceName,
  timezone: mockDevice.timezone,
  is_active: true,
  last_seen_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function createMockUser(id = testUserId) {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

function createMockNotificationResponse(identifier: string) {
  return {
    notification: {
      request: { identifier },
    },
  } as unknown as Notifications.NotificationResponse;
}

function NotificationConsumer() {
  const {
    isRegistered,
    isRegistering,
    isCheckingPermission,
    permissionStatus,
    error,
    lastNotificationResponse,
    clearLastNotificationResponse,
    requestPermissionAndRegister,
  } = useNotifications();

  return (
    <View>
      <Text testID="registered">{String(isRegistered)}</Text>
      <Text testID="registering">{String(isRegistering)}</Text>
      <Text testID="checking">{String(isCheckingPermission)}</Text>

      <Text testID="permission">{permissionStatus?.status ?? 'unknown'}</Text>

      <Text testID="error">{error ?? 'no-error'}</Text>

      <Text testID="notification-response">
        {lastNotificationResponse?.notification.request.identifier ?? 'no-response'}
      </Text>

      <Pressable testID="clear-response" onPress={clearLastNotificationResponse}>
        <Text>Clear response</Text>
      </Pressable>

      <Pressable
        testID="request-permission"
        onPress={() => {
          void requestPermissionAndRegister().catch(() => undefined);
        }}
      >
        <Text>Enable notifications</Text>
      </Pressable>
    </View>
  );
}

async function renderNotificationProvider() {
  return await render(
    <NotificationProvider>
      <NotificationConsumer />
    </NotificationProvider>,
  );
}

describe('NotificationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockIsPhysicalDevice = true;

    // Reset the captured callback without removing the shared mock.
    mockAppStateListener = undefined;

    mockUseAuth.mockReturnValue({
      user: createMockUser(),
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionDenied as Awaited<ReturnType<typeof getNotificationPermissionStatus>>,
    );

    mockGetDeviceIfPermitted.mockResolvedValue(null);

    mockRequestPermission.mockResolvedValue(null);

    mockRegisterDevice.mockResolvedValue(
      mockRegisteredToken as Awaited<ReturnType<typeof registerDevicePushToken>>,
    );

    mockGetOSPermissionStatus.mockResolvedValue(
      mockPermissionDenied as Notifications.NotificationPermissionsStatus,
    );

    mockRequestOSPermission.mockResolvedValue(
      mockPermissionGranted as Notifications.NotificationPermissionsStatus,
    );
  });

  it('does not check permissions or register while authentication is loading', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    await renderNotificationProvider();

    expect(mockGetPermissionStatus).not.toHaveBeenCalled();
    expect(mockGetDeviceIfPermitted).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('does not automatically register when notification permission is denied', async () => {
    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionDenied as Awaited<ReturnType<typeof getNotificationPermissionStatus>>,
    );

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('permission').props.children).toBe('denied');
    });

    expect(mockGetDeviceIfPermitted).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('automatically registers the authenticated user when permission is already granted', async () => {
    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionGranted as Awaited<
        ReturnType<typeof getNotificationPermissionStatus>
      >,
    );

    mockGetDeviceIfPermitted.mockResolvedValue(
      mockDevice as Awaited<ReturnType<typeof getPushNotificationDeviceIfPermitted>>,
    );

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('registered').props.children).toBe('true');
    });

    expect(mockGetDeviceIfPermitted).toHaveBeenCalledTimes(1);

    expect(mockRegisterDevice).toHaveBeenCalledWith({
      ...mockDevice,
      expectedUserId: testUserId,
    });

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('registers the device after an explicit permission request', async () => {
    mockRequestPermission.mockResolvedValue(
      mockDevice as Awaited<ReturnType<typeof requestPushNotificationPermission>>,
    );

    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionDenied as Awaited<ReturnType<typeof getNotificationPermissionStatus>>,
    );

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('permission').props.children).toBe('denied');
    });

    fireEvent.press(getByTestId('request-permission'));

    await waitFor(() => {
      expect(getByTestId('registered').props.children).toBe('true');
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    expect(mockRegisterDevice).toHaveBeenCalledWith({
      ...mockDevice,
      expectedUserId: testUserId,
    });
  });

  it('requests notification permission on a simulator without registering a remote push token', async () => {
    mockIsPhysicalDevice = false;

    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionDenied as Awaited<ReturnType<typeof getNotificationPermissionStatus>>,
    );

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('permission').props.children).toBe('denied');
    });

    mockGetOSPermissionStatus.mockResolvedValueOnce(
      mockPermissionDenied as Notifications.NotificationPermissionsStatus,
    );

    mockRequestOSPermission.mockResolvedValueOnce(
      mockPermissionGranted as Notifications.NotificationPermissionsStatus,
    );

    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionGranted as Awaited<
        ReturnType<typeof getNotificationPermissionStatus>
      >,
    );

    fireEvent.press(getByTestId('request-permission'));

    await waitFor(() => {
      expect(mockRequestOSPermission).toHaveBeenCalledTimes(1);
    });

    expect(mockGetOSPermissionStatus).toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockGetDeviceIfPermitted).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getByTestId('permission').props.children).toBe('granted');
    });

    expect(getByTestId('registered').props.children).toBe('false');
  });

  it('exposes registration errors without marking the device as registered', async () => {
    const registrationError = new Error(
      'Unable to register this device. Please try again.',
    );

    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionGranted as Awaited<
        ReturnType<typeof getNotificationPermissionStatus>
      >,
    );

    mockGetDeviceIfPermitted.mockResolvedValue(
      mockDevice as Awaited<ReturnType<typeof getPushNotificationDeviceIfPermitted>>,
    );

    mockRegisterDevice.mockRejectedValue(registrationError);

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('registered').props.children).toBe('false');
      expect(getByTestId('error').props.children).toBe(registrationError.message);
    });
  });

  it('retries automatic registration when the app returns to the foreground after a failure', async () => {
    mockGetPermissionStatus.mockResolvedValue(
      mockPermissionGranted as Awaited<
        ReturnType<typeof getNotificationPermissionStatus>
      >,
    );

    mockGetDeviceIfPermitted.mockResolvedValue(
      mockDevice as Awaited<ReturnType<typeof getPushNotificationDeviceIfPermitted>>,
    );

    mockRegisterDevice
      .mockRejectedValueOnce(new Error('Temporary registration failure'))
      .mockResolvedValueOnce(
        mockRegisteredToken as Awaited<ReturnType<typeof registerDevicePushToken>>,
      );

    const { getByTestId, unmount } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('error').props.children).toBe('Temporary registration failure');
    });

    expect(mockRegisterDevice).toHaveBeenCalledTimes(1);
    expect(mockAppStateListener).toBeDefined();

    // Simulate the app returning to the foreground.
    await act(async () => {
      mockAppStateListener?.('active');
    });

    await waitFor(() => {
      expect(mockRegisterDevice).toHaveBeenCalledTimes(2);
      expect(getByTestId('registered').props.children).toBe('true');
    });

    expect(getByTestId('error').props.children).toBe('no-error');

    await act(async () => {
      unmount();
    });
  });

  it('exposes a live notification response to consumers', async () => {
    const response = createMockNotificationResponse('live-response');

    const { getByTestId } = await renderNotificationProvider();

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0];

    expect(listener).toBeDefined();

    await act(async () => {
      listener?.(response);
    });

    await waitFor(() => {
      expect(getByTestId('notification-response').props.children).toBe('live-response');
    });
  });

  it('recovers a notification response that launched the app', async () => {
    const response = createMockNotificationResponse('cold-start-response');

    mockGetLastNotificationResponse.mockResolvedValueOnce(response);

    const { getByTestId } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('notification-response').props.children).toBe(
        'cold-start-response',
      );
    });
  });

  it('does not let a late cold-start response overwrite a newer live response', async () => {
    const coldStartResponse = createMockNotificationResponse('stale-cold-start');
    const liveResponse = createMockNotificationResponse('new-live-response');

    let resolveColdStart!: (response: Notifications.NotificationResponse | null) => void;

    mockGetLastNotificationResponse.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveColdStart = resolve;
      }),
    );

    const { getByTestId } = await renderNotificationProvider();

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0]?.[0];

    await act(async () => {
      listener?.(liveResponse);
    });

    await act(async () => {
      resolveColdStart(coldStartResponse);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByTestId('notification-response').props.children).toBe(
        'new-live-response',
      );
    });
  });

  it('removes both notification listeners when the provider unmounts', async () => {
    const receivedRemove = jest.fn();
    const responseRemove = jest.fn();

    mockAddNotificationReceivedListener.mockReturnValueOnce({
      remove: receivedRemove,
    } as ReturnType<typeof Notifications.addNotificationReceivedListener>);

    mockAddNotificationResponseReceivedListener.mockReturnValueOnce({
      remove: responseRemove,
    } as ReturnType<typeof Notifications.addNotificationResponseReceivedListener>);

    const { unmount } = await renderNotificationProvider();

    await waitFor(() => {
      expect(mockAddNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    const receivedSubscription =
      mockAddNotificationReceivedListener.mock.results[0]?.value;

    const responseSubscription =
      mockAddNotificationResponseReceivedListener.mock.results[0]?.value;

    expect(receivedSubscription?.remove).toBe(receivedRemove);
    expect(responseSubscription?.remove).toBe(responseRemove);

    await act(async () => {
      unmount();
    });

    expect(receivedRemove).toHaveBeenCalledTimes(1);
    expect(responseRemove).toHaveBeenCalledTimes(1);
  });

  it('does not restore a cold-start response after it has been cleared', async () => {
    const coldStartResponse = createMockNotificationResponse('cleared-cold-start');

    let resolveColdStart!: (response: Notifications.NotificationResponse | null) => void;

    mockGetLastNotificationResponse.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveColdStart = resolve;
      }),
    );

    const { getByTestId, unmount } = await renderNotificationProvider();

    await waitFor(() => {
      expect(getByTestId('checking').props.children).toBe('false');
    });

    fireEvent.press(getByTestId('clear-response'));

    await act(async () => {
      resolveColdStart(coldStartResponse);
      await Promise.resolve();
    });

    expect(getByTestId('notification-response').props.children).toBe('no-response');

    await act(async () => {
      unmount();
    });
  });
});
