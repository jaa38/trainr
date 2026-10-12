import { router } from 'expo-router';
import { useState } from 'react';
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
import { useTrainrTheme } from '@/theme';

export default function GymGoerDetailsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleContinue() {
    if (!user || isSaving) return;

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setErrorMessage('Please enter your first and last name.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setErrorMessage('Enter your date of birth as YYYY-MM-DD.');
      return;
    }

    const parsedDate = new Date(`${dateOfBirth}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth ||
      parsedDate >= today
    ) {
      setErrorMessage('Please enter a valid date of birth in the past.');
      return;
    }

    if (!normalizedPhone) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          date_of_birth: dateOfBirth,
          phone: normalizedPhone,
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

  function renderField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      keyboardType?: 'default' | 'phone-pad';
      autoCapitalize?: 'none' | 'words';
    },
  ) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" color={colors.text.primary}>
          {label}
        </AppText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          keyboardType={options?.keyboardType ?? 'default'}
          autoCapitalize={options?.autoCapitalize ?? 'words'}
          editable={!isSaving}
          style={{
            minHeight: 54,
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
          }}
        />
      </View>
    );
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
            Let's get to know you.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            These details help us personalise your TRAINR experience.
          </AppText>

          {renderField('First name', firstName, setFirstName, 'Your first name')}
          {renderField('Last name', lastName, setLastName, 'Your last name')}
          {renderField('Date of birth', dateOfBirth, setDateOfBirth, 'YYYY-MM-DD', {
            autoCapitalize: 'none',
          })}
          {renderField('Phone number', phone, setPhone, 'Your phone number', {
            keyboardType: 'phone-pad',
            autoCapitalize: 'none',
          })}

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
            accessibilityState={{ disabled: isSaving, busy: isSaving }}
            disabled={isSaving}
            onPress={handleContinue}
            style={{
              alignItems: 'center',
              padding: spacing.lg,
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <AppText variant="buttonLarge" color="#FFFFFF">
              {isSaving ? 'SAVING…' : 'CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
