import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
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
  trainerDetailsSchema,
  type TrainerDetailsFormValues,
} from '@/schemas/trainer-onboarding';
import { getProfileImageUrl, pickAndUploadProfileImage } from '@/services/profile-images';
import { useTrainrTheme } from '@/theme';

export default function PersonalTrainerDetailsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, profile } = useAuth();

  const resolvedFirstName = profile?.first_name ?? '';
  const resolvedLastName = profile?.last_name ?? '';

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrainerDetailsFormValues>({
    resolver: zodResolver(trainerDetailsSchema),
    defaultValues: {
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      professionalBio: '',
      location: '',
      coachingApproach: '',
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [avatarPath, setAvatarPath] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Load previously saved trainer details.
  useEffect(() => {
    const userId = user?.id;

    if (!userId) return;

    let isActive = true;

    async function loadTrainerDetails() {
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select('professional_bio, location, coaching_approach')
        .eq('user_id', userId)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error('[Trainer Onboarding] Failed to load saved details:', error);
        setErrorMessage('Unable to load your saved trainer details. Please try again.');
        return;
      }

      const savedValues: TrainerDetailsFormValues = {
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        professionalBio: data?.professional_bio ?? '',
        location: data?.location ?? '',
        coachingApproach: data?.coaching_approach ?? '',
      };

      console.log('[Trainer Onboarding] Resetting form with:', savedValues);

      reset(savedValues);
    }

    void loadTrainerDetails();

    return () => {
      isActive = false;
    };
  }, [user?.id, profile?.first_name, profile?.last_name, reset]);

  // Resolve the private profile image URL.
  useEffect(() => {
    let isActive = true;

    async function loadAvatar() {
      try {
        const url = await getProfileImageUrl(avatarPath);

        if (isActive) {
          setAvatarUrl(url);
        }
      } catch (error) {
        console.error('[Trainer Onboarding] Failed to load profile photo:', error);

        if (isActive) {
          setAvatarUrl(null);
        }
      }
    }

    void loadAvatar();

    return () => {
      isActive = false;
    };
  }, [avatarPath]);

  async function handleChoosePhoto() {
    if (!user || isUploadingPhoto || isSaving) return;

    setIsUploadingPhoto(true);
    setErrorMessage(null);

    try {
      const path = await pickAndUploadProfileImage(user.id);

      if (path) {
        setAvatarPath(path);
      }
    } catch (error) {
      console.error('[Trainer Onboarding] Photo upload failed:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to upload your profile photo. Please try again.',
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleContinue(values: TrainerDetailsFormValues) {
    if (!user || isSaving) return;

    const normalizedFirstName = values.firstName.trim();
    const normalizedLastName = values.lastName.trim();
    const normalizedBio = values.professionalBio.trim();
    const normalizedLocation = values.location.trim();
    const normalizedCoachingApproach = values.coachingApproach.trim();

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          updated_at: now,
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      const { error: trainerProfileError } = await supabase
        .from('trainer_profiles')
        .upsert(
          {
            user_id: user.id,
            professional_bio: normalizedBio,
            location: normalizedLocation,
            coaching_approach: normalizedCoachingApproach,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        );

      if (trainerProfileError) {
        throw trainerProfileError;
      }

      console.log('[Trainer Onboarding] Professional profile draft saved');

      router.push('/(onboarding)/personal-trainer-expertise');
    } catch (error) {
      console.error('[Trainer Onboarding] Failed to save professional profile:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your professional profile. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
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
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL TRAINER SETUP · STEP 2 OF 5
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Your professional profile.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Introduce yourself to potential clients. Your name is prefilled from your
            account when available. You can save your details now and publish your profile
            later.
          </AppText>

          {/* First name */}
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  First name
                </AppText>

                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                  editable={!isSaving}
                  accessibilityLabel="First name"
                  style={{
                    minHeight: 54,
                    borderWidth: 1,
                    borderColor: errors.firstName
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />

                {errors.firstName?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.firstName.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          {/* Last name */}
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Last name
                </AppText>

                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter your last name"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                  editable={!isSaving}
                  accessibilityLabel="Last name"
                  style={{
                    minHeight: 54,
                    borderWidth: 1,
                    borderColor: errors.lastName
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />

                {errors.lastName?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.lastName.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          {/* Professional bio */}
          <Controller
            control={control}
            name="professionalBio"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Professional bio
                </AppText>

                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Tell gym-goers about your experience and what makes you different"
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  editable={!isSaving}
                  textAlignVertical="top"
                  maxLength={1000}
                  accessibilityLabel="Professional bio"
                  style={{
                    minHeight: 120,
                    borderWidth: 1,
                    borderColor: errors.professionalBio
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />

                {errors.professionalBio?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.professionalBio.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          {/* Location */}
          <Controller
            control={control}
            name="location"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Location
                </AppText>

                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter your city or area"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                  editable={!isSaving}
                  maxLength={150}
                  accessibilityLabel="Location"
                  style={{
                    minHeight: 54,
                    borderWidth: 1,
                    borderColor: errors.location
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />

                {errors.location?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.location.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          {/* Coaching approach */}
          <Controller
            control={control}
            name="coachingApproach"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Coaching approach
                </AppText>

                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Describe how you motivate, guide and support your clients"
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  editable={!isSaving}
                  textAlignVertical="top"
                  maxLength={1000}
                  accessibilityLabel="Coaching approach"
                  style={{
                    minHeight: 120,
                    borderWidth: 1,
                    borderColor: errors.coachingApproach
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />

                {errors.coachingApproach?.message ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.coachingApproach.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          {/* Profile photo */}
          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border.default,
              gap: spacing.md,
            }}
          >
            <AppText variant="body" color={colors.text.primary}>
              Profile photo
            </AppText>

            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                accessibilityLabel="Your profile photo"
                resizeMode="cover"
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignSelf: 'center',
                }}
              />
            ) : (
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignSelf: 'center',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.background.secondary,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                }}
              >
                <AppText variant="h1" color={colors.brand.red}>
                  {(resolvedFirstName.trim().charAt(0) || 'T').toUpperCase()}
                </AppText>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                avatarUrl ? 'Change profile photo' : 'Choose profile photo'
              }
              accessibilityState={{
                disabled: isSaving || isUploadingPhoto,
                busy: isUploadingPhoto,
              }}
              disabled={isSaving || isUploadingPhoto}
              onPress={handleChoosePhoto}
              style={({ pressed }) => ({
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.background.secondary,
                opacity: isSaving || isUploadingPhoto ? 0.6 : pressed ? 0.8 : 1,
              })}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator color={colors.brand.red} />
              ) : (
                <AppText variant="button" color={colors.text.primary}>
                  {avatarUrl ? 'CHANGE PROFILE PHOTO' : 'CHOOSE PROFILE PHOTO'}
                </AppText>
              )}
            </Pressable>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              JPEG, PNG or WebP · Maximum 5 MB
            </AppText>
          </View>

          {/* General error message */}
          {errorMessage ? (
            <AppText
              variant="bodySmall"
              color={colors.text.error}
              accessibilityRole="alert"
            >
              {errorMessage}
            </AppText>
          ) : null}

          {/* Save and continue */}
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
              {isSaving ? 'SAVING…' : 'SAVE DRAFT & CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
