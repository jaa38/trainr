import { router } from 'expo-router';
import {
    AlertCircle,
    ArrowLeft,
    Bell,
    CheckCircle2,
    Smartphone
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useNotifications } from '@/providers/notifications/NotificationProvider';
import { useTrainrTheme } from '@/theme';

export default function NotificationSettingsScreen() {
  const { colors, spacing } = useTrainrTheme();

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

  const showDeviceSettings =
    !permissionGranted && permissionStatus?.status === 'denied' && !canAskAgain;

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
                opacity: pressed || isRegistering ? 0.75 : isCheckingPermission ? 0.5 : 1,
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
