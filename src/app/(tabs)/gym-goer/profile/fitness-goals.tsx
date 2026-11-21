import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useGymGoerFitnessGoals } from '@/hooks/gym-goer/useGymGoerFitnessGoals';
import { useAuth } from '@/providers/AuthProvider';
import {
  gymGoerFitnessGoalsSchema,
  type GymGoerFitnessGoal,
  type GymGoerFitnessGoalsFormValues,
  type GymGoerPrimaryGoal,
  type GymGoerTrainingFormat,
  type GymGoerTrainingPreference,
} from '@/schemas/gym-goer-fitness-goals';
import { useTrainrTheme } from '@/theme';

const primaryGoalOptions: {
  id: GymGoerPrimaryGoal;
  title: string;
  description: string;
}[] = [
  {
    id: 'lose_weight',
    title: 'Weight loss',
    description: 'Work towards a healthier body composition.',
  },
  {
    id: 'build_muscle',
    title: 'Muscle building',
    description: 'Develop muscle mass and improve definition.',
  },
  {
    id: 'increase_strength',
    title: 'Strength',
    description: 'Build strength and improve physical performance.',
  },
  {
    id: 'improve_endurance',
    title: 'Endurance',
    description: 'Improve stamina and cardiovascular endurance.',
  },
  {
    id: 'improve_fitness',
    title: 'General fitness',
    description: 'Improve your overall health and fitness.',
  },
  {
    id: 'improve_flexibility',
    title: 'Flexibility',
    description: 'Improve mobility, movement and flexibility.',
  },
];

const additionalGoalOptions: {
  id: GymGoerFitnessGoal;
  title: string;
}[] = [
  { id: 'build_muscle', title: 'Build muscle' },
  { id: 'lose_weight', title: 'Lose weight' },
  { id: 'improve_fitness', title: 'Improve fitness' },
  { id: 'increase_strength', title: 'Increase strength' },
  { id: 'improve_endurance', title: 'Improve endurance' },
  { id: 'improve_health', title: 'Improve general health' },
  { id: 'improve_flexibility', title: 'Improve flexibility' },
  { id: 'sports_performance', title: 'Sports performance' },
];

const experienceOptions = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'New to structured fitness training.',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: 'Have some consistent training experience.',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Experienced with structured training programmes.',
  },
] as const;

const trainingPreferenceOptions: {
  id: GymGoerTrainingPreference;
  title: string;
}[] = [
  { id: 'strength', title: 'Strength' },
  { id: 'cardio', title: 'Cardio' },
  { id: 'hiit', title: 'HIIT' },
  { id: 'functional_training', title: 'Functional training' },
  { id: 'flexibility', title: 'Flexibility' },
];

const trainingFormatOptions: {
  id: GymGoerTrainingFormat;
  title: string;
  description: string;
}[] = [
  {
    id: 'online',
    title: 'Online',
    description: 'Train remotely with your trainer.',
  },
  {
    id: 'in_person',
    title: 'In-person',
    description: 'Meet your trainer at an agreed location.',
  },
  {
    id: 'both',
    title: 'Both',
    description: 'I am open to online and in-person training.',
  },
];

const frequencyOptions = [1, 2, 3, 4, 5, 6, 7] as const;

const defaultValues: GymGoerFitnessGoalsFormValues = {
  primaryGoal: 'improve_fitness',
  additionalGoals: [],
  experienceLevel: 'beginner',
  trainingPreferences: [],
  trainingFormat: 'online',
  trainingFrequency: 3,
  location: '',
};

export default function GymGoerFitnessGoalsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const { fitnessGoalsQuery, saveMutation } = useGymGoerFitnessGoals(user?.id);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<GymGoerFitnessGoalsFormValues>({
    resolver: zodResolver(gymGoerFitnessGoalsSchema),
    defaultValues,
  });

  const values = useWatch({ control });

  const primaryGoal = values.primaryGoal ?? defaultValues.primaryGoal;
  const additionalGoals = values.additionalGoals ?? [];
  const experienceLevel = values.experienceLevel ?? defaultValues.experienceLevel;
  const trainingPreferences = values.trainingPreferences ?? [];
  const trainingFormat = values.trainingFormat ?? defaultValues.trainingFormat;
  const trainingFrequency = values.trainingFrequency ?? defaultValues.trainingFrequency;
  const location = values.location ?? '';

  // Populate the form from the authenticated user's saved profile.
  useEffect(() => {
    const data = fitnessGoalsQuery.data;

    if (!data) return;

    const savedPrimaryGoal =
      data.profile?.primary_goal ??
      data.goals.find((goal): goal is GymGoerPrimaryGoal =>
        primaryGoalOptions.some((option) => option.id === goal),
      ) ??
      defaultValues.primaryGoal;

    const savedAdditionalGoals = data.goals.filter((goal) => goal !== savedPrimaryGoal);

    reset({
      primaryGoal: savedPrimaryGoal,
      additionalGoals: savedAdditionalGoals,
      experienceLevel: data.profile?.experience_level ?? defaultValues.experienceLevel,
      trainingPreferences: data.profile?.training_preferences ?? [],
      trainingFormat: data.profile?.training_format ?? defaultValues.trainingFormat,
      trainingFrequency:
        data.profile?.training_frequency ?? defaultValues.trainingFrequency,
      location: data.profile?.location ?? '',
    });
  }, [fitnessGoalsQuery.data, reset]);

  // Clear feedback whenever the user changes a preference.
  function clearFeedback() {
    setSaveError(null);
    setSuccessMessage(null);
  }

  // Explicitly typed form updates avoid generic setValue type conflicts.
  function updatePrimaryGoal(value: GymGoerPrimaryGoal) {
    setValue('primaryGoal', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateAdditionalGoals(value: GymGoerFitnessGoal[]) {
    setValue('additionalGoals', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateExperienceLevel(
    value: GymGoerFitnessGoalsFormValues['experienceLevel'],
  ) {
    setValue('experienceLevel', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateTrainingPreferences(value: GymGoerTrainingPreference[]) {
    setValue('trainingPreferences', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateTrainingFormat(value: GymGoerTrainingFormat) {
    setValue('trainingFormat', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateTrainingFrequency(value: number) {
    setValue('trainingFrequency', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function updateLocation(value: string) {
    setValue('location', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    clearFeedback();
  }

  function selectPrimaryGoal(goal: GymGoerPrimaryGoal) {
    if (goal === primaryGoal) return;

    const nextAdditionalGoals = [
      ...new Set([...additionalGoals.filter((item) => item !== goal), primaryGoal]),
    ];

    updatePrimaryGoal(goal);
    updateAdditionalGoals(nextAdditionalGoals);
  }

  function toggleAdditionalGoal(goal: GymGoerFitnessGoal) {
    if (goal === primaryGoal) return;

    const nextGoals = additionalGoals.includes(goal)
      ? additionalGoals.filter((item) => item !== goal)
      : [...additionalGoals, goal];

    updateAdditionalGoals(nextGoals);
  }

  function toggleTrainingPreference(preference: GymGoerTrainingPreference) {
    const nextPreferences = trainingPreferences.includes(preference)
      ? trainingPreferences.filter((item) => item !== preference)
      : [...trainingPreferences, preference];

    updateTrainingPreferences(nextPreferences);
  }

  async function onSubmit(formValues: GymGoerFitnessGoalsFormValues) {
    if (!user || saveMutation.isPending) return;

    setSaveError(null);
    setSuccessMessage(null);

    try {
      await saveMutation.mutateAsync(formValues);

      reset(formValues);
      setSuccessMessage('Your fitness goals and preferences have been saved.');
    } catch (error) {
      console.error('[Gym-Goer Profile] Failed to save fitness preferences:', error);

      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save your preferences. Please try again.',
      );
    }
  }

  function renderSectionHeading(title: string, description: string) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h3" color={colors.text.primary}>
          {title}
        </AppText>

        <AppText variant="bodySmall" color={colors.text.secondary}>
          {description}
        </AppText>
      </View>
    );
  }

  function renderSelectionCard(
    title: string,
    description: string | undefined,
    selected: boolean,
    onPress: () => void,
    accessibilityRole: 'radio' | 'checkbox' = 'checkbox',
  ) {
    return (
      <Pressable
        key={title}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={title}
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 54,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText
            variant="body"
            color={selected ? colors.brand.red : colors.text.primary}
          >
            {title}
          </AppText>

          {description ? (
            <AppText variant="bodySmall" color={colors.text.secondary}>
              {description}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: accessibilityRole === 'radio' ? 11 : 6,
            borderWidth: 1.5,
            borderColor: selected ? colors.brand.red : colors.border.default,
            backgroundColor: selected ? colors.brand.red : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <AppText variant="caption" color="#FFFFFF">
              ✓
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const isLoading = fitnessGoalsQuery.isLoading;
  const isSaving = saveMutation.isPending;
  const isInPerson = trainingFormat === 'in_person' || trainingFormat === 'both';

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
          padding: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to profile"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', paddingVertical: spacing.sm }}
        >
          <AppText variant="body" color={colors.text.secondary}>
            ← Back to profile
          </AppText>
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            YOUR PROFILE
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Fitness goals
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Personalise your fitness journey by telling us what you want to achieve and
            how you prefer to train.
          </AppText>
        </View>

        {!user ? (
          <AppText variant="body" color={colors.text.error}>
            Your session could not be found. Please sign in again.
          </AppText>
        ) : isLoading ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.xxl,
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading your fitness preferences...
            </AppText>
          </View>
        ) : fitnessGoalsQuery.isError ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.text.error}>
              Unable to load your fitness preferences. Please try again.
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => fitnessGoalsQuery.refetch()}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="buttonLarge" color="#FFFFFF">
                RETRY
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Primary fitness goal */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Primary fitness goal',
                'Choose the main result you want to work towards.',
              )}

              {primaryGoalOptions.map((goal) =>
                renderSelectionCard(
                  goal.title,
                  goal.description,
                  primaryGoal === goal.id,
                  () => selectPrimaryGoal(goal.id),
                  'radio',
                ),
              )}
            </View>

            {/* Additional goals */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Additional goals',
                'Select any other goals you would like your training to support.',
              )}

              {additionalGoalOptions
                .filter((goal) => goal.id !== primaryGoal)
                .map((goal) =>
                  renderSelectionCard(
                    goal.title,
                    undefined,
                    additionalGoals.includes(goal.id),
                    () => toggleAdditionalGoal(goal.id),
                  ),
                )}

              <AppText variant="caption" color={colors.text.secondary}>
                Your primary goal is automatically included in your saved goals.
              </AppText>
            </View>

            {/* Fitness experience */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Fitness experience',
                'Choose the level that best describes your current experience.',
              )}

              {experienceOptions.map((option) =>
                renderSelectionCard(
                  option.title,
                  option.description,
                  experienceLevel === option.id,
                  () => updateExperienceLevel(option.id),
                  'radio',
                ),
              )}
            </View>

            {/* Training preferences */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Training preferences',
                'Select the types of training you enjoy or want to explore.',
              )}

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                }}
              >
                {trainingPreferenceOptions.map((option) => {
                  const selected = trainingPreferences.includes(option.id);

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={option.title}
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleTrainingPreference(option.id)}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        minHeight: 44,
                        justifyContent: 'center',
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: selected ? colors.brand.red : colors.border.default,
                        backgroundColor: selected
                          ? colors.background.secondary
                          : colors.background.primary,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <AppText
                        variant="bodySmall"
                        color={selected ? colors.brand.red : colors.text.primary}
                      >
                        {option.title}
                        {selected ? '  ✓' : ''}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              {errors.trainingPreferences?.message ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.trainingPreferences.message}
                </AppText>
              ) : null}
            </View>

            {/* Preferred training format */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Preferred training format',
                'How would you prefer to work with your trainer?',
              )}

              {trainingFormatOptions.map((option) =>
                renderSelectionCard(
                  option.title,
                  option.description,
                  trainingFormat === option.id,
                  () => updateTrainingFormat(option.id),
                  'radio',
                ),
              )}
            </View>

            {/* Training frequency */}
            <View style={{ gap: spacing.md }}>
              {renderSectionHeading(
                'Training frequency',
                'How many days per week would you ideally like to train?',
              )}

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}
              >
                {frequencyOptions.map((day) => {
                  const selected = trainingFrequency === day;

                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="radio"
                      accessibilityLabel={`${day} ${day === 1 ? 'day' : 'days'} per week`}
                      accessibilityState={{ checked: selected }}
                      onPress={() => updateTrainingFrequency(day)}
                      style={({ pressed }) => ({
                        width: '12%',
                        minWidth: 38,
                        minHeight: 46,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? colors.brand.red : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.red
                          : colors.background.primary,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <AppText
                        variant="body"
                        color={selected ? '#FFFFFF' : colors.text.primary}
                      >
                        {day}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <AppText variant="caption" color={colors.text.secondary}>
                {trainingFrequency} {trainingFrequency === 1 ? 'day' : 'days'} per week
              </AppText>
            </View>

            {/* Preferred location */}
            {isInPerson ? (
              <View style={{ gap: spacing.sm }}>
                {renderSectionHeading(
                  'Preferred location',
                  'Enter your city or area for in-person training.',
                )}

                <TextInput
                  accessibilityLabel="Preferred training location"
                  value={location}
                  onChangeText={updateLocation}
                  placeholder="Enter your city or area"
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={150}
                  autoCapitalize="words"
                  style={{
                    minHeight: 52,
                    paddingHorizontal: spacing.md,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: errors.location
                      ? colors.text.error
                      : colors.border.default,
                    backgroundColor: colors.background.secondary,
                    color: colors.text.primary,
                    fontSize: 16,
                  }}
                />

                {errors.location?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.location.message}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {/* Feedback */}
            {saveError ? (
              <AppText
                variant="bodySmall"
                color={colors.text.error}
                accessibilityRole="alert"
              >
                {saveError}
              </AppText>
            ) : null}

            {successMessage ? (
              <AppText
                variant="bodySmall"
                color={colors.brand.red}
                accessibilityRole="alert"
              >
                {successMessage}
              </AppText>
            ) : null}

            {/* Save */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save fitness goals and preferences"
              accessibilityState={{
                disabled: !isDirty || isSaving,
                busy: isSaving,
              }}
              disabled={!isDirty || isSaving}
              onPress={handleSubmit(onSubmit)}
              style={({ pressed }) => ({
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: colors.brand.red,
                opacity: !isDirty || isSaving ? 0.45 : pressed ? 0.8 : 1,
              })}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <AppText variant="buttonLarge" color="#FFFFFF">
                  SAVE CHANGES
                </AppText>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
