import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  trainerAvailabilitySchema,
  type TrainerAvailabilityFormValues,
} from '@/schemas/trainer-availability';
import { useTrainrTheme } from '@/theme';

const availabilityOptions = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export default function PersonalTrainerAvailabilityScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user } = useAuth();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TrainerAvailabilityFormValues>({
    resolver: zodResolver(trainerAvailabilitySchema),
    defaultValues: {
      availableDays: [],
    },
  });

  const availableDays = useWatch({
    control,
    name: 'availableDays',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAvailability() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('trainer_profiles')
          .select('availability')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted || !data) return;

        const availability = data.availability;

        if (
          availability &&
          typeof availability === 'object' &&
          !Array.isArray(availability) &&
          'days' in availability &&
          Array.isArray(availability.days)
        ) {
          const savedDays = availability.days.filter(
            (day: unknown): day is (typeof availabilityOptions)[number] =>
              typeof day === 'string' &&
              availabilityOptions.includes(day as (typeof availabilityOptions)[number]),
          );

          const uniqueSavedDays: (typeof availabilityOptions)[number][] = [
            ...new Set<(typeof availabilityOptions)[number]>(savedDays),
          ];

          reset({
            availableDays: uniqueSavedDays,
          });
        }
      } catch (error) {
        console.error('[Trainer Availability] Failed to load availability:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load your saved availability.',
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [user, reset]);
  
  function toggleDay(day: (typeof availabilityOptions)[number]) {
    if (isSaving || isLoading) return;

    const updatedDays = availableDays.includes(day)
      ? availableDays.filter((item) => item !== day)
      : [...availableDays, day];

    setValue('availableDays', updatedDays, {
      shouldDirty: true,
      shouldValidate: true,
    });

    setErrorMessage(null);
  }

  async function handleContinue(values: TrainerAvailabilityFormValues) {
    if (!user || isSaving || isLoading) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: user.id,
          availability: {
            days: availabilityOptions.filter((day) => values.availableDays.includes(day)),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      console.log('[Trainer Availability] Availability draft saved');

      router.push('/(onboarding)/personal-trainer-review');
    } catch (error) {
      console.error('[Trainer Availability] Failed to save availability:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your availability. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderDay(day: (typeof availabilityOptions)[number]) {
    const selected = availableDays.includes(day);

    return (
      <Pressable
        key={day}
        accessibilityRole="checkbox"
        accessibilityLabel={day}
        accessibilityState={{
          checked: selected,
          disabled: isSaving || isLoading,
        }}
        disabled={isSaving || isLoading}
        onPress={() => toggleDay(day)}
        style={({ pressed }) => ({
          minHeight: 54,
          paddingHorizontal: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.brand.red : colors.border.default,
          backgroundColor: selected
            ? colors.background.secondary
            : colors.background.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: isSaving || isLoading ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText variant="body" color={selected ? colors.brand.red : colors.text.primary}>
          {day}
        </AppText>

        <AppText
          variant="button"
          color={selected ? colors.brand.red : colors.text.tertiary}
        >
          {selected ? '✓' : '+'}
        </AppText>
      </Pressable>
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
          contentContainerStyle={{
            flexGrow: 1,
            padding: spacing.lg,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL TRAINER SETUP · STEP 5 OF 6
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Set your availability.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Select the days you generally have time to train clients. You can configure
            specific session times when TRAINR scheduling is implemented.
          </AppText>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Weekly availability
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Choose every day that works for your training schedule.
            </AppText>

            {isLoading ? (
              <AppText variant="body" color={colors.text.secondary}>
                Loading saved availability…
              </AppText>
            ) : (
              <>
                {availabilityOptions.map(renderDay)}

                {errors.availableDays?.message ? (
                  <AppText
                    variant="bodySmall"
                    color={colors.text.error}
                    accessibilityRole="alert"
                  >
                    {errors.availableDays.message}
                  </AppText>
                ) : null}
              </>
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
            accessibilityState={{
              disabled: isSaving || isLoading,
              busy: isSaving,
            }}
            disabled={isSaving || isLoading}
            onPress={handleSubmit(handleContinue)}
            style={({ pressed }) => ({
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: colors.brand.red,
              opacity: isSaving || isLoading ? 0.6 : pressed ? 0.8 : 1,
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
