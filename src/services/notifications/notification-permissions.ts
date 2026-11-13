import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import type { DevicePlatform } from './notification-registration';

export type NotificationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
};

export type PushNotificationDevice = {
  expoPushToken: string;
  platform: DevicePlatform;
  deviceName: string | null;
  timezone: string | null;
};

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push notifications are only supported on iOS and Android.');
  }

  const permission = await Notifications.getPermissionsAsync();

  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
  };
}

export async function requestPushNotificationPermission(): Promise<PushNotificationDevice | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push notifications are only supported on iOS and Android.');
  }

  if (!Device.isDevice) {
    throw new Error(
      'Push notifications require a physical device. Please use an iPhone or Android device.',
    );
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trainr-default', {
      name: 'TRAINR Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D71920',
    });
  }

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error(
      'The EAS project ID is missing. Please check the Expo configuration.',
    );
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return {
    expoPushToken: token.data,
    platform: Platform.OS as DevicePlatform,
    deviceName: Device.modelName ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  };
}
