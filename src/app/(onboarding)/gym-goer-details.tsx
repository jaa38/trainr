import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';

import { Controller, useForm } from 'react-hook-form';
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
  gymGoerDetailsSchema,
  type GymGoerDetailsFormValues,
} from '@/schemas/gym-goer-onboarding';
import { useTrainrTheme } from '@/theme';

export default function GymGoerDetailsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GymGoerDetailsFormValues>({
    resolver: zodResolver(gymGoerDetailsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
    },
  });

  async function handleContinue(values: GymGoerDetailsFormValues) {
    if (!user || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: values.firstName,
          last_name: values.lastName,
          date_of_birth: values.dateOfBirth,
          phone: values.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      router.push('/(onboarding)/gym-goer-goals');
    } catch (error) {
      console.error('[Gym-Goer Onboarding] Failed to save details:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your details. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
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
        >
          <AppText variant="caption" color={colors.brand.red}>
            GYM-GOER SETUP · STEP 2 OF 4
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Let&apos;s get to know you.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            These details help us personalise your TRAINR experience.
          </AppText>

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
                  placeholder="Your first name"
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
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />
                {errors.firstName ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.firstName.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

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
                  placeholder="Your last name"
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
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />
                {errors.lastName ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.lastName.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Date of birth
                </AppText>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  editable={!isSaving}
                  accessibilityLabel="Date of birth"
                  style={{
                    minHeight: 54,
                    borderWidth: 1,
                    borderColor: errors.dateOfBirth
                      ? colors.text.error
                      : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />
                {errors.dateOfBirth ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.dateOfBirth.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="body" color={colors.text.primary}>
                  Phone number
                </AppText>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Your phone number"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  editable={!isSaving}
                  accessibilityLabel="Phone number"
                  style={{
                    minHeight: 54,
                    borderWidth: 1,
                    borderColor: errors.phone ? colors.text.error : colors.border.default,
                    borderRadius: 12,
                    paddingHorizontal: spacing.md,
                    color: colors.text.primary,
                    backgroundColor: colors.background.secondary,
                  }}
                />
                {errors.phone ? (
                  <AppText variant="bodySmall" color={colors.text.error}>
                    {errors.phone.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />

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
              disabled: isSaving || isSubmitting,
              busy: isSaving || isSubmitting,
            }}
            disabled={isSaving || isSubmitting}
            onPress={handleSubmit(handleContinue)}
            style={{
              alignItems: 'center',
              padding: spacing.lg,
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity: isSaving || isSubmitting ? 0.6 : 1,
            }}
          >
            <AppText variant="buttonLarge" color="#FFFFFF">
              {isSaving || isSubmitting ? 'SAVING…' : 'CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
