import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import {
  getNotificationPermissionStatus,
  getPushNotificationDeviceIfPermitted,
  requestPushNotificationPermission,
  type NotificationPermissionStatus,
} from '@/services/notifications/notification-permissions';
import {
  registerDevicePushToken,
  type DevicePushToken,
} from '@/services/notifications/notification-registration';

type NotificationContextValue = {
  permissionStatus: NotificationPermissionStatus | null;
  isCheckingPermission: boolean;
  isRegistering: boolean;
  isRegistered: boolean;
  error: string | null;
  lastNotification: Notifications.Notification | null;
  lastNotificationResponse: Notifications.NotificationResponse | null;
  refreshPermissionStatus: () => Promise<NotificationPermissionStatus | null>;
  requestPermissionAndRegister: () => Promise<DevicePushToken | null>;
  clearLastNotificationResponse: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

type NotificationProviderProps = {
  children: ReactNode;
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, isLoading: isAuthLoading } = useAuth();

  const userId = user?.id;

  // Keep the current account ID available to asynchronous operations.
  const currentUserIdRef = useRef(userId);

  useLayoutEffect(() => {
    currentUserIdRef.current = userId;
  }, [userId]);

  // Prevent duplicate registration attempts for the same account.
  const registrationInFlightUsersRef = useRef(new Set<string>());

  // Prevent an older registration from changing the loading state
  // of a newer registration attempt.
  const registrationAttemptRef = useRef(0);

  const previousUserIdRef = useRef(userId);

  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);

  // Triggers automatic registration after a foreground permission refresh.
  const [permissionRefreshVersion, setPermissionRefreshVersion] = useState(0);

  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  const [isRegistering, setIsRegistering] = useState(false);

  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  const [registrationError, setRegistrationError] = useState<{
    userId: string | null;
    message: string;
  } | null>(null);

  const [lastNotification, setLastNotification] =
    useState<Notifications.Notification | null>(null);

  const [lastNotificationResponse, setLastNotificationResponse] =
    useState<Notifications.NotificationResponse | null>(null);

  // Prevent stale asynchronous cold-start responses from replacing
  // newer notification responses or restoring cleared responses.
  const notificationResponseVersionRef = useRef(0);

  /**
   * Reset account-specific registration state when the
   * authenticated user changes.
   */
  useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      previousUserIdRef.current = userId;

      setRegisteredUserId(null);
      setRegistrationError(null);
    }
  }, [userId]);

  /**
   * Refresh the current device notification permission status.
   */
  const refreshPermissionStatus = useCallback(async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      setPermissionStatus(null);
      setIsCheckingPermission(false);
      return null;
    }

    setIsCheckingPermission(true);

    try {
      const status = await getNotificationPermissionStatus();

      setPermissionStatus(status);

      return status;
    } catch (refreshError) {
      console.error('[Notifications] Unable to refresh permission status:', refreshError);

      return null;
    } finally {
      setIsCheckingPermission(false);
    }
  }, []);

  /**
   * Refresh notification permissions whenever the app returns
   * to the foreground, including after the user visits Settings.
   */
  useEffect(() => {
    let isMounted = true;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void (async () => {
          const status = await refreshPermissionStatus();

          if (isMounted && status !== null) {
            setPermissionRefreshVersion((version) => version + 1);
          }
        })();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [refreshPermissionStatus]);

  /**
   * Automatically register the device after authentication
   * has been restored, but only if notification permission
   * has already been granted.
   *
   * This function never opens the operating system permission prompt.
   * Remote push registration is skipped on simulators.
   */
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isActive = true;

    async function registerAutomatically() {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        setPermissionStatus(null);
        setIsCheckingPermission(false);
        return;
      }

      setIsCheckingPermission(true);

      try {
        const status = await getNotificationPermissionStatus();

        if (!isActive || currentUserIdRef.current !== userId) {
          return;
        }

        setPermissionStatus(status);

        // No authenticated user: permission can still be displayed,
        // but there is no account to associate with the device.
        if (!userId) {
          return;
        }

        // Do not request permission automatically.
        if (!status.granted) {
          return;
        }

        // Simulators support local notifications but not remote
        // Expo push-token registration.
        if (!Device.isDevice) {
          console.log('[Notifications] Skipping remote push registration on simulator.');
          return;
        }

        // This account has already registered during this session.
        if (registeredUserId === userId) {
          return;
        }

        // Avoid duplicate concurrent registrations.
        if (registrationInFlightUsersRef.current.has(userId)) {
          return;
        }

        registrationInFlightUsersRef.current.add(userId);

        const attemptId = ++registrationAttemptRef.current;

        setIsRegistering(true);
        setRegistrationError(null);

        try {
          const device = await getPushNotificationDeviceIfPermitted();

          if (!device || !isActive || currentUserIdRef.current !== userId) {
            return;
          }

          const registeredToken = await registerDevicePushToken({
            ...device,
            expectedUserId: userId,
          });

          if (isActive && currentUserIdRef.current === userId) {
            setRegisteredUserId(userId);

            console.log(
              '[Notifications] Device automatically registered:',
              registeredToken.id,
            );
          }
        } catch (registrationError) {
          const message =
            registrationError instanceof Error
              ? registrationError.message
              : 'Unable to register this device. Please try again.';

          if (isActive && currentUserIdRef.current === userId) {
            setRegistrationError({
              userId,
              message,
            });
          }

          console.error(
            '[Notifications] Automatic registration failed:',
            registrationError,
          );
        } finally {
          registrationInFlightUsersRef.current.delete(userId);

          if (registrationAttemptRef.current === attemptId) {
            setIsRegistering(false);
          }
        }
      } catch (permissionError) {
        console.error(
          '[Notifications] Automatic permission check failed:',
          permissionError,
        );
      } finally {
        if (isActive) {
          setIsCheckingPermission(false);
        }
      }
    }

    void registerAutomatically();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, userId, registeredUserId, permissionRefreshVersion]);

  /**
   * Manually request notification permission and register
   * the device following an explicit user action.
   *
   * On simulators, permission can still be requested.
   * Only remote push-token registration is skipped.
   */
  const requestPermissionAndRegister = useCallback(async () => {
    if (!userId) {
      const message = 'Please sign in to enable notifications.';

      setRegistrationError({
        userId: null,
        message,
      });

      throw new Error(message);
    }

    const registeringUserId = userId;

    if (registrationInFlightUsersRef.current.has(registeringUserId)) {
      throw new Error('Device registration is already in progress. Please wait.');
    }

    registrationInFlightUsersRef.current.add(registeringUserId);

    const attemptId = ++registrationAttemptRef.current;

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      // On physical devices this requests permission and obtains
      // the Expo push token.
      // On simulators this helper currently rejects before requesting
      // permission, so we handle the simulator permission flow separately.
      if (!Device.isDevice) {
        let permission = await Notifications.getPermissionsAsync();

        if (!permission.granted && permission.canAskAgain) {
          permission = await Notifications.requestPermissionsAsync();
        }

        const status = await refreshPermissionStatus();

        if (currentUserIdRef.current !== registeringUserId) {
          return null;
        }

        if (!status?.granted) {
          return null;
        }

        console.log(
          '[Notifications] Permission granted. Remote push registration skipped on simulator.',
        );

        return null;
      }

      const device = await requestPushNotificationPermission();

      await refreshPermissionStatus();

      if (!device) {
        return null;
      }

      // Do not register if the authenticated account changed
      // while the permission request was in progress.
      if (currentUserIdRef.current !== registeringUserId) {
        return null;
      }

      const registeredToken = await registerDevicePushToken({
        ...device,
        expectedUserId: registeringUserId,
      });

      if (currentUserIdRef.current === registeringUserId) {
        setRegisteredUserId(registeringUserId);
      }

      return registeredToken;
    } catch (registrationError) {
      const message =
        registrationError instanceof Error
          ? registrationError.message
          : 'Unable to enable notifications. Please try again.';

      if (currentUserIdRef.current === registeringUserId) {
        setRegistrationError({
          userId: registeringUserId,
          message,
        });
      }

      throw registrationError;
    } finally {
      registrationInFlightUsersRef.current.delete(registeringUserId);

      if (registrationAttemptRef.current === attemptId) {
        setIsRegistering(false);
      }
    }
  }, [userId, refreshPermissionStatus]);

  /**
   * Listen for received notifications and notification responses.
   */
  useEffect(() => {
    let isMounted = true;

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (isMounted) {
          setLastNotification(notification);
        }
      },
    );

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (isMounted) {
          notificationResponseVersionRef.current += 1;
          setLastNotificationResponse(response);
        }
      },
    );

    const initialResponseVersion = notificationResponseVersionRef.current;

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (
          isMounted &&
          response &&
          notificationResponseVersionRef.current === initialResponseVersion
        ) {
          setLastNotificationResponse(response);
        }
      })
      .catch((listenerError) => {
        console.error(
          '[Notifications] Unable to retrieve the last notification response:',
          listenerError,
        );
      });

    return () => {
      isMounted = false;

      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  /**
   * Clear the most recently received notification response.
   */
  const clearLastNotificationResponse = useCallback(() => {
    notificationResponseVersionRef.current += 1;
    setLastNotificationResponse(null);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      permissionStatus,
      isCheckingPermission,
      isRegistering,

      isRegistered: registeredUserId === userId && userId !== undefined,

      error:
        registrationError?.userId === (userId ?? null) ? registrationError.message : null,

      lastNotification,
      lastNotificationResponse,

      refreshPermissionStatus,
      requestPermissionAndRegister,
      clearLastNotificationResponse,
    }),
    [
      permissionStatus,
      isCheckingPermission,
      isRegistering,
      registeredUserId,
      userId,
      registrationError,
      lastNotification,
      lastNotificationResponse,
      refreshPermissionStatus,
      requestPermissionAndRegister,
      clearLastNotificationResponse,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider.');
  }

  return context;
}
