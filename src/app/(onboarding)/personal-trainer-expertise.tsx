import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerExpertiseSchema,
  type TrainerExpertiseFormValues,
} from '@/schemas/trainer-expertise';
import { useTrainrTheme } from '@/theme';

const specialityOptions = [
  'Strength training',
  'Weight loss',
  'Muscle building',
  'General fitness',
  'Functional training',
  'Sports performance',
  'Mobility and flexibility',
  'Nutrition coaching',
] as const;

export default function PersonalTrainerExpertiseScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TrainerExpertiseFormValues>({
    resolver: zodResolver(trainerExpertiseSchema),
    defaultValues: {
      specialities: [],
      qualifications: '',
      certifications: '',
      yearsExperience: '',
    },
  });

  const selectedSpecialities = useWatch({
    control,
    name: 'specialities',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id;

    if (!userId) return;

    let isMounted = true;

    async function loadExistingDetails() {
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select('specialities, qualifications, certifications, years_experience')
        .eq('user_id', userId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('[Trainer Expertise] Failed to load saved details:', error);
        setErrorMessage('Unable to load your saved expertise details. Please try again.');
        return;
      }

      if (!data) return;

      reset({
        specialities: data.specialities ?? [],
        qualifications: (data.qualifications ?? []).join(', '),
        certifications: (data.certifications ?? []).join(', '),
        yearsExperience:
          data.years_experience === null || data.years_experience === undefined
            ? ''
            : String(data.years_experience),
      });
    }

    void loadExistingDetails();

    return () => {
      isMounted = false;
    };
  }, [user?.id, reset]);

  function toggleSpeciality(speciality: string) {
    if (isSaving) return;

    const nextSpecialities = selectedSpecialities.includes(speciality)
      ? selectedSpecialities.filter((item) => item !== speciality)
      : [...selectedSpecialities, speciality];

    setValue('specialities', nextSpecialities, {
      shouldDirty: true,
      shouldValidate: true,
    });

    setErrorMessage(null);
  }

  function parseList(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleContinue(values: TrainerExpertiseFormValues) {
    if (isSaving) return;

    if (!user?.id) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const normalizedQualifications = parseList(values.qualifications);
      const normalizedCertifications = parseList(values.certifications);
      const experience = Number(values.yearsExperience);

      const { error } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: user.id,
          specialities: values.specialities,
          qualifications: normalizedQualifications,
          certifications: normalizedCertifications,
          years_experience: experience,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        throw error;
      }

      router.push('/(onboarding)/personal-trainer-pricing');
    } catch (error) {
      console.error('[Trainer Expertise] Failed to save details:', error);
      setErrorMessage('Unable to save your expertise details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function renderField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      multiline?: boolean;
      numeric?: boolean;
    },
  ) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
        </AppText>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          multiline={options?.multiline}
          keyboardType={options?.numeric ? 'numeric' : 'default'}
          editable={!isSaving}
          textAlignVertical={options?.multiline ? 'top' : 'center'}
          style={{
            minHeight: options?.multiline ? 100 : 54,
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
          }}
        />
      </View>
    );
  }

  function renderSpeciality(speciality: string) {
    const selected = selectedSpecialities.includes(speciality);

    return (
      <Pressable
        key={speciality}
        accessibilityRole="checkbox"
        accessibilityLabel={speciality}
        accessibilityState={{
          checked: selected,
          disabled: isSaving,
        }}
        disabled={isSaving}
        onPress={() => toggleSpeciality(speciality)}
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
          {speciality}
        </AppText>
      </Pressable>
    );
  }

  function renderValidationError(message?: string) {
    if (!message) return null;

    return (
      <AppText variant="bodySmall" color={colors.text.error} accessibilityRole="alert">
        {message}
      </AppText>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            PERSONAL TRAINER SETUP · STEP 3 OF 5
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Showcase your expertise.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Help gym-goers understand your specialities, professional qualifications and
            training experience.
          </AppText>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Specialities
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select every area in which you specialise.
            </AppText>

            {specialityOptions.map(renderSpeciality)}

            {renderValidationError(errors.specialities?.message)}
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Qualifications
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Enter your relevant education and professional qualifications, separated by
              commas.
            </AppText>

            <Controller
              control={control}
              name="qualifications"
              render={({ field }) =>
                renderField(
                  'Your qualifications',
                  field.value,
                  field.onChange,
                  'e.g. Sports Science Diploma, Personal Training Level 3',
                  { multiline: true },
                )
              }
            />

            {renderValidationError(errors.qualifications?.message)}
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Certifications
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              List relevant training certifications, separated by commas.
            </AppText>

            <Controller
              control={control}
              name="certifications"
              render={({ field }) =>
                renderField(
                  'Your certifications',
                  field.value,
                  field.onChange,
                  'e.g. CPR, First Aid, Strength and Conditioning',
                  { multiline: true },
                )
              }
            />

            {renderValidationError(errors.certifications?.message)}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Controller
              control={control}
              name="yearsExperience"
              render={({ field }) =>
                renderField(
                  'Years of experience',
                  field.value,
                  field.onChange,
                  'e.g. 3',
                  { numeric: true },
                )
              }
            />

            {renderValidationError(errors.yearsExperience?.message)}
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
            onPress={handleSubmit(handleContinue)}
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
              {isSaving ? 'SAVING…' : 'SAVE & CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
