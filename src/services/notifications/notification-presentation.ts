
import * as Notifications from 'expo-notifications';

/**
 * Configure how TRAINR presents notifications while the app is active.
 *
 * This handler must be registered at application startup.
 */
export function configureNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request notification permission and schedule a local test notification.
 *
 * This does not register an Expo push token or send a remote notification.
 */
export async function scheduleLocalTestNotification(): Promise<string> {
  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    throw new Error(
      'Notification permission was not granted. Enable notifications for TRAINR in your simulator settings and try again.',
    );
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'TRAINR Notifications',
      body: 'Your notification system is working!',
      data: {
        type: 'local_test',
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}
