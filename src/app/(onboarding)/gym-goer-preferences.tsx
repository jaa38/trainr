import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  gymGoerPreferencesSchema,
  type GymGoerPreferencesFormValues,
} from '@/schemas/gym-goer-preferences';
import { useTrainrTheme } from '@/theme';

const experienceLevels = ['Beginner', 'Intermediate', 'Advanced'] as const;

const trainingOptions = [
  { id: 'gym', label: 'Gym workouts' },
  { id: 'home', label: 'Home workouts' },
  { id: 'outdoor', label: 'Outdoor training' },
  { id: 'online', label: 'Online coaching' },
] as const;

const budgetCurrencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

export default function GymGoerPreferencesScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, completeOnboardingLocally } = useAuth();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GymGoerPreferencesFormValues>({
    resolver: zodResolver(gymGoerPreferencesSchema),
    defaultValues: {
      experienceLevel: 'beginner',
      preferredTraining: [],
      location: '',
      budgetCurrency: 'NGN',
      budgetMin: '',
      budgetMax: '',
    },
  });

  const experienceLevel = useWatch({
    control,
    name: 'experienceLevel',
  });

  const preferredTraining = useWatch({
    control,
    name: 'preferredTraining',
  });

  const budgetCurrency = useWatch({
    control,
    name: 'budgetCurrency',
  });

  const isSaving = isSubmitting || isLoadingPreferences;

  useEffect(() => {
    let isActive = true;

    async function loadPreferences() {
      if (!user) {
        if (isActive) {
          setIsLoadingPreferences(false);
        }
        return;
      }

      setIsLoadingPreferences(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('gym_goer_profiles')
          .select(
            'experience_level, preferred_training, location, budget_min, budget_max, budget_currency',
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!isActive) return;

        if (data) {
          const validExperienceLevels = ['beginner', 'intermediate', 'advanced'] as const;

          const savedExperienceLevel = validExperienceLevels.includes(
            data.experience_level as (typeof validExperienceLevels)[number],
          )
            ? (data.experience_level as (typeof validExperienceLevels)[number])
            : 'beginner';

          const validTrainingOptions = ['gym', 'home', 'outdoor', 'online'] as const;

          const savedTraining = ((data.preferred_training ?? []) as string[]).filter(
            (item): item is (typeof validTrainingOptions)[number] =>
              validTrainingOptions.includes(
                item as (typeof validTrainingOptions)[number],
              ),
          );

          const validCurrencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

          const savedCurrency = validCurrencies.includes(
            data.budget_currency as (typeof validCurrencies)[number],
          )
            ? (data.budget_currency as (typeof validCurrencies)[number])
            : 'NGN';

          reset({
            experienceLevel: savedExperienceLevel,
            preferredTraining: savedTraining,
            location: data.location ?? '',
            budgetCurrency: savedCurrency,
            budgetMin: data.budget_min == null ? '' : String(data.budget_min),
            budgetMax: data.budget_max == null ? '' : String(data.budget_max),
          });
        }
      } catch (error) {
        console.error('[Gym-Goer Onboarding] Failed to load preferences:', error);

        if (isActive) {
          setErrorMessage('Unable to load your saved preferences. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingPreferences(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, [user, reset]);

  function toggleTraining(trainingId: 'gym' | 'home' | 'outdoor' | 'online') {
    if (isSaving) return;

    setValue(
      'preferredTraining',
      preferredTraining.includes(trainingId)
        ? preferredTraining.filter((item) => item !== trainingId)
        : [...preferredTraining, trainingId],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function handleFinish(values: GymGoerPreferencesFormValues) {
    if (!user) {
      setErrorMessage('Your session could not be found. Please sign in again.');
      return;
    }

    setErrorMessage(null);

    try {
      const budgetMin = values.budgetMin.trim() === '' ? null : Number(values.budgetMin);

      const budgetMax = values.budgetMax.trim() === '' ? null : Number(values.budgetMax);

      const { error: preferencesError } = await supabase.from('gym_goer_profiles').upsert(
        {
          user_id: user.id,
          experience_level: values.experienceLevel,
          preferred_training: values.preferredTraining,
          location: values.location.trim(),
          budget_min: budgetMin,
          budget_max: budgetMax,
          budget_currency: values.budgetCurrency,
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

      completeOnboardingLocally();
      router.replace('/(tabs)/gym-goer');
    } catch (error) {
      console.error('[Gym-Goer Onboarding] Failed to finish setup:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to finish setup. Please try again.',
      );
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
        <AppText variant="body" color={selected ? colors.brand.red : colors.text.primary}>
          {selected ? '✓  ' : ''}
          {label}
        </AppText>
      </Pressable>
    );
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
          Tell us about your training preferences so we can personalise your experience.
        </AppText>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Experience level
          </AppText>

          {experienceLevels.map((level) =>
            renderOption(
              experienceLevel === level.toLowerCase(),
              level,
              () =>
                setValue(
                  'experienceLevel',
                  level.toLowerCase() as GymGoerPreferencesFormValues['experienceLevel'],
                  { shouldDirty: true, shouldValidate: true },
                ),
              level,
            ),
          )}

          {errors.experienceLevel?.message ? (
            <AppText variant="bodySmall" color={colors.text.error}>
              {errors.experienceLevel.message}
            </AppText>
          ) : null}
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

          {errors.preferredTraining?.message ? (
            <AppText variant="bodySmall" color={colors.text.error}>
              {errors.preferredTraining.message}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Your location
          </AppText>

          <Controller
            control={control}
            name="location"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Enter your city or area"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                editable={!isSaving}
                accessibilityLabel="Training location"
                style={{
                  minHeight: 54,
                  borderWidth: 1,
                  borderColor: errors.location
                    ? colors.text.error
                    : colors.border.default,
                  borderRadius: 12,
                  paddingHorizontal: spacing.md,
                  color: colors.text.primary,
                  backgroundColor: colors.background.secondary,
                }}
              />
            )}
          />

          {errors.location?.message ? (
            <AppText variant="bodySmall" color={colors.text.error}>
              {errors.location.message}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="h3" color={colors.text.primary}>
            Training budget
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            Set an optional budget for your training. You can leave these fields blank.
          </AppText>

          <AppText variant="body" color={colors.text.primary}>
            Currency
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
            }}
          >
            {budgetCurrencies.map((currency) => (
              <Pressable
                key={currency}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: budgetCurrency === currency,
                  disabled: isSaving,
                }}
                disabled={isSaving}
                onPress={() =>
                  setValue('budgetCurrency', currency, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    budgetCurrency === currency
                      ? colors.brand.red
                      : colors.border.default,
                  backgroundColor:
                    budgetCurrency === currency
                      ? colors.background.secondary
                      : colors.background.primary,
                }}
              >
                <AppText
                  variant="body"
                  color={
                    budgetCurrency === currency ? colors.brand.red : colors.text.primary
                  }
                >
                  {currency}
                </AppText>
              </Pressable>
            ))}
          </View>

          <AppText variant="body" color={colors.text.primary}>
            Minimum budget (optional)
          </AppText>

          <Controller
            control={control}
            name="budgetMin"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. 10000"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                editable={!isSaving}
                accessibilityLabel="Minimum training budget"
                style={{
                  minHeight: 54,
                  borderWidth: 1,
                  borderColor: errors.budgetMin
                    ? colors.text.error
                    : colors.border.default,
                  borderRadius: 12,
                  paddingHorizontal: spacing.md,
                  color: colors.text.primary,
                  backgroundColor: colors.background.secondary,
                }}
              />
            )}
          />

          {errors.budgetMin?.message ? (
            <AppText variant="bodySmall" color={colors.text.error}>
              {errors.budgetMin.message}
            </AppText>
          ) : null}

          <AppText variant="body" color={colors.text.primary}>
            Maximum budget (optional)
          </AppText>

          <Controller
            control={control}
            name="budgetMax"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. 50000"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                editable={!isSaving}
                accessibilityLabel="Maximum training budget"
                style={{
                  minHeight: 54,
                  borderWidth: 1,
                  borderColor: errors.budgetMax
                    ? colors.text.error
                    : colors.border.default,
                  borderRadius: 12,
                  paddingHorizontal: spacing.md,
                  color: colors.text.primary,
                  backgroundColor: colors.background.secondary,
                }}
              />
            )}
          />

          {errors.budgetMax?.message ? (
            <AppText variant="bodySmall" color={colors.text.error}>
              {errors.budgetMax.message}
            </AppText>
          ) : null}
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
          accessibilityState={{
            disabled: isSaving,
            busy: isSaving,
          }}
          disabled={isSaving}
          onPress={handleSubmit(handleFinish)}
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
            {isLoadingPreferences
              ? 'LOADING PREFERENCES…'
              : isSubmitting
                ? 'SAVING…'
                : 'COMPLETE SETUP →'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
