import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import {
    getTrainerSpecialities,
    TRAINER_SPECIALITY_OPTIONS,
    updateTrainerSpecialities,
} from '@/services/trainer-profile';
import { useTrainrTheme } from '@/theme';

export default function TrainerSpecialitiesScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reserve space for the floating NativeTabs bar and bottom safe area.
  const bottomContentPadding = spacing.xxxl + insets.bottom + 100;

  useEffect(() => {
    let isActive = true;

    async function loadSpecialities() {
      if (!user?.id) {
        setErrorMessage('Your session has expired. Please sign in again.');
        setIsLoading(false);
        return;
      }

      try {
        const savedSpecialities = await getTrainerSpecialities(user.id);

        if (isActive) {
          setSelectedSpecialities(savedSpecialities);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('[Trainer Specialities] Failed to load:', error);

        if (isActive) {
          setErrorMessage('Unable to load your saved specialities. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadSpecialities();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  function toggleSpeciality(speciality: string) {
    if (isSaving) return;

    setSelectedSpecialities((current) =>
      current.includes(speciality)
        ? current.filter((item) => item !== speciality)
        : [...current, speciality],
    );

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSave() {
    if (isSaving) return;

    if (!user?.id) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }

    if (selectedSpecialities.length === 0) {
      setErrorMessage('Select at least one speciality.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateTrainerSpecialities(user.id, selectedSpecialities);
      setSuccessMessage('Your training specialities have been saved.');
    } catch (error) {
      console.error('[Trainer Specialities] Failed to save:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your specialities. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isSessionMissing = !user?.id;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>

        <AppText variant="h2" color={colors.text.primary}>
          Training Specialities
        </AppText>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: bottomContentPadding,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            PROFESSIONAL PROFILE
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Define your expertise.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Select the areas of fitness in which you specialise. These specialities help
            gym-goers discover trainers who match their goals.
          </AppText>
        </View>

        {/* Selected Specialities */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: colors.background.secondary,
          }}
        >
          <AppText variant="body" color={colors.text.secondary}>
            Selected specialities
          </AppText>

          <AppText variant="h3" color={colors.brand.red}>
            {selectedSpecialities.length}
          </AppText>
        </View>

        {/* Available Specialities */}
        {isLoading ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.xxl,
              gap: spacing.md,
            }}
          >
            <ActivityIndicator color={colors.brand.red} />

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Loading your saved specialities...
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Available specialities
            </AppText>

            {TRAINER_SPECIALITY_OPTIONS.map((speciality) => {
              const isSelected = selectedSpecialities.includes(speciality);

              return (
                <Pressable
                  key={speciality}
                  accessibilityRole="checkbox"
                  accessibilityLabel={speciality}
                  accessibilityState={{
                    checked: isSelected,
                    disabled: isSaving,
                  }}
                  disabled={isSaving}
                  onPress={() => toggleSpeciality(speciality)}
                  style={({ pressed }) => ({
                    minHeight: 58,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.brand.red : colors.border.default,
                    backgroundColor: isSelected
                      ? colors.background.secondary
                      : colors.background.primary,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  })}
                >
                  <AppText
                    variant="body"
                    color={isSelected ? colors.brand.red : colors.text.primary}
                  >
                    {speciality}
                  </AppText>

                  {isSelected ? <Check size={20} color={colors.brand.red} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Error Message */}
        {errorMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage}
            </AppText>
          </View>
        ) : null}

        {/* Success Message */}
        {successMessage ? (
          <View
            accessibilityRole="alert"
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="bodySmall" color={colors.brand.red}>
              {successMessage}
            </AppText>
          </View>
        ) : null}

        {/* Save Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSaving || isLoading || isSessionMissing,
            busy: isSaving,
          }}
          disabled={isSaving || isLoading || isSessionMissing}
          onPress={handleSave}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: colors.brand.red,
            opacity: isSaving || isLoading || isSessionMissing ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          <AppText variant="buttonLarge" color="#FFFFFF">
            {isSaving ? 'SAVING...' : 'SAVE SPECIALITIES'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
