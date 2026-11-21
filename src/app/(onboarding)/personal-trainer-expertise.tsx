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
import {
  createTrainerQualification,
  getTrainerQualifications,
} from '@/services/trainer-qualifications';
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

const INITIAL_VALUES: TrainerExpertiseFormValues = {
  specialities: [],
  qualifications: '',
  certifications: '',
  yearsExperience: '',
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function parseList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

// --------------------------------------------------
// Screen
// --------------------------------------------------

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
    defaultValues: INITIAL_VALUES,
  });

  const selectedSpecialities = useWatch({
    control,
    name: 'specialities',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load existing trainer expertise
  // --------------------------------------------------

  useEffect(() => {
    const trainerId: string = user?.id ?? '';

    if (trainerId.length === 0) return;
    // Do not update state synchronously inside the effect.
    // The screen handles a missing user separately.
    if (!trainerId) return;

    let isMounted = true;

    async function loadExistingDetails() {
      try {
        const [{ data: profile, error: profileError }, qualificationRecords] =
          await Promise.all([
            supabase
              .from('trainer_profiles')
              .select('specialities, qualifications, certifications, years_experience')
              .eq('user_id', trainerId)
              .maybeSingle(),

            getTrainerQualifications(trainerId),
          ]);

        if (profileError) {
          throw profileError;
        }

        if (!isMounted) return;

        // Structured records take priority.
        // Legacy arrays are used as a fallback for older profiles.
        const structuredQualifications = qualificationRecords
          .filter((record) => record.category === 'qualification')
          .map((record) => record.qualification_name);

        const structuredCertifications = qualificationRecords
          .filter((record) => record.category === 'certification')
          .map((record) => record.qualification_name);

        const qualifications =
          structuredQualifications.length > 0
            ? structuredQualifications
            : (profile?.qualifications ?? []);

        const certifications =
          structuredCertifications.length > 0
            ? structuredCertifications
            : (profile?.certifications ?? []);

        reset({
          specialities: profile?.specialities ?? [],
          qualifications: qualifications.join(', '),
          certifications: certifications.join(', '),
          yearsExperience:
            profile?.years_experience === null || profile?.years_experience === undefined
              ? ''
              : String(profile.years_experience),
        });
      } catch (error) {
        console.error('[Trainer Expertise] Failed to load saved details:', error);

        if (isMounted) {
          setErrorMessage(
            'Unable to load your saved expertise details. Please try again.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadExistingDetails();

    return () => {
      isMounted = false;
    };
  }, [user?.id, reset]);

  // --------------------------------------------------
  // Specialities
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Save structured qualifications and trainer profile
  // --------------------------------------------------

  async function handleContinue(values: TrainerExpertiseFormValues) {
    if (isSaving) return;

    const trainerId = user?.id;

    if (!trainerId) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const normalizedQualifications = parseList(values.qualifications);
      const normalizedCertifications = parseList(values.certifications);
      const experience = Number(values.yearsExperience);

      // Retrieve existing structured records to prevent duplicates.
      const existingRecords = await getTrainerQualifications(trainerId);

      const existingQualificationNames = new Set(
        existingRecords
          .filter((record) => record.category === 'qualification')
          .map((record) => normalizeName(record.qualification_name)),
      );

      const existingCertificationNames = new Set(
        existingRecords
          .filter((record) => record.category === 'certification')
          .map((record) => normalizeName(record.qualification_name)),
      );

      // Save the trainer's specialities and experience.
      // Qualifications and certifications are maintained separately
      // in trainer_qualifications.
      const { error: profileError } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: trainerId,
          specialities: values.specialities,
          years_experience: experience,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (profileError) {
        throw profileError;
      }

      // Add qualifications that do not already exist.
      for (const qualificationName of normalizedQualifications) {
        const normalizedName = normalizeName(qualificationName);

        if (existingQualificationNames.has(normalizedName)) {
          continue;
        }

        await createTrainerQualification(trainerId, {
          category: 'qualification',
          qualificationName,
          issuingOrganisation: '',
          dateObtained: '',
          expiryDate: '',
        });

        existingQualificationNames.add(normalizedName);
      }

      // Add certifications that do not already exist.
      for (const certificationName of normalizedCertifications) {
        const normalizedName = normalizeName(certificationName);

        if (existingCertificationNames.has(normalizedName)) {
          continue;
        }

        await createTrainerQualification(trainerId, {
          category: 'certification',
          qualificationName: certificationName,
          issuingOrganisation: '',
          dateObtained: '',
          expiryDate: '',
        });

        existingCertificationNames.add(normalizedName);
      }

      router.push('/(onboarding)/personal-trainer-pricing');
    } catch (error) {
      console.error('[Trainer Expertise] Failed to save details:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your expertise details. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // --------------------------------------------------
  // Form fields
  // --------------------------------------------------

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
          onChangeText={(text) => {
            onChangeText(text);
            setErrorMessage(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          multiline={options?.multiline}
          keyboardType={options?.numeric ? 'numeric' : 'default'}
          editable={!isSaving && !isLoading}
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

  // --------------------------------------------------
  // Speciality selection
  // --------------------------------------------------

  function renderSpeciality(speciality: string) {
    const selected = selectedSpecialities.includes(speciality);

    return (
      <Pressable
        key={speciality}
        accessibilityRole="checkbox"
        accessibilityLabel={speciality}
        accessibilityState={{
          checked: selected,
          disabled: isSaving || isLoading,
        }}
        disabled={isSaving || isLoading}
        onPress={() => toggleSpeciality(speciality)}
        style={({ pressed }) => ({
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
          opacity: isSaving || isLoading ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText variant="body" color={selected ? colors.brand.red : colors.text.primary}>
          {selected ? '✓  ' : ''}
          {speciality}
        </AppText>
      </Pressable>
    );
  }

  // --------------------------------------------------
  // Validation errors
  // --------------------------------------------------

  function renderValidationError(message?: string) {
    if (!message) return null;

    return (
      <AppText variant="bodySmall" color={colors.text.error} accessibilityRole="alert">
        {message}
      </AppText>
    );
  }

  // --------------------------------------------------
  // Screen
  // --------------------------------------------------

  const isSessionMissing = !user?.id;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
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

          {isSessionMissing ? (
            <AppText
              variant="bodySmall"
              color={colors.text.error}
              accessibilityRole="alert"
            >
              Your session has expired. Please sign in again.
            </AppText>
          ) : isLoading ? (
            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading your saved expertise...
            </AppText>
          ) : (
            <>
              {/* Specialities */}
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

              {/* Qualifications */}
              <View style={{ gap: spacing.sm }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Qualifications
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Enter your relevant education and professional qualifications, separated
                  by commas.
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

              {/* Certifications */}
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

              {/* Experience */}
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

              <AppText variant="caption" color={colors.text.tertiary}>
                Your qualifications and certifications are saved as individual records.
                You can add issuing organisations, dates and certificates later under More
                → Qualifications. Existing records are retained when you revisit
                onboarding.
              </AppText>
            </>
          )}

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
              disabled: isSaving || isLoading || isSessionMissing,
              busy: isSaving,
            }}
            disabled={isSaving || isLoading || isSessionMissing}
            onPress={handleSubmit(handleContinue)}
            style={({ pressed }) => ({
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity:
                isSaving || isLoading || isSessionMissing ? 0.6 : pressed ? 0.8 : 1,
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
