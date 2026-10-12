
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

const experienceLevels = ['Beginner', 'Intermediate', 'Advanced'] as const;

const trainingOptions = [
  { id: 'gym', label: 'Gym workouts' },
  { id: 'home', label: 'Home workouts' },
  { id: 'outdoor', label: 'Outdoor training' },
  { id: 'online', label: 'Online coaching' },
] as const;

export default function GymGoerPreferencesScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, completeOnboardingLocally } = useAuth();

  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [preferredTraining, setPreferredTraining] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleTraining(trainingId: string) {
    if (isSaving) return;

    setPreferredTraining((current) =>
      current.includes(trainingId)
        ? current.filter((item) => item !== trainingId)
        : [...current, trainingId],
    );
  }

  async function handleFinish() {
    if (!user || isSaving) return;

    if (
      !experienceLevel ||
      preferredTraining.length === 0 ||
      !location.trim()
    ) {
      setErrorMessage(
        'Choose your experience level and preferred training, and enter your location.',
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error: preferencesError } = await supabase
        .from('gym_goer_profiles')
        .upsert(
          {
            user_id: user.id,
            experience_level: experienceLevel.toLowerCase(),
            preferred_training: preferredTraining,
            location: location.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (preferencesError) throw preferencesError;

      const { error: completionError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (completionError) throw completionError;

      console.log('[Onboarding] Database completion saved');

      completeOnboardingLocally();

      console.log('[Onboarding] Local profile marked complete');
      console.log('[Onboarding] Navigating to Gym-Goer dashboard');

      router.replace('/(tabs)/gym-goer');
    } catch (error) {
      console.error('[Gym-Goer Onboarding] Failed to finish setup:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to finish setup. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderOption(
    selected: boolean,
    label: string,
    onPress: () => void,
    key: string,
  ) {
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: isSaving }}
        disabled={isSaving}
        onPress={onPress}
        style={({ pressed }) => ({
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
          opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText
          variant="body"
          color={selected ? colors.brand.red : colors.text.primary}
        >
          {selected ? '✓  ' : ''}
          {label}
        </AppText>
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" color={colors.brand.red}>
          GYM-GOER SETUP · STEP 4 OF 4
        </AppText>

        <AppText variant="h1" color={colors.text.primary}>
          Make it your own.
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          Tell us about your training preferences so we can personalise your
          experience.
        </AppText>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Experience level
          </AppText>

          {experienceLevels.map((level) =>
            renderOption(
              experienceLevel === level.toLowerCase(),
              level,
              () => setExperienceLevel(level.toLowerCase()),
              level,
            ),
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Preferred training
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            Choose all that apply.
          </AppText>

          {trainingOptions.map((option) =>
            renderOption(
              preferredTraining.includes(option.id),
              option.label,
              () => toggleTraining(option.id),
              option.id,
            ),
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Your location
          </AppText>

          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Enter your city or area"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="words"
            editable={!isSaving}
            style={{
              minHeight: 54,
              borderWidth: 1,
              borderColor: colors.border.default,
              borderRadius: 12,
              paddingHorizontal: spacing.md,
              color: colors.text.primary,
              backgroundColor: colors.background.secondary,
            }}
          />
        </View>

        {errorMessage ? (
          <AppText
            variant="bodySmall"
            color={colors.text.error}
            accessibilityRole="alert"
          >
            {errorMessage}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
          disabled={isSaving}
          onPress={handleFinish}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: colors.brand.red,
            opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="buttonLarge" color="#FFFFFF">
            {isSaving ? 'SAVING…' : 'COMPLETE SETUP →'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
