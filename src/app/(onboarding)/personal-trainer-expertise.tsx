import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

const specialityOptions = [
  'Strength training',
  'Weight loss',
  'Muscle building',
  'General fitness',
  'Functional training',
  'Sports performance',
  'Mobility and flexibility',
  'Nutrition coaching',
] as const;

export default function PersonalTrainerExpertiseScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);
  const [qualifications, setQualifications] = useState('');
  const [certifications, setCertifications] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExistingDetails() {
      if (!user) return;

      const { data, error } = await supabase
        .from('trainer_profiles')
        .select('specialities, qualifications, certifications, years_experience')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[Trainer Expertise] Failed to load saved details:', error);
        return;
      }

      if (!isMounted || !data) return;

      setSelectedSpecialities(data.specialities ?? []);
      setQualifications((data.qualifications ?? []).join(', '));
      setCertifications((data.certifications ?? []).join(', '));
      setYearsExperience(
        data.years_experience === null || data.years_experience === undefined
          ? ''
          : String(data.years_experience),
      );
    }

    void loadExistingDetails();

    return () => {
      isMounted = false;
    };
  }, [user]);

  function toggleSpeciality(speciality: string) {
    if (isSaving) return;

    setSelectedSpecialities((current) =>
      current.includes(speciality)
        ? current.filter((item) => item !== speciality)
        : [...current, speciality],
    );
  }

  function parseList(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleContinue() {
    if (!user || isSaving) return;

    const normalizedQualifications = parseList(qualifications);
    const normalizedCertifications = parseList(certifications);
    const experience = Number(yearsExperience);

    if (
      selectedSpecialities.length === 0 ||
      normalizedQualifications.length === 0 ||
      normalizedCertifications.length === 0 ||
      !yearsExperience.trim()
    ) {
      setErrorMessage(
        'Add at least one speciality, qualification and certification, and enter your years of experience.',
      );
      return;
    }

    if (!Number.isInteger(experience) || experience < 0 || experience > 80) {
      setErrorMessage('Enter a valid number of years of experience.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: user.id,
          specialities: selectedSpecialities,
          qualifications: normalizedQualifications,
          certifications: normalizedCertifications,
          years_experience: experience,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      console.log('[Trainer Expertise] Expertise and credentials saved');

      router.push('/(onboarding)/personal-trainer-pricing');
    } catch (error) {
      console.error('[Trainer Expertise] Failed to save details:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your expertise details. Please try again.',
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
      numeric?: boolean;
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
          keyboardType={options?.numeric ? 'numeric' : 'default'}
          editable={!isSaving}
          textAlignVertical={options?.multiline ? 'top' : 'center'}
          style={{
            minHeight: options?.multiline ? 100 : 54,
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

  function renderSpeciality(speciality: string) {
    const selected = selectedSpecialities.includes(speciality);

    return (
      <Pressable
        key={speciality}
        accessibilityRole="checkbox"
        accessibilityLabel={speciality}
        accessibilityState={{ checked: selected, disabled: isSaving }}
        disabled={isSaving}
        onPress={() => toggleSpeciality(speciality)}
        style={({ pressed }) => ({
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
          opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText variant="body" color={selected ? colors.brand.red : colors.text.primary}>
          {selected ? '✓  ' : ''}
          {speciality}
        </AppText>
      </Pressable>
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
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL TRAINER SETUP · STEP 3 OF 5
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Showcase your expertise.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Help gym-goers understand your specialities, professional qualifications and
            training experience.
          </AppText>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Specialities
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select every area in which you specialise.
            </AppText>

            {specialityOptions.map(renderSpeciality)}
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Qualifications
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Enter your relevant education and professional qualifications, separated by
              commas.
            </AppText>

            {renderField(
              'Your qualifications',
              qualifications,
              setQualifications,
              'e.g. Sports Science Diploma, Personal Training Level 3',
              { multiline: true },
            )}
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Certifications
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              List relevant training certifications, separated by commas.
            </AppText>

            {renderField(
              'Your certifications',
              certifications,
              setCertifications,
              'e.g. CPR, First Aid, Strength and Conditioning',
              { multiline: true },
            )}
          </View>

          {renderField(
            'Years of experience',
            yearsExperience,
            setYearsExperience,
            'e.g. 3',
            { numeric: true },
          )}

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
              {isSaving ? 'SAVING…' : 'SAVE & CONTINUE →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
