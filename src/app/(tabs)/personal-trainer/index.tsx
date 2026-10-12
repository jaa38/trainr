import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

export default function PersonalTrainerHomeScreen() {
  const { colors, spacing, mode } = useTrainrTheme();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appIcon =
    mode === 'dark'
      ? require('../../../../assets/images/icons/darkModeAppIcon.png')
      : require('../../../../assets/images/icons/lightModeAppIcon.png');

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      setIsSigningOut(false);
    }
  }

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
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xxxl,
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>
            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{ letterSpacing: 1.2 }}
            >
              TRAINER WORKSPACE
            </AppText>
          </View>

          <Image
            source={appIcon}
            accessibilityLabel="TRAINR app icon"
            resizeMode="contain"
            style={{ width: 64, height: 64, borderRadius: 14 }}
          />
        </View>

        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{ letterSpacing: 1.5 }}
          >
            YOUR BUSINESS. YOUR IMPACT.
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            TRAINERS
          </AppText>
          <AppText variant="displayLarge" color={colors.brand.red}>
            MOVE PEOPLE.
          </AppText>
          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ lineHeight: 24, marginTop: spacing.xs }}
          >
            Your workspace for managing clients, planning sessions and helping people
            reach their fitness goals.
          </AppText>
        </View>

        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.md,
            marginBottom: spacing.xl,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.brand.red,
            }}
          />
          <AppText variant="h2" color={colors.text.primary}>
            YOUR NEXT SESSION STARTS HERE.
          </AppText>
          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ lineHeight: 24 }}
          >
            Build your client relationships, organise your schedule and deliver training
            that makes a difference.
          </AppText>
        </View>

        {errorMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.brand.red,
              backgroundColor: colors.background.secondary,
              marginBottom: spacing.md,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage}
            </AppText>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of TRAINR"
          accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.primary,
            opacity: isSigningOut ? 0.6 : pressed ? 0.75 : 1,
          })}
        >
          <AppText variant="buttonLarge" color={colors.text.primary}>
            {isSigningOut ? 'Signing Out…' : 'Sign Out'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
