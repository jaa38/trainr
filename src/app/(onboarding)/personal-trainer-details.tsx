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

const availabilityOptions = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export default function PersonalTrainerDetailsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const [professionalBio, setProfessionalBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [location, setLocation] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleSelection(
    value: string,
    current: string[],
    update: (next: string[]) => void,
  ) {
    if (isSaving) return;

    update(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function handleFinish() {
    if (!user || isSaving) return;

    const normalizedBio = professionalBio.trim();
    const normalizedQualifications = qualifications
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedLocation = location.trim();
    const experience = Number(yearsExperience);

    if (
      !normalizedBio ||
      normalizedQualifications.length === 0 ||
      selectedSpecialities.length === 0 ||
      !yearsExperience.trim() ||
      !normalizedLocation ||
      availableDays.length === 0
    ) {
      setErrorMessage(
        'Complete all fields, including at least one qualification, speciality and available day.',
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
      const { error: trainerProfileError } = await supabase
        .from('trainer_profiles')
        .upsert(
          {
            user_id: user.id,
            professional_bio: normalizedBio,
            qualifications: normalizedQualifications,
            specialities: selectedSpecialities,
            years_experience: experience,
            location: normalizedLocation,
            availability: {
              days: availableDays,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (trainerProfileError) throw trainerProfileError;

      const { error: completionError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (completionError) throw completionError;

      router.replace('/(tabs)/personal-trainer');
    } catch (error) {
      console.error('[Trainer Onboarding] Failed to save trainer profile:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your trainer profile. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderTextField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      multiline?: boolean;
      keyboardType?: 'default' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words';
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
          keyboardType={options?.keyboardType ?? 'default'}
          autoCapitalize={options?.autoCapitalize ?? 'sentences'}
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

  function renderChoice(
    label: string,
    selected: boolean,
    onPress: () => void,
    key: string,
  ) {
    return (
      <Pressable
        key={key}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled: isSaving }}
        disabled={isSaving}
        onPress={onPress}
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
          {label}
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
            PERSONAL TRAINER SETUP · STEP 2 OF 4
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Build your trainer profile.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Tell gym-goers about your expertise, qualifications and training availability.
          </AppText>

          {renderTextField(
            'Professional bio',
            professionalBio,
            setProfessionalBio,
            'Introduce yourself and your coaching approach',
            { multiline: true },
          )}

          {renderTextField(
            'Qualifications',
            qualifications,
            setQualifications,
            'e.g. Personal Training Level 3, First Aid',
          )}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Specialities
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select all areas in which you specialise.
            </AppText>

            {specialityOptions.map((speciality) =>
              renderChoice(
                speciality,
                selectedSpecialities.includes(speciality),
                () =>
                  toggleSelection(
                    speciality,
                    selectedSpecialities,
                    setSelectedSpecialities,
                  ),
                speciality,
              ),
            )}
          </View>

          {renderTextField(
            'Years of experience',
            yearsExperience,
            setYearsExperience,
            'e.g. 3',
            {
              keyboardType: 'numeric',
              autoCapitalize: 'none',
            },
          )}

          {renderTextField('Location', location, setLocation, 'Enter your city or area', {
            autoCapitalize: 'words',
          })}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Weekly availability
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select the days you are generally available to train clients.
            </AppText>

            {availabilityOptions.map((day) =>
              renderChoice(
                day,
                availableDays.includes(day),
                () => toggleSelection(day, availableDays, setAvailableDays),
                day,
              ),
            )}
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
            accessibilityState={{ disabled: isSaving, busy: isSaving }}
            disabled={isSaving}
            onPress={handleFinish}
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
              {isSaving ? 'SAVING…' : 'COMPLETE SETUP →'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
