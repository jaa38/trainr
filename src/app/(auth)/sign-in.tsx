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
  email?: string;
  password?: string;
  general?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function validateEmail(): boolean {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrors((current) => ({
        ...current,
        email: 'Enter your email address.',
      }));
      return false;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setErrors((current) => ({
        ...current,
        email: 'Enter a valid email address.',
      }));
      return false;
    }

    setErrors((current) => ({
      ...current,
      email: undefined,
    }));

    return true;
  }

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!emailPattern.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSignIn() {
    setStatusMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrors({
          general:
            'Unable to sign in with those details. Check your email and password and try again.',
        });
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setErrors({
        general: 'Something went wrong. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setStatusMessage('');
    setErrors((current) => ({
      ...current,
      general: undefined,
    }));

    if (!validateEmail()) {
      return;
    }

    setIsResettingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        setErrors((current) => ({
          ...current,
          general: 'Unable to send a password reset email. Please try again.',
        }));
        return;
      }

      setStatusMessage(
        'If an account exists for this email, you will receive instructions to reset your password.',
      );
    } catch {
      setErrors((current) => ({
        ...current,
        general: 'Something went wrong. Please check your connection and try again.',
      }));
    } finally {
      setIsResettingPassword(false);
    }
  }

  const isBusy = isSubmitting || isResettingPassword;

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
            accessibilityLabel="Back to welcome"
            onPress={() => router.back()}
            disabled={isBusy}
            hitSlop={8}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.sm,
              marginBottom: spacing.xl,
            }}
          >
            <AppText variant="bodyMedium" color={colors.brand.red}>
              ← Back
            </AppText>
          </Pressable>

          {/* Page heading */}
          <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
            <AppText variant="displayLarge" color={colors.text.primary}>
              WELCOME
            </AppText>

            <AppText variant="displayLarge" color={colors.brand.red}>
              BACK.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{
                marginTop: spacing.xs,
                maxWidth: 320,
              }}
            >
              Sign in to continue your TRAINR journey.
            </AppText>
          </View>

          {/* Sign-in form */}
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.md }}>
              {/* Email input */}
              <Input
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrors((current) => ({
                    ...current,
                    email: undefined,
                    general: undefined,
                  }));
                  setStatusMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                error={errors.email}
                editable={!isBusy}
              />

              {/* Password input */}
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({
                    ...current,
                    password: undefined,
                    general: undefined,
                  }));
                  setStatusMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                error={errors.password}
                editable={!isBusy}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityState={{ selected: showPassword }}
                    onPress={() => setShowPassword((visible) => !visible)}
                    hitSlop={8}
                    disabled={isBusy}
                  >
                    <AppText variant="caption" color={colors.brand.red}>
                      {showPassword ? 'Hide' : 'Show'}
                    </AppText>
                  </Pressable>
                }
              />
            </View>

            {/* Forgot password */}
            <Pressable
              accessibilityRole="button"
              onPress={handleForgotPassword}
              disabled={isBusy}
              hitSlop={8}
              style={{
                alignSelf: 'flex-end',
                paddingVertical: spacing.xs,
              }}
            >
              <AppText variant="button" color={colors.brand.red}>
                {isResettingPassword ? 'Sending reset email...' : 'Forgot password?'}
              </AppText>
            </Pressable>

            {/* Authentication feedback */}
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

            {/* Primary action */}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                fullWidth
                size="large"
                loading={isSubmitting}
                disabled={isBusy}
                onPress={handleSignIn}
              >
                Sign In
              </Button>

              <AppText variant="caption" color={colors.text.tertiary} align="center">
                Welcome back. Your next step starts here.
              </AppText>
            </View>
          </View>

          {/* Sign-up prompt */}
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
              Don&apos;t have an account?{' '}
            </AppText>

            <Pressable
              accessibilityRole="link"
              onPress={() => router.replace('/(auth)/sign-up')}
              disabled={isBusy}
              hitSlop={8}
            >
              <AppText variant="button" color={colors.brand.red}>
                Create Account
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
