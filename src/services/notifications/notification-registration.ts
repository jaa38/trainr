
import { supabase } from '@/lib/supabase';
import { ensureNotificationPreferences } from '@/services/notifications/notification-preferences';

export type DevicePlatform = 'ios' | 'android';

export type RegisterDevicePushTokenInput = {
  expectedUserId: string;
  expoPushToken: string;
  platform: DevicePlatform;
  deviceId?: string | null;
  deviceName?: string | null;
  timezone?: string | null;
};

export type DevicePushToken = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: DevicePlatform;
  device_id: string | null;
  device_name: string | null;
  timezone: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

const DEVICE_TOKEN_COLUMNS =
  'id,user_id,expo_push_token,platform,device_id,device_name,timezone,is_active,last_seen_at,created_at,updated_at' as const;

/**
 * Registers or refreshes a push token for the expected authenticated user.
 *
 * Existing tokens are updated only when they belong to that user.
 * A token owned by another account is never reassigned.
 * Registration is rejected if the authenticated account has changed.
 */
export async function registerDevicePushToken(
  input: RegisterDevicePushTokenInput,
): Promise<DevicePushToken> {
  const expoPushToken = input.expoPushToken?.trim();
  const expectedUserId = input.expectedUserId?.trim();

  if (!expoPushToken) {
    throw new Error('A valid Expo push token is required.');
  }

  if (input.platform !== 'ios' && input.platform !== 'android') {
    throw new Error('Push notifications are only supported on iOS and Android.');
  }

  if (!expectedUserId) {
    throw new Error('A valid user ID is required.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error(
      '[Notifications] Unable to verify authenticated user:',
      authError,
    );

    throw new Error('Please sign in to register this device.');
  }

  if (user.id !== expectedUserId) {
    throw new Error(
      'Your account changed during device registration. Please try again.',
    );
  }

  const now = new Date().toISOString();

  const deviceDetails = {
    platform: input.platform,
    device_id: input.deviceId?.trim() || null,
    device_name: input.deviceName?.trim() || null,
    timezone: input.timezone?.trim() || null,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  };

  const { data: existingToken, error: lookupError } = await supabase
    .from('device_push_tokens')
    .select(DEVICE_TOKEN_COLUMNS)
    .eq('expo_push_token', expoPushToken)
    .eq('user_id', expectedUserId)
    .maybeSingle();

  if (lookupError) {
    console.error(
      '[Notifications] Unable to check existing device registration:',
      lookupError,
    );

    throw new Error('Unable to check device registration. Please try again.');
  }

  if (existingToken) {
    const { data, error } = await supabase
      .from('device_push_tokens')
      .update(deviceDetails)
      .eq('id', existingToken.id)
      .eq('user_id', expectedUserId)
      .select(DEVICE_TOKEN_COLUMNS)
      .single();

    if (error) {
      console.error(
        '[Notifications] Unable to refresh device registration:',
        error,
      );

      throw new Error('Unable to refresh device registration. Please try again.');
    }

    await ensureNotificationPreferences(expectedUserId);

    return data as DevicePushToken;
  }

  const { data, error } = await supabase
    .from('device_push_tokens')
    .insert({
      user_id: expectedUserId,
      expo_push_token: expoPushToken,
      ...deviceDetails,
    })
    .select(DEVICE_TOKEN_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      console.warn(
        '[Notifications] This push token is already registered to another account.',
      );

      throw new Error(
        'This device is already registered to another account. Please contact support if you need help.',
      );
    }

    console.error(
      '[Notifications] Unable to register device:',
      error,
    );

    throw new Error('Unable to register this device. Please try again.');
  }

  await ensureNotificationPreferences(expectedUserId);

  return data as DevicePushToken;
}
