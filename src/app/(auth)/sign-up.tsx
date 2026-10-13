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
  confirmPassword?: string;
  general?: string;
};

type AccountType = 'gym_goer' | 'trainer';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [accountType, setAccountType] = useState<AccountType>('gym_goer');

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
            account_type: accountType,
          },
          emailRedirectTo: `trainr://auth/callback?account_type=${accountType}`,
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

  const accountTypes: {
    value: AccountType;
    title: string;
    description: string;
  }[] = [
    {
      value: 'gym_goer',
      title: 'Gym-goer',
      description: 'Find trainers and track your fitness.',
    },
    {
      value: 'trainer',
      title: 'Personal trainer',
      description: 'Manage clients and training sessions.',
    },
  ];

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

          <View
            style={{
              gap: spacing.sm,
              marginBottom: spacing.xl,
            }}
          >
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

          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                I WANT TO JOIN AS A
              </AppText>

              <View
                accessibilityRole="radiogroup"
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                }}
              >
                {accountTypes.map((type) => {
                  const isSelected = accountType === type.value;

                  return (
                    <Pressable
                      key={type.value}
                      accessibilityRole="radio"
                      accessibilityLabel={type.title}
                      accessibilityHint={type.description}
                      accessibilityState={{
                        selected: isSelected,
                        disabled: isSubmitting,
                      }}
                      disabled={isSubmitting}
                      onPress={() => setAccountType(type.value)}
                      style={{
                        flex: 1,
                        minHeight: 112,
                        padding: spacing.md,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? colors.brand.red
                          : colors.border.default,
                        backgroundColor: isSelected
                          ? colors.background.secondary
                          : colors.background.primary,
                        gap: spacing.xs,
                        opacity: isSubmitting ? 0.7 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected
                            ? colors.brand.red
                            : colors.border.default,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: spacing.xs,
                        }}
                      >
                        {isSelected ? (
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

                      <AppText
                        variant="bodyMedium"
                        color={isSelected ? colors.brand.red : colors.text.primary}
                      >
                        {type.title}
                      </AppText>

                      <AppText variant="body" color={colors.text.secondary}>
                        {type.description}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
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

            <View
              style={{
                gap: spacing.sm,
                marginTop: spacing.xs,
              }}
            >
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
