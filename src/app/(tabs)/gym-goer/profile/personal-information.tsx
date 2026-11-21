import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { ArrowLeft, Camera } from 'lucide-react-native';
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
import { useAuth } from '@/providers/AuthProvider';
import {
  gymGoerDetailsSchema,
  type GymGoerDetailsFormValues,
} from '@/schemas/gym-goer-onboarding';
import {
  getGymGoerPersonalInformation,
  updateGymGoerPersonalInformation,
} from '@/services/gym-goer-profile';
import { getProfileImageUrl, pickAndUploadProfileImage } from '@/services/profile-images';
import { useTrainrTheme } from '@/theme';

function formatDate(value: string) {
  if (!value) return '';

  const [year, month, day] = value.split('-');

  return `${day}/${month}/${year}`;
}

function parseDate(value: string) {
  if (!value) return new Date();

  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

export default function GymGoerPersonalInformationScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Email comes directly from Supabase Auth and is never editable.
  const email = user?.email ?? '';

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GymGoerDetailsFormValues>({
    resolver: zodResolver(gymGoerDetailsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
    },
  });

  const dateOfBirth = watch('dateOfBirth');
  const firstName = watch('firstName');
  const lastName = watch('lastName');

  // Load saved personal information.
  useEffect(() => {
    let isActive = true;

    async function loadInformation() {
      if (!user?.id) {
        setIsLoading(false);
        setErrorMessage('Your session could not be found. Please sign in again.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getGymGoerPersonalInformation(user.id);

        if (!isActive) return;

        reset({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          dateOfBirth: data.date_of_birth ?? '',
          phone: data.phone ?? '',
        });

        // Resolve the private profile image.
        const resolvedAvatar = await getProfileImageUrl(data.avatar_url);

        if (isActive) {
          setAvatarUrl(resolvedAvatar);
        }
      } catch (error) {
        console.error('[Gym-Goer Profile] Failed to load personal information:', error);

        if (isActive) {
          setErrorMessage('Unable to load your personal information. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInformation();

    return () => {
      isActive = false;
    };
  }, [user?.id, reset]);

  // Upload a new profile photo.
  async function handleChoosePhoto() {
    if (!user?.id || isUploadingPhoto || isSubmitting) return;

    setIsUploadingPhoto(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const uploadedPath = await pickAndUploadProfileImage(user.id);

      // The user may have cancelled the image picker.
      if (!uploadedPath) {
        return;
      }

      // Resolve the new private storage image URL.
      const resolvedAvatar = await getProfileImageUrl(uploadedPath);

      setAvatarUrl(resolvedAvatar);

      // No refreshProfile() call here.
      // The upload service already updates profiles.avatar_url.
      // Updating the global AuthProvider is unnecessary for this screen.

      setSuccessMessage('Your profile photo has been updated.');
    } catch (error) {
      console.error('[Gym-Goer Profile] Failed to update profile photo:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update your profile photo. Please try again.',
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // Save personal information.
  async function handleSave(values: GymGoerDetailsFormValues) {
    if (!user?.id) {
      setErrorMessage('Your session could not be found. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateGymGoerPersonalInformation(user.id, values);

      // Update the form baseline without refreshing global auth state.
      reset(values);

      setSuccessMessage('Your personal information has been updated.');
    } catch (error) {
      console.error('[Gym-Goer Profile] Failed to save personal information:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your changes. Please try again.',
      );
    }
  }

  // Cancel changes and return to Profile.
  function handleCancel() {
    if (isSubmitting || isUploadingPhoto) return;

    if (isDirty) {
      reset();
    }

    setSuccessMessage(null);
    setErrorMessage(null);
    setShowDatePicker(false);

    router.back();
  }

  const isBusy = isSubmitting || isUploadingPhoto;

  // Reusable text input field.
  function renderTextField(
    name: keyof GymGoerDetailsFormValues,
    label: string,
    placeholder: string,
    keyboardType: 'default' | 'phone-pad' = 'default',
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
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.text.tertiary}
              keyboardType={keyboardType}
              autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
              editable={!isBusy && !isLoading}
              accessibilityLabel={label}
              style={{
                minHeight: 54,
                borderWidth: 1,
                borderColor: errors[name] ? colors.text.error : colors.border.default,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                color: colors.text.primary,
                backgroundColor: colors.background.secondary,
              }}
            />

            {errors[name]?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {errors[name]?.message}
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
          {/* Back navigation */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to profile"
            onPress={handleCancel}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <ArrowLeft size={21} color={colors.text.primary} />

            <AppText variant="body" color={colors.text.primary}>
              Back to profile
            </AppText>
          </Pressable>

          {/* Screen heading */}
          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" color={colors.brand.red}>
              YOUR ACCOUNT
            </AppText>

            <AppText variant="h1" color={colors.text.primary}>
              Personal information.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Manage the details associated with your TRAINR account.
            </AppText>
          </View>

          {isLoading ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <ActivityIndicator color={colors.brand.red} />

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Loading your information...
              </AppText>
            </View>
          ) : (
            <>
              {/* Profile photo */}
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 32,
                    overflow: 'hidden',
                    backgroundColor: colors.background.secondary,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <AppText variant="h1" color={colors.text.secondary}>
                      {(firstName?.[0] ?? 'T').toUpperCase()}
                      {(lastName?.[0] ?? 'M').toUpperCase()}
                    </AppText>
                  )}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  disabled={isBusy}
                  onPress={handleChoosePhoto}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    opacity: isBusy ? 0.5 : 1,
                  }}
                >
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color={colors.brand.red} />
                  ) : (
                    <Camera size={17} color={colors.brand.red} />
                  )}

                  <AppText variant="button" color={colors.brand.red}>
                    {isUploadingPhoto ? 'Uploading photo...' : 'Change photo'}
                  </AppText>
                </Pressable>

                <AppText variant="caption" color={colors.text.tertiary}>
                  JPEG, PNG or WebP · Maximum 5 MB
                </AppText>
              </View>

              {/* Basic information */}
              <View style={{ gap: spacing.md }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Basic information
                </AppText>

                {renderTextField('firstName', 'First name', 'Your first name')}

                {renderTextField('lastName', 'Last name', 'Your last name')}

                {/* Date of birth */}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Date of birth
                  </AppText>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose date of birth"
                    disabled={isBusy}
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      minHeight: 54,
                      borderWidth: 1,
                      borderColor: errors.dateOfBirth
                        ? colors.text.error
                        : colors.border.default,
                      borderRadius: 12,
                      paddingHorizontal: spacing.md,
                      justifyContent: 'center',
                      backgroundColor: colors.background.secondary,
                    }}
                  >
                    <AppText
                      variant="body"
                      color={dateOfBirth ? colors.text.primary : colors.text.tertiary}
                    >
                      {dateOfBirth
                        ? formatDate(dateOfBirth)
                        : 'Select your date of birth'}
                    </AppText>
                  </Pressable>

                  {showDatePicker ? (
                    <DateTimePicker
                      value={parseDate(dateOfBirth)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                          setShowDatePicker(false);
                        }

                        if (event.type === 'dismissed' || !selectedDate) {
                          return;
                        }

                        const year = selectedDate.getFullYear();

                        const month = String(selectedDate.getMonth() + 1).padStart(
                          2,
                          '0',
                        );

                        const day = String(selectedDate.getDate()).padStart(2, '0');

                        setValue('dateOfBirth', `${year}-${month}-${day}`, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });

                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                    />
                  ) : null}

                  {errors.dateOfBirth?.message ? (
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {errors.dateOfBirth.message}
                    </AppText>
                  ) : null}
                </View>

                {renderTextField(
                  'phone',
                  'Phone number',
                  'Your phone number',
                  'phone-pad',
                )}
              </View>

              {/* Account information */}
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border.default,
                }}
              />

              <View style={{ gap: spacing.md }}>
                <AppText variant="h3" color={colors.text.primary}>
                  Account information
                </AppText>

                {/* Read-only email */}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="body" color={colors.text.primary}>
                    Email address
                  </AppText>

                  <View
                    style={{
                      minHeight: 54,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      borderRadius: 12,
                      paddingHorizontal: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.background.secondary,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" color={colors.text.secondary}>
                        {email || 'No email address available'}
                      </AppText>
                    </View>

                    <AppText variant="caption" color={colors.text.tertiary}>
                      READ ONLY
                    </AppText>
                  </View>

                  <AppText variant="caption" color={colors.text.tertiary}>
                    Your email address is linked to your TRAINR account and cannot be
                    edited here.
                  </AppText>
                </View>
              </View>

              {/* Error message */}
              {errorMessage ? (
                <AppText
                  variant="bodySmall"
                  color={colors.text.error}
                  accessibilityRole="alert"
                >
                  {errorMessage}
                </AppText>
              ) : null}

              {/* Success message */}
              {successMessage ? (
                <AppText
                  variant="bodySmall"
                  color={colors.brand.red}
                  accessibilityRole="alert"
                >
                  {successMessage}
                </AppText>
              ) : null}

              {/* Save changes */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isBusy || !isDirty,
                  busy: isSubmitting,
                }}
                disabled={isBusy || !isDirty}
                onPress={handleSubmit(handleSave)}
                style={{
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  backgroundColor: colors.brand.red,
                  opacity: isBusy || !isDirty ? 0.45 : 1,
                }}
              >
                <AppText variant="buttonLarge" color="#FFFFFF">
                  {isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
                </AppText>
              </Pressable>

              {/* Cancel */}
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={handleCancel}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="button" color={colors.text.secondary}>
                  Cancel
                </AppText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
