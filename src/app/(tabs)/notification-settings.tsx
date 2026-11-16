import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Smartphone,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/notifications/NotificationProvider';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferences,
  type NotificationPreferenceKey,
} from '@/services/notifications/notification-preferences';
import { useTrainrTheme } from '@/theme';

const PREFERENCE_ITEMS: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
}[] = [
  {
    key: 'booking_updates',
    title: 'Booking Updates',
    description: 'Receive updates when bookings are requested, confirmed, declined or changed.',
  },
  {
    key: 'session_reminders',
    title: 'Session Reminders',
    description: 'Get reminders about your upcoming training sessions.',
  },
  {
    key: 'workout_updates',
    title: 'Workout Updates',
    description: 'Stay informed when workouts are assigned or updated.',
  },
  {
    key: 'feedback_updates',
    title: 'Feedback Updates',
    description: 'Receive notifications when trainer feedback is available.',
  },
  {
    key: 'post_session_followups',
    title: 'Post-session Follow-ups',
    description: 'Get follow-up notifications after completed training sessions.',
  },
];

export default function NotificationSettingsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const {
    permissionStatus,
    isCheckingPermission,
    isRegistering,
    isRegistered,
    error,
    refreshPermissionStatus,
    requestPermissionAndRegister,
  } = useNotifications();

  const [localError, setLocalError] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [savingPreference, setSavingPreference] =
    useState<NotificationPreferenceKey | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  activeUserIdRef.current = user?.id ?? null;

  useEffect(() => {
    let isActive = true;

    setSavingPreference(null);

    async function loadPreferences() {
      if (!user?.id) {
        setPreferences(null);
        setIsLoadingPreferences(false);
        return;
      }

      setIsLoadingPreferences(true);
      setPreferenceError(null);
      setPreferences(null);

      try {
        const savedPreferences = await getNotificationPreferences(user.id);

        if (isActive) {
          setPreferences(savedPreferences);
        }
      } catch (loadError) {
        if (isActive) {
          setPreferenceError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load notification preferences.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingPreferences(false);
        }
      }
    }

    loadPreferences();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const permissionGranted = permissionStatus?.granted ?? false;
  const canAskAgain = permissionStatus?.canAskAgain ?? true;

  const permissionLabel = isCheckingPermission
    ? 'Checking permission...'
    : permissionGranted
      ? 'Enabled'
      : permissionStatus?.status === 'denied'
        ? 'Not enabled'
        : 'Not requested';

  async function handleEnableNotifications() {
    setLocalError(null);

    try {
      await requestPermissionAndRegister();
    } catch (registrationError) {
      setLocalError(
        registrationError instanceof Error
          ? registrationError.message
          : 'Unable to enable notifications. Please try again.',
      );
    }
  }

  async function handleOpenDeviceSettings() {
    try {
      await Linking.openSettings();
      await refreshPermissionStatus();
    } catch {
      setLocalError(
        'Unable to open device settings. Please update notification permissions manually.',
      );
    }
  }

  async function handlePreferenceChange(
    preference: NotificationPreferenceKey,
    enabled: boolean,
  ) {
    const userId = user?.id;
    const previousValue = preferences?.[preference];

    if (
      !userId ||
      !preferences ||
      previousValue === undefined ||
      savingPreference !== null
    ) {
      return;
    }

    setPreferenceError(null);
    setPreferences((current) =>
      current ? { ...current, [preference]: enabled } : current,
    );
    setSavingPreference(preference);

    try {
      await updateNotificationPreference(userId, preference, enabled);
    } catch (saveError) {
      if (activeUserIdRef.current === userId) {
        setPreferences((current) =>
          current ? { ...current, [preference]: previousValue } : current,
        );

        setPreferenceError(
          saveError instanceof Error
            ? saveError.message
            : 'Unable to save your notification preference.',
        );
      }
    } finally {
      if (activeUserIdRef.current === userId) {
        setSavingPreference(null);
      }
    }
  }

  const showDeviceSettings =
    !permissionGranted &&
    permissionStatus?.status === 'denied' &&
    !canAskAgain;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            alignSelf: 'flex-start',
            paddingVertical: spacing.sm,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <AppText variant="button" color={colors.text.primary}>
            Back
          </AppText>
        </Pressable>

        {/* Header */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            APP PREFERENCES
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            NOTIFICATIONS.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Stay connected with your training, bookings and important updates from TRAINR.
          </AppText>
        </View>

        {/* Permission Status */}
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Bell size={21} color={colors.brand.red} />
              <AppText variant="h3" color={colors.text.primary}>
                Notification Permission
              </AppText>
            </View>

            {permissionGranted ? (
              <CheckCircle2 size={21} color={colors.brand.red} />
            ) : (
              <AlertCircle size={21} color={colors.text.secondary} />
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="bodySmall" color={colors.text.secondary}>
              Device permission
            </AppText>

            <AppText
              variant="button"
              color={permissionGranted ? colors.brand.red : colors.text.secondary}
            >
              {permissionLabel}
            </AppText>
          </View>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            TRAINR needs your permission to send push notifications to this device. You
            can change this permission at any time in your device settings.
          </AppText>
        </View>

        {/* Notification Preferences */}
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.lg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              Notification Preferences
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Choose which TRAINR activities you want to receive notifications about.
            </AppText>
          </View>

          {isLoadingPreferences ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <ActivityIndicator color={colors.brand.red} />

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Loading your preferences...
              </AppText>
            </View>
          ) : preferences ? (
            <View style={{ gap: spacing.lg }}>
              {PREFERENCE_ITEMS.map((item, index) => (
                <View
                  key={item.key}
                  style={{
                    gap: spacing.sm,
                    paddingTop: index === 0 ? 0 : spacing.md,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border.default,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="button" color={colors.text.primary}>
                        {item.title}
                      </AppText>

                      <AppText variant="caption" color={colors.text.secondary}>
                        {item.description}
                      </AppText>
                    </View>

                    <Switch
                      accessibilityLabel={`${item.title} notifications`}
                      accessibilityHint={item.description}
                      value={preferences[item.key]}
                      onValueChange={(enabled) =>
                        handlePreferenceChange(item.key, enabled)
                      }
                      disabled={savingPreference !== null}
                      trackColor={{
                        false: colors.border.default,
                        true: colors.brand.red,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {savingPreference === item.key && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                      }}
                    >
                      <ActivityIndicator
                        size="small"
                        color={colors.brand.red}
                      />

                      <AppText variant="caption" color={colors.text.tertiary}>
                        Saving...
                      </AppText>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodySmall" color={colors.text.error}>
                {preferenceError || 'Notification preferences are unavailable.'}
              </AppText>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPreferences(null);
                  setIsLoadingPreferences(true);
                  setPreferenceError(null);
                  if (user?.id) {
                    const retryUserId = user.id;

                    getNotificationPreferences(retryUserId)
                      .then((savedPreferences) => {
                        if (activeUserIdRef.current === retryUserId) {
                          setPreferences(savedPreferences);
                        }
                      })
                      .catch((retryError) => {
                        if (activeUserIdRef.current === retryUserId) {
                          setPreferenceError(
                            retryError instanceof Error
                              ? retryError.message
                              : 'Unable to load notification preferences.',
                          );
                        }
                      })
                      .finally(() => {
                        if (activeUserIdRef.current === retryUserId) {
                          setIsLoadingPreferences(false);
                        }
                      });
                  } else {
                    setIsLoadingPreferences(false);
                  }
                }}
                style={{
                  alignSelf: 'flex-start',
                  paddingVertical: spacing.sm,
                }}
              >
                <AppText variant="button" color={colors.brand.red}>
                  Try Again
                </AppText>
              </Pressable>
            </View>
          )}

          {preferenceError && preferences && (
            <View
              accessibilityRole="alert"
              style={{
                padding: spacing.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.brand.red,
              }}
            >
              <AppText variant="bodySmall" color={colors.text.error}>
                {preferenceError}
              </AppText>
            </View>
          )}
        </View>

        {/* Device Registration */}
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Smartphone size={21} color={colors.brand.red} />

            <AppText variant="h3" color={colors.text.primary}>
              Device Registration
            </AppText>
          </View>

          <AppText variant="body" color={colors.text.secondary}>
            Register this device with your TRAINR account to receive push notifications.
          </AppText>

          {isRegistered && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <CheckCircle2 size={18} color={colors.brand.red} />

              <AppText variant="bodySmall" color={colors.brand.red}>
                This device has been registered.
              </AppText>
            </View>
          )}

          {showDeviceSettings ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open device settings"
              onPress={handleOpenDeviceSettings}
              style={({ pressed }) => ({
                minHeight: 54,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                borderRadius: 14,
                backgroundColor: colors.brand.red,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Smartphone size={19} color="#FFFFFF" />

              <AppText variant="buttonLarge" color="#FFFFFF">
                Open Device Settings
              </AppText>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enable TRAINR notifications"
              accessibilityState={{
                disabled: isCheckingPermission || isRegistering,
                busy: isRegistering,
              }}
              disabled={isCheckingPermission || isRegistering}
              onPress={handleEnableNotifications}
              style={({ pressed }) => ({
                minHeight: 54,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                borderRadius: 14,
                backgroundColor: colors.brand.red,
                opacity:
                  pressed || isRegistering
                    ? 0.75
                    : isCheckingPermission
                      ? 0.5
                      : 1,
              })}
            >
              {isRegistering ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Bell size={19} color="#FFFFFF" />
              )}

              <AppText variant="buttonLarge" color="#FFFFFF">
                {isRegistering
                  ? 'Registering Device...'
                  : isRegistered
                    ? 'Refresh Device Registration'
                    : 'Enable Notifications'}
              </AppText>
            </Pressable>
          )}

          <AppText variant="caption" color={colors.text.tertiary}>
            Permission is requested only when you choose to enable notifications.
          </AppText>
        </View>

        {/* Error Feedback */}
        {(localError || error) && (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              gap: spacing.xs,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.brand.red,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.error}>
              {localError || error}
            </AppText>
          </View>
        )}

        {/* Information */}
        <View
          style={{
            padding: spacing.lg,
            gap: spacing.sm,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            About TRAINR Notifications
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            Notifications are designed to keep you informed about relevant activity on
            your TRAINR account.
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <ActivityIndicator
              size="small"
              color={colors.text.tertiary}
              animating={false}
            />

            <AppText variant="caption" color={colors.text.tertiary}>
              Available on supported iOS and Android devices.
            </AppText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
