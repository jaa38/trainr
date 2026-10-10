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
  const { colors, spacing } = useTrainrTheme();

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

      setSuccessMessage('Your account has been created successfully.');

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
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.xl,
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to welcome"
              onPress={() => router.back()}
              style={{
                alignSelf: 'flex-start',
                paddingVertical: spacing.sm,
              }}
            >
              <AppText variant="body" color={colors.brand.red}>
                ← Back
              </AppText>
            </Pressable>

            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              YOUR FITNESS. YOUR JOURNEY.
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="displayLarge" color={colors.text.primary}>
              CREATE YOUR
            </AppText>

            <AppText variant="displayLarge" color={colors.brand.red}>
              ACCOUNT.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Start your fitness journey with TRAINR.
            </AppText>
          </View>

          <View style={{ gap: spacing.lg }}>
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
                  onPress={() => setShowPassword((visible) => !visible)}
                  hitSlop={8}
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
                  onPress={() => setShowConfirmPassword((visible) => !visible)}
                  hitSlop={8}
                >
                  <AppText variant="caption" color={colors.brand.red}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </AppText>
                </Pressable>
              }
            />

            {errors.general ? (
              <AppText variant="body" color={colors.text.error} accessibilityRole="alert">
                {errors.general}
              </AppText>
            ) : null}

            {successMessage ? (
              <AppText
                variant="body"
                color={colors.text.secondary}
                accessibilityLiveRegion="polite"
              >
                {successMessage}
              </AppText>
            ) : null}

            <Button
              fullWidth
              size="large"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleSignUp}
            >
              Create Account
            </Button>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: spacing.xs,
            }}
          >
            <AppText variant="body" color={colors.text.secondary}>
              Already have an account?
            </AppText>

            <Pressable
              accessibilityRole="link"
              onPress={() => router.replace('/(auth)/sign-in')}
              disabled={isSubmitting}
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
