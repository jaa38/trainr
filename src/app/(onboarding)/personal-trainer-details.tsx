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

export default function PersonalTrainerDetailsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, profile } = useAuth();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [professionalBio, setProfessionalBio] = useState('');
  const [location, setLocation] = useState('');
  const [coachingApproach, setCoachingApproach] = useState('');

  const resolvedFirstName = firstName ?? profile?.first_name ?? '';
  const resolvedLastName = lastName ?? profile?.last_name ?? '';

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleContinue() {
    if (!user || isSaving) return;

    const normalizedFirstName = resolvedFirstName.trim();
    const normalizedLastName = resolvedLastName.trim();
    const normalizedBio = professionalBio.trim();
    const normalizedLocation = location.trim();
    const normalizedCoachingApproach = coachingApproach.trim();

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedBio ||
      !normalizedLocation ||
      !normalizedCoachingApproach
    ) {
      setErrorMessage('Complete all fields before continuing.');
      return;
    }

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
      console.log('[Trainer Onboarding] Navigating to expertise screen');

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

  function renderField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      multiline?: boolean;
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
          multiline={options?.multiline}
          editable={!isSaving}
          textAlignVertical={options?.multiline ? 'top' : 'center'}
          style={{
            minHeight: options?.multiline ? 120 : 54,
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
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

          {renderField(
            'First name',
            resolvedFirstName,
            (value) => setFirstName(value),
            'Enter your first name',
          )}

          {renderField(
            'Last name',
            resolvedLastName,
            (value) => setLastName(value),
            'Enter your last name',
          )}

          {renderField(
            'Professional bio',
            professionalBio,
            setProfessionalBio,
            'Tell gym-goers about your experience and what makes you different',
            { multiline: true },
          )}

          {renderField('Location', location, setLocation, 'Enter your city or area')}

          {renderField(
            'Coaching approach',
            coachingApproach,
            setCoachingApproach,
            'Describe how you motivate, guide and support your clients',
            { multiline: true },
          )}

          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border.default,
              gap: spacing.xs,
            }}
          >
            <AppText variant="body" color={colors.text.primary}>
              Profile photo
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Photo upload will be available after profile image storage is configured.
              Your existing account photo is preserved.
            </AppText>
          </View>

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
              disabled: isSaving,
              busy: isSaving,
            }}
            disabled={isSaving}
            onPress={handleContinue}
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
