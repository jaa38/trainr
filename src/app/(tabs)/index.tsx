import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

type AccountType = 'gym_goer' | 'trainer';

const roleRoutes: Record<AccountType, Href> = {
  gym_goer: '/(onboarding)/gym-goer' as Href,
  trainer: '/(onboarding)/personal-trainer' as Href,
};

export default function RoleSelectionScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, profile, isLoading, refreshProfile } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function selectRole(accountType: AccountType) {
    if (isLoading || !user || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // If a role has already been selected, continue to its onboarding flow.
      if (profile?.account_type_selected) {
        const existingRole = profile.role;

        if (existingRole !== 'gym_goer' && existingRole !== 'trainer') {
          throw new Error('Your account has an unsupported role.');
        }

        router.replace(roleRoutes[existingRole]);
        return;
      }

      const { error } = await supabase.rpc('select_initial_account_type', {
        requested_role: accountType,
      });

      if (error) {
        throw error;
      }

      await refreshProfile();
      router.replace(roleRoutes[accountType]);
    } catch (error) {
      console.error('[Role Selection] Failed to save account type:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your account type. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const roleOptions: {
    role: AccountType;
    title: string;
    description: string;
  }[] = [
    {
      role: 'gym_goer',
      title: "I'm a Gym-Goer",
      description: 'Discover trainers, book sessions and track your progress.',
    },
    {
      role: 'trainer',
      title: "I'm a Personal Trainer",
      description: 'Manage clients, organise sessions and grow your business.',
    },
  ];

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <AppText variant="displayLarge" color={colors.text.primary}>
          TRAINR
        </AppText>

        <AppText variant="h2" color={colors.text.primary}>
          Choose your experience.
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          Tell us how you&apos;ll use TRAINR so we can personalise your experience.{' '}
        </AppText>

        {roleOptions.map((option) => (
          <Pressable
            key={option.role}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityHint={option.description}
            accessibilityState={{ disabled: isSaving || isLoading }}
            disabled={isSaving || isLoading}
            onPress={() => selectRole(option.role)}
            style={({ pressed }) => ({
              padding: spacing.lg,
              gap: spacing.sm,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.brand.red,
              backgroundColor: colors.background.secondary,
              opacity: isSaving || isLoading ? 0.6 : pressed ? 0.75 : 1,
            })}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {option.title}
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {option.description}
            </AppText>

            <AppText variant="button" color={colors.brand.red}>
              {isSaving ? 'Saving…' : 'Continue →'}
            </AppText>
          </Pressable>
        ))}

        {errorMessage ? (
          <AppText
            variant="bodySmall"
            color={colors.text.error}
            accessibilityRole="alert"
          >
            {errorMessage}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
