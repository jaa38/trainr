import * as Notifications from 'expo-notifications';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import {
    getNotificationPermissionStatus,
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
  const { user } = useAuth();
  const userId = user?.id;

  const currentUserIdRef = useRef(userId);

  useEffect(() => {
    currentUserIdRef.current = userId;
  }, [userId]);

  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
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

  useEffect(() => {
    let isActive = true;

    async function checkPermissionStatus() {
      try {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          return;
        }

        const status = await getNotificationPermissionStatus();

        if (isActive) {
          setPermissionStatus(status);
        }
      } catch (refreshError) {
        console.error('[Notifications] Unable to check permission status:', refreshError);
      } finally {
        if (isActive) {
          setIsCheckingPermission(false);
        }
      }
    }

    void checkPermissionStatus();

    return () => {
      isActive = false;
    };
  }, []);

  const requestPermissionAndRegister = useCallback(async () => {
    if (!userId) {
      const message = 'Please sign in to enable notifications.';
      setRegistrationError({ userId: null, message });
      throw new Error(message);
    }

    const registeringUserId = userId;

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const device = await requestPushNotificationPermission();

      await refreshPermissionStatus();

      if (!device) {
        return null;
      }

      const registeredToken = await registerDevicePushToken(device);

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
      setIsRegistering(false);
    }
  }, [userId, refreshPermissionStatus]);

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
          setLastNotificationResponse(response);
        }
      },
    );

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (isMounted && response) {
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

  const clearLastNotificationResponse = useCallback(() => {
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
