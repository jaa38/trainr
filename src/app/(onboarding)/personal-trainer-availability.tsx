import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useColorScheme,
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

type AvailabilityDay = (typeof availabilityOptions)[number];
type TimeWindow = { start: string; end: string };
type DailySchedule = Partial<Record<AvailabilityDay, TimeWindow>>;

const DEFAULT_TIME_WINDOW: TimeWindow = {
  start: '09:00',
  end: '17:00',
};

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateToTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTime(time: string): string {
  return timeToDate(time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PersonalTrainerAvailabilityScreen() {
  const { colors, spacing } = useTrainrTheme();
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TrainerAvailabilityFormValues>({
    resolver: zodResolver(trainerAvailabilitySchema),
    defaultValues: {
      availableDays: [],
      dailySchedule: {},
    },
  });

  const availableDays = useWatch({
    control,
    name: 'availableDays',
  });

  const dailySchedule = useWatch({
    control,
    name: 'dailySchedule',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activePicker, setActivePicker] = useState<{
    day: AvailabilityDay;
    field: 'start' | 'end';
  } | null>(null);

  const [pickerDraft, setPickerDraft] = useState<Date | null>(null);

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
        if (!isMounted) return;

        const availability = data?.availability as
          { days?: unknown; schedule?: unknown } | null | undefined;

        const savedDays = Array.isArray(availability?.days)
          ? availability.days.filter(
              (day): day is AvailabilityDay =>
                typeof day === 'string' &&
                availabilityOptions.includes(day as AvailabilityDay),
            )
          : [];

        const uniqueSavedDays = [...new Set<AvailabilityDay>(savedDays)];

        const savedSchedule =
          availability?.schedule &&
          typeof availability.schedule === 'object' &&
          !Array.isArray(availability.schedule)
            ? (availability.schedule as Record<string, unknown>)
            : {};

        const loadedSchedule: DailySchedule = {};

        for (const day of availabilityOptions) {
          const entry = savedSchedule[day];

          if (
            entry &&
            typeof entry === 'object' &&
            'start' in entry &&
            'end' in entry &&
            typeof entry.start === 'string' &&
            typeof entry.end === 'string' &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.start) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.end)
          ) {
            loadedSchedule[day] = {
              start: entry.start,
              end: entry.end,
            };
          } else if (uniqueSavedDays.includes(day)) {
            loadedSchedule[day] = { ...DEFAULT_TIME_WINDOW };
          }
        }

        reset({
          availableDays: uniqueSavedDays,
          dailySchedule: loadedSchedule,
        });
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

  function toggleDay(day: AvailabilityDay) {
    if (isSaving || isLoading) return;

    const currentDays = getValues('availableDays');
    const currentSchedule = getValues('dailySchedule') ?? {};

    if (currentDays.includes(day)) {
      setValue(
        'availableDays',
        currentDays.filter((item) => item !== day),
        { shouldDirty: true, shouldValidate: true },
      );

      if (activePicker?.day === day) {
        setActivePicker(null);
        setPickerDraft(null);
      }
    } else {
      setValue('availableDays', [...currentDays, day], {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (!currentSchedule[day]) {
        setValue(
          `dailySchedule.${day}`,
          { ...DEFAULT_TIME_WINDOW },
          { shouldDirty: true, shouldValidate: true },
        );
      }
    }

    setErrorMessage(null);
  }

  function openTimePicker(day: AvailabilityDay, field: 'start' | 'end') {
    const time = getValues(`dailySchedule.${day}.${field}`) ?? DEFAULT_TIME_WINDOW[field];

    setPickerDraft(timeToDate(time));
    setActivePicker({ day, field });
  }

  function handleTimeChange(
    _event: Parameters<
      NonNullable<React.ComponentProps<typeof DateTimePicker>['onValueChange']>
    >[0],
    selectedDate: Date,
  ) {
    if (!activePicker) return;

    setPickerDraft(selectedDate);

    const { day, field } = activePicker;

    setValue(`dailySchedule.${day}.${field}`, dateToTime(selectedDate), {
      shouldDirty: true,
      shouldValidate: true,
    });

    setErrorMessage(null);
  }

  function closeTimePicker() {
    setActivePicker(null);
    setPickerDraft(null);
  }

  function handleTimePickerDismiss() {
    closeTimePicker();
  }

  function renderTimeButton(day: AvailabilityDay, field: 'start' | 'end') {
    const time = dailySchedule?.[day]?.[field] ?? DEFAULT_TIME_WINDOW[field];

    const isActive = activePicker?.day === day && activePicker.field === field;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${day} ${field} time, ${formatTime(time)}`}
        accessibilityState={{
          disabled: isSaving || isLoading,
          selected: isActive,
        }}
        disabled={isSaving || isLoading}
        onPress={() => openTimePicker(day, field)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 52,
          paddingHorizontal: spacing.sm,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isActive ? colors.brand.red : colors.border.default,
          backgroundColor: isActive
            ? colors.background.secondary
            : colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isSaving || isLoading ? 0.6 : pressed ? 0.8 : 1,
        })}
      >
        <AppText variant="caption" color={colors.text.secondary}>
          {field === 'start' ? 'START' : 'END'}
        </AppText>

        <AppText
          variant="button"
          color={isActive ? colors.brand.red : colors.text.primary}
        >
          {formatTime(time)}
        </AppText>
      </Pressable>
    );
  }

  function renderDay(day: AvailabilityDay) {
    const selected = availableDays.includes(day);
    const dayErrors = errors.dailySchedule?.[day];
    const isPickerOpen = activePicker?.day === day && pickerDraft !== null;

    return (
      <View key={day} style={{ gap: spacing.sm }}>
        <Pressable
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
          <AppText
            variant="body"
            color={selected ? colors.brand.red : colors.text.primary}
          >
            {day}
          </AppText>

          <AppText
            variant="button"
            color={selected ? colors.brand.red : colors.text.tertiary}
          >
            {selected ? '✓' : '+'}
          </AppText>
        </Pressable>

        {selected ? (
          <View
            style={{
              paddingLeft: spacing.sm,
              paddingBottom: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <AppText variant="caption" color={colors.text.secondary}>
              Available hours
            </AppText>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {renderTimeButton(day, 'start')}
              {renderTimeButton(day, 'end')}
            </View>

            {isPickerOpen && activePicker && pickerDraft ? (
              <View
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  borderRadius: 12,
                  backgroundColor: colors.background.primary,
                }}
              >
                <AppText variant="body" color={colors.text.primary}>
                  {activePicker.field === 'start'
                    ? `Choose ${day.toLowerCase()} start time`
                    : `Choose ${day.toLowerCase()} end time`}
                </AppText>

                {Platform.OS === 'ios' ? (
                  <>
                    <DateTimePicker
                      key={`${day}-${activePicker.field}`}
                      value={pickerDraft}
                      mode="time"
                      display="spinner"
                      themeVariant={colorScheme === 'light' ? 'light' : 'dark'}
                      style={{ height: 180, width: '100%' }}
                      onValueChange={handleTimeChange}
                    />

                    <Pressable
                      accessibilityRole="button"
                      onPress={closeTimePicker}
                      style={{
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        backgroundColor: colors.brand.red,
                      }}
                    >
                      <AppText variant="button" color="#FFFFFF">
                        DONE
                      </AppText>
                    </Pressable>
                  </>
                ) : (
                  <DateTimePicker
                    key={`${day}-${activePicker.field}`}
                    value={pickerDraft}
                    mode="time"
                    display="default"
                    themeVariant={colorScheme === 'light' ? 'light' : 'dark'}
                    onValueChange={handleTimeChange}
                    onDismiss={handleTimePickerDismiss}
                  />
                )}
              </View>
            ) : null}

            {dayErrors?.start?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {dayErrors.start.message}
              </AppText>
            ) : null}

            {dayErrors?.end?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {dayErrors.end.message}
              </AppText>
            ) : null}

            {dayErrors?.message ? (
              <AppText variant="bodySmall" color={colors.text.error}>
                {dayErrors.message}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  async function handleContinue(values: TrainerAvailabilityFormValues) {
    if (!user || isSaving || isLoading) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const schedule: DailySchedule = {};

      for (const day of availabilityOptions) {
        if (values.availableDays.includes(day)) {
          const window = values.dailySchedule[day];

          if (!window) {
            throw new Error(`Set availability hours for ${day}.`);
          }

          schedule[day] = {
            start: window.start,
            end: window.end,
          };
        }
      }

      const { data: existingProfile, error: readError } = await supabase
        .from('trainer_profiles')
        .select('timezone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (readError) throw readError;

      const { error } = await supabase.from('trainer_profiles').upsert(
        {
          user_id: user.id,
          availability: {
            days: availabilityOptions.filter((day) => values.availableDays.includes(day)),
            schedule,
          },
          ...(existingProfile?.timezone ? { timezone: existingProfile.timezone } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      console.log('[Trainer Availability] Availability and schedule saved');

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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color={colors.brand.red}>
            PERSONAL TRAINER SETUP · STEP 5 OF 6
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Set your availability.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Select the days you can train clients and set the hours you are available. All
            times use your saved trainer timezone.
          </AppText>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="h3" color={colors.text.primary}>
              Weekly availability
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Select each available day, then tap its start and end times.
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
