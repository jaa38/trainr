import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { DevicePlatform } from "./notification-registration";

export type NotificationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
};

export type PushNotificationDevice = {
  expoPushToken: string;
  platform: DevicePlatform;
  deviceId: string | null;
  deviceName: string | null;
  timezone: string | null;
};

/**
 * Retrieves a stable platform-specific identifier for this device.
 *
 * iOS uses the identifier for vendor.
 * Android uses the Android ID.
 *
 * Returns null when the identifier is unavailable.
 */
export async function getNotificationDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === "ios") {
      const deviceId = await Application.getIosIdForVendorAsync();
      return deviceId?.trim() || null;
    }

    if (Platform.OS === "android") {
      const deviceId = Application.getAndroidId();
      return deviceId?.trim() || null;
    }

    return null;
  } catch (error) {
    console.warn(
      "[Notifications] Unable to retrieve device identifier:",
      error,
    );

    return null;
  }
}

/**
 * Retrieves the current notification permission status.
 */
export async function getNotificationPermissionStatus(): Promise<
  NotificationPermissionStatus
> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error(
      "Push notifications are only supported on iOS and Android.",
    );
  }

  const permission = await Notifications.getPermissionsAsync();

  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
  };
}

/**
 * Retrieves the device's Expo push token and metadata.
 *
 * Remote push-token registration requires a physical device.
 */
async function getPushNotificationDevice(): Promise<PushNotificationDevice> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error(
      "Push notifications are only supported on iOS and Android.",
    );
  }

  if (!Device.isDevice) {
    throw new Error(
      "Push notifications require a physical device. Please use an iPhone or Android device.",
    );
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("trainr-default", {
      name: "TRAINR Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D71920",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error(
      "The EAS project ID is missing. Please check the Expo configuration.",
    );
  }

  const [token, deviceId] = await Promise.all([
    Notifications.getExpoPushTokenAsync({ projectId }),
    getNotificationDeviceId(),
  ]);

  return {
    expoPushToken: token.data,
    platform: Platform.OS as DevicePlatform,
    deviceId,
    deviceName: Device.modelName ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  };
}

/**
 * Retrieves a push token only when notification permission
 * has already been granted. This function never requests permission.
 *
 * Returns null when permission has not been granted.
 *
 * On simulators, remote push-token registration is skipped.
 */
export async function getPushNotificationDeviceIfPermitted(): Promise<
  PushNotificationDevice | null
> {
  const permission = await getNotificationPermissionStatus();

  if (!permission.granted) {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  return getPushNotificationDevice();
}

/**
 * Requests notification permission following an explicit user action.
 *
 * Simulators can request and receive OS notification permission,
 * but cannot register for remote push notifications.
 *
 * Returns null when permission is denied or when running on a simulator.
 */
export async function requestPushNotificationPermission(): Promise<
  PushNotificationDevice | null
> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error(
      "Push notifications are only supported on iOS and Android.",
    );
  }

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    return null;
  }

  // Simulators support local notifications and OS permission,
  // but remote Expo push-token registration requires a physical device.
  if (!Device.isDevice) {
    return null;
  }

  return getPushNotificationDevice();
}
