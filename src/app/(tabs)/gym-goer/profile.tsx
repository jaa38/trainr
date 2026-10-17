import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

export default function GymGoerProfileScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fullName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : 'TRAINR Member';

  const email = user?.email ?? 'No email available';
  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'TM';

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

  const sections = [
    {
      title: 'PERSONAL INFORMATION',
      description: 'Manage your name and personal details.',
    },
    {
      title: 'FITNESS GOALS',
      description: 'Set your goals, training preferences and experience.',
    },
    {
      title: 'APP PREFERENCES',
      description: 'Manage notifications and your preferred settings.',
    },
  ];

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            YOUR ACCOUNT
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            PROFILE.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Make your fitness journey your own.
          </AppText>
        </View>

        <View
          style={{
            alignItems: 'center',
            padding: spacing.xl,
            gap: spacing.md,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 24,
              backgroundColor: colors.brand.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="h1" color="#FFFFFF">
              {initials}
            </AppText>
          </View>

          <AppText variant="h2" color={colors.text.primary}>
            {fullName}
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            {email}
          </AppText>

          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              backgroundColor: colors.brand.redLight,
            }}
          >
            <AppText variant="caption" color={colors.brand.red}>
              GYM-GOER
            </AppText>
          </View>
        </View>

        {sections.map((section) => (
          <View
            key={section.title}
            style={{
              padding: spacing.lg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.sm,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {section.title}
            </AppText>
            <AppText variant="body" color={colors.text.secondary}>
              {section.description}
            </AppText>
            <AppText variant="caption" color={colors.text.tertiary}>
              Profile editing coming next.
            </AppText>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View saved trainers"
          onPress={() => router.push('/(tabs)/favourites')}
          style={{
            minHeight: 68,
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              Saved Trainers
            </AppText>
            <AppText variant="bodySmall" color={colors.text.secondary}>
              View and manage your favourite coaches.
            </AppText>
          </View>

          <ArrowRight size={20} color={colors.text.secondary} />
        </Pressable>

        {errorMessage && (
          <AppText variant="bodySmall" color={colors.text.error}>
            {errorMessage}
          </AppText>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={{
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <AppText variant="buttonLarge" color={colors.text.primary}>
            {isSigningOut ? 'Signing Out…' : 'Sign Out'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
