import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerProfileSchema,
  type TrainerProfileFormValues,
} from '@/schemas/trainer-profile';
import {
  getTrainerProfessionalProfile,
  updateTrainerProfessionalProfile,
} from '@/services/trainer-profile';
import { useTrainrTheme } from '@/theme';

export default function TrainerProfessionalBioScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TrainerProfileFormValues>({
    resolver: zodResolver(trainerProfileSchema),
    defaultValues: {
      professionalBio: '',
      coachingApproach: '',
      location: '',
      yearsExperience: '',
    },
  });

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      if (!user?.id) {
        setErrorMessage('Your session has expired. Please sign in again.');
        setIsLoading(false);
        return;
      }

      try {
        const data = await getTrainerProfessionalProfile(user.id);

        if (!isActive) return;

        reset({
          professionalBio: data?.professional_bio ?? '',
          coachingApproach: data?.coaching_approach ?? '',
          location: data?.location ?? '',
          yearsExperience:
            data?.years_experience == null ? '' : String(data.years_experience),
        });
      } catch (error) {
        console.error('[Trainer Professional Bio] Failed to load profile:', error);

        if (isActive) {
          setErrorMessage('Unable to load your professional profile. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [user?.id, reset]);

  function handleFieldChange() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSave(values: TrainerProfileFormValues) {
    if (!user?.id || isSaving) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateTrainerProfessionalProfile(user.id, {
        professional_bio: values.professionalBio.trim(),
        coaching_approach: values.coachingApproach.trim(),
        location: values.location.trim(),
        years_experience:
          values.yearsExperience.trim() === '' ? null : Number(values.yearsExperience),
      });

      reset({
        professionalBio: values.professionalBio.trim(),
        coachingApproach: values.coachingApproach.trim(),
        location: values.location.trim(),
        yearsExperience: values.yearsExperience.trim(),
      });

      setSuccessMessage('Your professional profile has been updated.');
    } catch (error) {
      console.error('[Trainer Professional Bio] Failed to save profile:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your professional profile. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (isSaving) return;

    router.back();
  }

  function renderTextField(
    name: keyof TrainerProfileFormValues,
    label: string,
    placeholder: string,
    options?: {
      multiline?: boolean;
      numeric?: boolean;
      maxLength?: number;
    },
  ) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="body" color={colors.text.primary}>
              {label}
            </AppText>

            <TextInput
              value={value}
              onChangeText={(text) => {
                onChange(text);
                handleFieldChange();
              }}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.text.tertiary}
              multiline={options?.multiline}
              keyboardType={options?.numeric ? 'number-pad' : 'default'}
              autoCapitalize={options?.numeric ? 'none' : 'sentences'}
              editable={!isLoading && !isSaving}
              maxLength={options?.maxLength}
              textAlignVertical={options?.multiline ? 'top' : 'center'}
              accessibilityLabel={label}
              style={{
                minHeight: options?.multiline ? 130 : 54,
                borderWidth: 1,
                borderColor: errors[name] ? colors.text.error : colors.border.default,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                color: colors.text.primary,
                backgroundColor: colors.background.secondary,
              }}
            />

            {errors[name]?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {errors[name]?.message}
              </AppText>
            ) : null}

            {options?.maxLength && options.multiline ? (
              <AppText variant="caption" color={colors.text.tertiary}>
                {value.length}/{options.maxLength} characters
              </AppText>
            ) : null}
          </View>
        )}
      />
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            padding: spacing.lg,
            paddingBottom: spacing.xxl,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={isSaving}
            onPress={handleCancel}
            style={{ alignSelf: 'flex-start', paddingVertical: spacing.xs }}
          >
            <AppText variant="button" color={colors.brand.red}>
              BACK
            </AppText>
          </Pressable>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="caption" color={colors.brand.red}>
              TRAINER PROFILE
            </AppText>

            <AppText variant="h1" color={colors.text.primary}>
              Professional bio.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Tell potential clients about your experience, where you are based and how
              you approach coaching.
            </AppText>
          </View>

          {isLoading ? (
            <View
              style={{
                minHeight: 220,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.md,
              }}
            >
              <ActivityIndicator color={colors.brand.red} />

              <AppText variant="body" color={colors.text.secondary}>
                Loading your professional profile...
              </AppText>
            </View>
          ) : (
            <>
              {renderTextField(
                'professionalBio',
                'Professional bio',
                'Tell gym-goers about your experience and what makes you different.',
                { multiline: true, maxLength: 1000 },
              )}

              {renderTextField(
                'coachingApproach',
                'Coaching approach',
                'Describe how you motivate, guide and support your clients.',
                { multiline: true, maxLength: 1000 },
              )}

              {renderTextField('location', 'Location', 'Enter your city or area.', {
                maxLength: 150,
              })}

              {renderTextField(
                'yearsExperience',
                'Years of experience',
                'Enter the number of years',
                { numeric: true },
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

              {successMessage ? (
                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                  accessibilityRole="alert"
                >
                  {successMessage}
                </AppText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save professional profile"
                accessibilityState={{
                  disabled: isSaving || !isDirty,
                  busy: isSaving,
                }}
                disabled={isSaving || !isDirty}
                onPress={handleSubmit(handleSave)}
                style={({ pressed }) => ({
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: colors.brand.red,
                  opacity: isSaving || !isDirty ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppText variant="button" color="#FFFFFF">
                    SAVE CHANGES
                  </AppText>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
                disabled={isSaving}
                onPress={handleCancel}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="button" color={colors.text.secondary}>
                  CANCEL
                </AppText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
