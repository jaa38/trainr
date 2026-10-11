import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useTrainrTheme } from '@/theme';

type FormErrors = {
  password?: string;
  confirmPassword?: string;
  general?: string;
};

export default function ResetPasswordScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};

    if (!password) {
      nextErrors.password = 'Enter your new password.';
    } else if (password.length < 8) {
      nextErrors.password =
        'Your password must contain at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your new password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Your passwords do not match.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleResetPassword() {
    setStatusMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrors({
          general:
            'Unable to update your password. Please try again.',
        });
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setErrors({
          general:
            'Your password was updated, but we could not complete sign-out. Please return to sign in.',
        });
        return;
      }

      router.replace('/(auth)/sign-in');
    } catch {
      setErrors({
        general:
          'Something went wrong. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
          }}
        >
          {/* Navigation */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            disabled={isSubmitting}
            hitSlop={8}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: spacing.sm,
              marginBottom: spacing.xl,
            }}
          >
            <AppText variant="bodyMedium" color={colors.brand.red}>
              ← Back to Sign In
            </AppText>
          </Pressable>

          {/* Page Heading */}
          <View
            style={{
              gap: spacing.sm,
              marginBottom: spacing.xl,
            }}
          >
            <AppText variant="displayLarge" color={colors.text.primary}>
              RESET
            </AppText>

            <AppText variant="displayLarge" color={colors.brand.red}>
              PASSWORD.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{
                marginTop: spacing.xs,
                maxWidth: 320,
              }}
            >
              Choose a new password for your TRAINR account. Use at least
              8 characters to keep your account secure.
            </AppText>
          </View>

          {/* Password Form */}
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.md }}>
              {/* New Password */}
              <Input
                label="New password"
                placeholder="Enter your new password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({
                    ...current,
                    password: undefined,
                    confirmPassword: undefined,
                    general: undefined,
                  }));
                  setStatusMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                error={errors.password}
                editable={!isSubmitting}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? 'Hide new password' : 'Show new password'
                    }
                    accessibilityState={{ selected: showPassword }}
                    onPress={() =>
                      setShowPassword((visible) => !visible)
                    }
                    hitSlop={8}
                    disabled={isSubmitting}
                  >
                    <AppText variant="caption" color={colors.brand.red}>
                      {showPassword ? 'Hide' : 'Show'}
                    </AppText>
                  </Pressable>
                }
              />

              {/* Confirm Password */}
              <Input
                label="Confirm new password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setErrors((current) => ({
                    ...current,
                    confirmPassword: undefined,
                    general: undefined,
                  }));
                  setStatusMessage('');
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
                error={errors.confirmPassword}
                editable={!isSubmitting}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? 'Hide confirmation password'
                        : 'Show confirmation password'
                    }
                    accessibilityState={{
                      selected: showConfirmPassword,
                    }}
                    onPress={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    hitSlop={8}
                    disabled={isSubmitting}
                  >
                    <AppText variant="caption" color={colors.brand.red}>
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </AppText>
                  </Pressable>
                }
              />
            </View>

            {/* Error Feedback */}
            {errors.general ? (
              <View
                accessibilityRole="alert"
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.brand.red,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <AppText variant="bodySmall" color={colors.text.error}>
                  {errors.general}
                </AppText>
              </View>
            ) : null}

            {/* Status Feedback */}
            {statusMessage ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                  accessibilityLiveRegion="polite"
                >
                  {statusMessage}
                </AppText>
              </View>
            ) : null}

            {/* Primary Action */}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                fullWidth
                size="large"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={handleResetPassword}
              >
                Update Password
              </Button>

              <AppText
                variant="caption"
                color={colors.text.tertiary}
                align="center"
              >
                Choose a password you have not used before.
              </AppText>
            </View>
          </View>

          {/* Bottom Sign-in Prompt */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginTop: 'auto',
              paddingTop: spacing.xl,
            }}
          >
            <AppText variant="body" color={colors.text.secondary}>
              Remember your password?
            </AppText>

            <Pressable
              accessibilityRole="link"
              onPress={() => router.replace('/(auth)/sign-in')}
              disabled={isSubmitting}
              hitSlop={8}
            >
              <AppText variant="button" color={colors.brand.red}>
                Sign In
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}