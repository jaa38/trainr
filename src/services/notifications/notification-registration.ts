import { supabase } from '@/lib/supabase';

export type DevicePlatform = 'ios' | 'android';

export type RegisterDevicePushTokenInput = {
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
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Registers or refreshes a push token for the authenticated user.
 *
 * Existing tokens are updated only when they belong to the current user.
 * A token owned by another account is never reassigned.
 */
export async function registerDevicePushToken(
  input: RegisterDevicePushTokenInput,
): Promise<DevicePushToken> {
  const expoPushToken = input.expoPushToken?.trim();

  if (!expoPushToken) {
    throw new Error('A valid Expo push token is required.');
  }

  if (input.platform !== 'ios' && input.platform !== 'android') {
    throw new Error('Push notifications are only supported on iOS and Android.');
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

  const now = new Date().toISOString();

  const deviceDetails = {
    platform: input.platform,
    device_id: input.deviceId?.trim() || null,
    device_name: input.deviceName?.trim() || null,
    timezone: input.timezone?.trim() || null,
    is_active: true,
    last_seen_at: now,
    last_error: null,
    updated_at: now,
  };

  const { data: existingToken, error: lookupError } = await supabase
    .from('device_push_tokens')
    .select('*')
    .eq('expo_push_token', expoPushToken)
    .eq('user_id', user.id)
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
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      console.error(
        '[Notifications] Unable to refresh device registration:',
        error,
      );
      throw new Error('Unable to refresh device registration. Please try again.');
    }

    return data as DevicePushToken;
  }

  const { data, error } = await supabase
    .from('device_push_tokens')
    .insert({
      user_id: user.id,
      expo_push_token: expoPushToken,
      ...deviceDetails,
    })
    .select('*')
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

  return data as DevicePushToken;
}
