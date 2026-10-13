import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

export default function GymGoerOnboardingScreen() {
  const { colors, spacing } = useTrainrTheme();

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to account selection"
          onPress={() => router.replace('/(tabs)')}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <AppText variant="button" color={colors.text.secondary}>
            ← BACK TO ACCOUNT SELECTION
          </AppText>
        </Pressable>

        <AppText variant="caption" color={colors.brand.red}>
          GYM-GOER SETUP · STEP 1 OF 4
        </AppText>

        <AppText variant="displayLarge" color={colors.text.primary}>
          YOUR JOURNEY.
        </AppText>

        <AppText variant="displayLarge" color={colors.brand.red}>
          YOUR GOALS.
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          Let&apos;s personalise TRAINR around your fitness goals, experience and
          preferred way to train.
        </AppText>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(onboarding)/gym-goer-details')}
          style={{
            alignItems: 'center',
            padding: spacing.lg,
            borderRadius: 14,
            backgroundColor: colors.brand.red,
          }}
        >
          <AppText variant="buttonLarge" color="#FFFFFF">
            GET STARTED →
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
