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
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const { colors, spacing, mode } = useTrainrTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};
    const normalizedEmail = email.trim();

    if (!fullName.trim()) {
      nextErrors.fullName = 'Enter your full name.';
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!emailPattern.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter a password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSignUp() {
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: 'trainr://auth/callback',
        },
      });

      if (error) {
        setErrors({ general: error.message });
        return;
      }

      if (!data.session) {
        setSuccessMessage(
          'Your account has been created. Check your email for a verification link before signing in.',
        );
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
              CREATE YOUR
            </AppText>

            <AppText variant="displayLarge" color={colors.brand.red}>
              ACCOUNT.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{
                marginTop: spacing.xs,
                maxWidth: 320,
              }}
            >
              Your fitness journey starts here. Create your account to get moving.
            </AppText>
          </View>

          {/* Registration form */}
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.md }}>
              <Input
                label="Full name"
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                error={errors.fullName}
                editable={!isSubmitting}
              />

              <Input
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                error={errors.email}
                editable={!isSubmitting}
              />

              <Input
                label="Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
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
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityState={{ selected: showPassword }}
                    onPress={() => setShowPassword((visible) => !visible)}
                    hitSlop={8}
                    disabled={isSubmitting}
                  >
                    <AppText variant="caption" color={colors.brand.red}>
                      {showPassword ? 'Hide' : 'Show'}
                    </AppText>
                  </Pressable>
                }
              />

              <Input
                label="Confirm password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                error={errors.confirmPassword}
                editable={!isSubmitting}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    accessibilityState={{
                      selected: showConfirmPassword,
                    }}
                    onPress={() => setShowConfirmPassword((visible) => !visible)}
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

            {successMessage ? (
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
                  {successMessage}
                </AppText>
              </View>
            ) : null}

            {/* Primary action */}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                fullWidth
                size="large"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={handleSignUp}
              >
                Create Account
              </Button>

              <AppText variant="caption" color={colors.text.tertiary} align="center">
                By continuing, make sure your account details are accurate.
              </AppText>
            </View>
          </View>

          {/* Sign-in prompt */}
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
              Already have an account?
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
