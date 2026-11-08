import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

export default function PersonalTrainerProfileScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, signOut } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fullName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : 'Personal Trainer';

  const email = user?.email ?? 'No email available';

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'PT';

  const sections = [
    {
      title: 'PROFESSIONAL BIO',
      description: 'Introduce yourself, your coaching approach and your experience.',
    },
    {
      title: 'QUALIFICATIONS',
      description: 'Showcase relevant certifications and professional qualifications.',
    },
    {
      title: 'TRAINING SPECIALITIES',
      description:
        'Highlight your expertise, such as strength training, conditioning or mobility.',
    },
    {
      title: 'SESSION RATES',
      description:
        'Manage your training prices when the booking and payment features are available.',
    },
  ];

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
            TRAINER WORKSPACE
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            PROFILE.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Your expertise. Your professional identity.
          </AppText>
        </View>

        <View
          style={{
            alignItems: 'center',
            padding: spacing.xl,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
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
              PERSONAL TRAINER
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
              Editing functionality coming next.
            </AppText>
          </View>
        ))}

        {errorMessage && (
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
              {errorMessage}
            </AppText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of TRAINR"
          accessibilityState={{
            disabled: isSigningOut,
            busy: isSigningOut,
          }}
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
