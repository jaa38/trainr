import { supabase } from '@/lib/supabase';

import { getNotificationDeviceId } from './notification-permissions';

/**
 * Removes this device's push-token registration for the expected user.
 *
 * This function deliberately does not retrieve an Expo push token.
 * It only deletes records matching both the authenticated user ID
 * and the current device ID.
 */
export async function removeCurrentDevicePushToken(
  expectedUserId: string,
): Promise<void> {
  if (!expectedUserId.trim()) {
    throw new Error(
      'A valid user ID is required to remove a device push token.',
    );
  }

  const deviceId = await getNotificationDeviceId();

  // Never broaden the deletion if the device identifier is unavailable.
  if (!deviceId) {
    console.warn(
      '[Notifications] Device identifier unavailable. Skipping token cleanup.',
    );
    return;
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!data.user || data.user.id !== expectedUserId) {
    throw new Error(
      'Authenticated user does not match the expected user. Token cleanup aborted.',
    );
  }

  const { error: deleteError } = await supabase
    .from('device_push_tokens')
    .delete()
    .eq('user_id', expectedUserId)
    .eq('device_id', deviceId);

  if (deleteError) {
    throw deleteError;
  }

  console.log(
    '[Notifications] Current device token cleanup completed.',
  );
}
