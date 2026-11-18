
import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  user_id: string;
  booking_updates: boolean;
  session_reminders: boolean;
  workout_updates: boolean;
  feedback_updates: boolean;
  post_session_followups: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferenceKey =
  | 'booking_updates'
  | 'session_reminders'
  | 'workout_updates'
  | 'feedback_updates'
  | 'post_session_followups';

const PREFERENCE_COLUMNS =
  'user_id, booking_updates, session_reminders, workout_updates, feedback_updates, post_session_followups, created_at, updated_at';

/**
 * Creates default notification preferences for the authenticated user
 * without overwriting any existing preferences.
 */
export async function ensureNotificationPreferences(
  userId: string,
): Promise<void> {
  if (!userId?.trim()) {
    throw new Error('A valid user ID is required.');
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId },
      {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      },
    );

  if (error) {
    console.error(
      '[Notifications] Unable to initialise notification preferences:',
      error,
    );

    throw new Error(
      'Unable to initialise notification preferences. Please try again.',
    );
  }
}

/**
 * Retrieves the saved notification preferences for a user.
 * Initialises the default row if one does not already exist.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  if (!userId?.trim()) {
    throw new Error('A valid user ID is required.');
  }

  await ensureNotificationPreferences(userId);

  const { data, error } = await supabase
    .from('notification_preferences')
    .select(PREFERENCE_COLUMNS)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error(
      '[Notifications] Unable to retrieve notification preferences:',
      error,
    );

    throw new Error(
      'Unable to load notification preferences. Please try again.',
    );
  }

  return data as NotificationPreferences;
}

/**
 * Updates one notification category without changing other preferences.
 * Ensures the user's preference row exists before updating it.
 */
export async function updateNotificationPreference(
  userId: string,
  preference: NotificationPreferenceKey,
  enabled: boolean,
): Promise<void> {
  if (!userId?.trim()) {
    throw new Error('A valid user ID is required.');
  }

  // Ensure the preference row exists without overwriting saved settings.
  await ensureNotificationPreferences(userId);

  const { error } = await supabase
    .from('notification_preferences')
    .update({ [preference]: enabled })
    .eq('user_id', userId);

  if (error) {
    console.error(
      '[Notifications] Unable to update notification preference:',
      error,
    );

    throw new Error(
      'Unable to save your notification preference. Please try again.',
    );
  }
}
