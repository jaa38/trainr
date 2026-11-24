import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerProfileSchema,
  type TrainerProfileFormValues,
} from '@/schemas/trainer-profile';
import {
  getTrainerProfessionalProfile,
  getTrainerTrainingFormat,
  toTrainerTrainingFormats,
  updateTrainerProfessionalProfile,
  type TrainerTrainingFormat,
} from '@/services/trainer-profile';
import { useTrainrTheme } from '@/theme';

const TRAINING_FORMATS: TrainerTrainingFormat[] = ['Online', 'In-person', 'Both'];

export default function TrainerProfessionalBioScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reserve space for the floating NativeTabs bar and bottom safe area.
  const bottomContentPadding = spacing.xxxl + insets.bottom + 100;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TrainerProfileFormValues>({
    resolver: zodResolver(trainerProfileSchema),
    defaultValues: {
      professionalTitle: '',
      professionalBio: '',
      coachingApproach: '',
      location: '',
      yearsExperience: '',
      trainingFormat: '',
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
          professionalTitle: data?.professional_title ?? '',
          professionalBio: data?.professional_bio ?? '',
          coachingApproach: data?.coaching_approach ?? '',
          location: data?.location ?? '',
          yearsExperience:
            data?.years_experience == null ? '' : String(data.years_experience),
          trainingFormat: getTrainerTrainingFormat(data?.training_formats),
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
    if (isSaving) return;

    if (!user?.id) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedValues = {
        professionalTitle: values.professionalTitle.trim(),
        professionalBio: values.professionalBio.trim(),
        coachingApproach: values.coachingApproach.trim(),
        location: values.location.trim(),
        yearsExperience: values.yearsExperience.trim(),
        trainingFormat: values.trainingFormat,
      };

      await updateTrainerProfessionalProfile(user.id, {
        professional_title: savedValues.professionalTitle,
        professional_bio: savedValues.professionalBio,
        coaching_approach: savedValues.coachingApproach,
        location: savedValues.location,
        years_experience:
          savedValues.yearsExperience === '' ? null : Number(savedValues.yearsExperience),
        training_formats: toTrainerTrainingFormats(savedValues.trainingFormat),
      });

      reset(savedValues);

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

  function renderTrainingFormatSelector() {
    return (
      <Controller
        control={control}
        name="trainingFormat"
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="body" color={colors.text.primary}>
              Training format
            </AppText>

            <AppText variant="caption" color={colors.text.secondary}>
              Choose how you offer training sessions.
            </AppText>

            <View style={{ gap: spacing.sm }}>
              {TRAINING_FORMATS.map((format) => {
                const selected = value === format;

                return (
                  <Pressable
                    key={format}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                      disabled: isLoading || isSaving,
                    }}
                    accessibilityLabel={format}
                    disabled={isLoading || isSaving}
                    onPress={() => {
                      onChange(format);
                      handleFieldChange();
                    }}
                    style={({ pressed }) => ({
                      minHeight: 54,
                      paddingHorizontal: spacing.md,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand.red : colors.border.default,
                      backgroundColor: selected
                        ? colors.brand.redLight
                        : colors.background.secondary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                    })}
                  >
                    <AppText
                      variant="body"
                      color={selected ? colors.brand.red : colors.text.primary}
                    >
                      {format}
                    </AppText>

                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: selected ? colors.brand.red : colors.border.default,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected ? (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.brand.red,
                          }}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {errors.trainingFormat?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {errors.trainingFormat.message}
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
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.md,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={isSaving}
            onPress={handleCancel}
            style={{
              width: 42,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border.default,
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>

          <AppText variant="h2" color={colors.text.primary}>
            Professional Bio
          </AppText>
        </View>

        {/* Content */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: bottomContentPadding,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Introduction */}
          <View style={{ gap: spacing.sm }}>
            <AppText variant="caption" color={colors.brand.red}>
              PROFESSIONAL PROFILE
            </AppText>

            <AppText variant="h1" color={colors.text.primary}>
              Tell your story.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Tell potential clients about your experience, where you are based and how
              you approach coaching.
            </AppText>
          </View>

          {/* Loading State */}
          {isLoading ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.xxl,
                gap: spacing.md,
              }}
            >
              <ActivityIndicator color={colors.brand.red} />

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Loading your professional profile...
              </AppText>
            </View>
          ) : (
            <>
              {/* Professional Information */}
              {renderTextField(
                'professionalTitle',
                'Professional title',
                'e.g. Certified Personal Trainer',
                { maxLength: 120 },
              )}

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

              {/* Training Format */}
              {renderTrainingFormatSelector()}

              {/* Location */}
              {renderTextField('location', 'Location', 'Enter your city or area.', {
                maxLength: 150,
              })}

              {/* Experience */}
              {renderTextField(
                'yearsExperience',
                'Years of experience',
                'Enter the number of years',
                { numeric: true },
              )}

              {/* Error Message */}
              {errorMessage ? (
                <View
                  accessibilityRole="alert"
                  style={{
                    padding: spacing.md,
                    borderRadius: 12,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errorMessage}
                  </AppText>
                </View>
              ) : null}

              {/* Success Message */}
              {successMessage ? (
                <View
                  accessibilityRole="alert"
                  style={{
                    padding: spacing.md,
                    borderRadius: 12,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <AppText variant="bodySmall" color={colors.brand.red}>
                    {successMessage}
                  </AppText>
                </View>
              ) : null}

              {/* Save Button */}
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
                  borderRadius: 14,
                  backgroundColor: colors.brand.red,
                  opacity: isSaving || !isDirty ? 0.6 : pressed ? 0.8 : 1,
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

              {/* Cancel Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
                disabled={isSaving}
                onPress={handleCancel}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSaving ? 0.5 : 1,
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
