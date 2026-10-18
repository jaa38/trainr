import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

type DailySchedule = {
  start: string;
  end: string;
};

type TrainerAvailability = {
  days?: string[];
  schedule?: Record<string, DailySchedule | undefined>;
};

type OccupiedSlot = {
  start: string;
  end: string;
};

type AvailabilityResponse = {
  availability: TrainerAvailability;
  timezone: string;
  occupied_slots: OccupiedSlot[];
};

type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

type BookingErrorContext = 'availability' | 'submission';

const SLOT_INTERVAL_MINUTES = 30;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function weekdayForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return WEEKDAYS[weekdayIndex];
}

function timeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function getZonedDateParts(date: Date, timezone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

/**
 * Converts a wall-clock date and time in a named timezone to UTC.
 * This does not assume that the device and trainer share a timezone.
 */
function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);

  let guess = targetUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedDateParts(new Date(guess), timezone);
    const [localYear, localMonth, localDay] = parts.date.split('-').map(Number);
    const [localHour, localMinute] = parts.time.split(':').map(Number);

    const representedUtc = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMinute,
    );

    const difference = targetUtc - representedUtc;

    if (difference === 0) break;

    guess += difference;
  }

  const result = new Date(guess);
  const actual = getZonedDateParts(result, timezone);

  if (actual.date !== date || actual.time !== time) {
    throw new Error(
      'This local time is not valid in the trainer’s timezone. Please choose another slot.',
    );
  }

  return result;
}

function formatTimeLabel(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatSelectedDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatRate(rate: number, currency: string | null): string {
  const amount = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(rate);

  return `${currency ?? 'NGN'} ${amount}`;
}

function overlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Maps Supabase/PostgreSQL errors to messages that make sense to users.
 * Raw database messages are logged for debugging, not shown in the UI.
 */
function getBookingErrorMessage(error: unknown, context: BookingErrorContext): string {
  const databaseError =
    error && typeof error === 'object'
      ? (error as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        })
      : {};

  const code = databaseError.code;
  const message = databaseError.message?.toLowerCase() ?? '';
  const details = databaseError.details?.toLowerCase() ?? '';
  const combined = `${message} ${details}`;

  if (
    code === 'P0002' ||
    combined.includes('published trainer not found') ||
    combined.includes('trainer not found')
  ) {
    return 'This trainer is no longer available for booking. Please choose another trainer.';
  }

  // PostgreSQL exclusion constraint: a booking overlaps an existing one.
  if (
    code === '23P01' ||
    combined.includes('exclusion constraint') ||
    combined.includes('overlap')
  ) {
    return 'This slot is no longer available. Please refresh the available times and select another slot.';
  }

  // PostgreSQL check constraint or the availability validation trigger.
  if (
    code === '23514' ||
    combined.includes('outside trainer') ||
    combined.includes('available hours') ||
    combined.includes('availability') ||
    combined.includes('working hours')
  ) {
    return 'This time is outside the trainer’s available hours. Please choose another available slot.';
  }

  if (
    combined.includes('timezone is not configured') ||
    combined.includes('invalid time zone')
  ) {
    return 'This trainer’s schedule is temporarily unavailable. Please try again later.';
  }

  if (code === '42501') {
    return 'Your account cannot perform this action. Please sign in again and try again.';
  }

  if (code === '23503') {
    return 'Some booking details are no longer valid. Please refresh the trainer’s availability and try again.';
  }

  if (code === '23505') {
    return 'This booking could not be saved because it conflicts with an existing record. Please try another slot.';
  }

  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed')
  ) {
    return 'We couldn’t connect to TRAINR. Check your internet connection and try again.';
  }

  if (context === 'availability') {
    return 'We couldn’t check this trainer’s available times. Please try again.';
  }

  return 'We couldn’t submit your booking request. Please try again.';
}

export default function BookingScreen() {
  const { trainerId, bookingId } = useLocalSearchParams<{
    trainerId: string;
    bookingId?: string;
  }>();

  const activeBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const isRescheduling = Boolean(activeBookingId);
  const { user, profile } = useAuth();
  const { colors, spacing } = useTrainrTheme();

  const [trainer, setTrainer] = useState<PublishedTrainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<TrainerAvailability | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(() => getCurrentTimestamp());

  const selectedDateKey = dateKey(selectedDate);

  const trainerName = trainer
    ? [trainer.first_name, trainer.last_name].filter(Boolean).join(' ').trim()
    : 'TRAINR Coach';

  // Load the selected published trainer.
  useEffect(() => {
    let isActive = true;

    async function loadTrainer() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const trainers = await discoverPublishedTrainers();
        const selected = trainers.find((item) => item.trainer_id === trainerId);

        if (!isActive) return;

        if (!selected) {
          setTrainer(null);
          setErrorMessage(
            'This trainer is no longer available for booking. Please choose another trainer.',
          );
        } else if (
          selected.session_rate == null ||
          selected.session_duration_minutes == null ||
          selected.session_duration_minutes <= 0
        ) {
          setTrainer(null);
          setErrorMessage(
            'This trainer has not configured a valid session rate and duration.',
          );
        } else {
          setTrainer(selected);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('[Booking] Unable to load trainer:', error);

        if (isActive) {
          setErrorMessage(
            'We couldn’t load this trainer. Check your connection and try again.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    if (trainerId) {
      void loadTrainer();
    }

    return () => {
      isActive = false;
    };
  }, [trainerId]);

  // Load the trainer's schedule and occupied intervals for the selected date.
  const loadAvailability = useCallback(async () => {
    if (!trainerId || !trainer) return;

    setIsLoadingSlots(true);
    setAvailabilityError(null);
    setAvailability(null);
    setOccupiedSlots([]);
    setTimezone(null);
    setSelectedStartTime(null);

    try {
      const { data, error } =
        isRescheduling && activeBookingId
          ? await supabase.rpc('get_trainer_reschedule_availability', {
              p_trainer_id: trainerId,
              p_date: selectedDateKey,
              p_booking_id: activeBookingId,
            })
          : await supabase.rpc('get_trainer_booking_availability', {
              p_trainer_id: trainerId,
              p_date: selectedDateKey,
            });

      if (error) throw error;

      const response = (
        Array.isArray(data) ? data[0] : data
      ) as AvailabilityResponse | null;

      if (!response?.timezone || !response.availability) {
        throw new Error('The trainer’s availability could not be retrieved.');
      }

      // Validate the IANA timezone before using it in date calculations.
      new Intl.DateTimeFormat('en-GB', {
        timeZone: response.timezone,
      }).format(new Date());

      setNowTimestamp(getCurrentTimestamp());
      setAvailability(response.availability);
      setTimezone(response.timezone);

      // During rescheduling, the current booking must not block its own slot.
      // Other pending and confirmed bookings remain unavailable.
      setOccupiedSlots(
        (response.occupied_slots ?? []).filter(
          (slot) =>
            !(
              isRescheduling &&
              activeBookingId &&
              slot.start === slot.start &&
              slot.end === slot.end
            ),
        ),
      );
    } catch (error) {
      console.error('[Booking] Unable to load availability:', error);

      setAvailabilityError(getBookingErrorMessage(error, 'availability'));
    } finally {
      setIsLoadingSlots(false);
    }
  }, [trainerId, trainer, selectedDateKey, isRescheduling, activeBookingId]);

  useEffect(() => {
    let isActive = true;

    async function refreshAvailability() {
      await Promise.resolve();

      if (isActive) {
        await loadAvailability();
      }
    }

    void refreshAvailability();

    return () => {
      isActive = false;
    };
  }, [loadAvailability]);

  const availableSlots = useMemo<AvailableSlot[]>(() => {
    if (!availability || !timezone || !trainer?.session_duration_minutes) {
      return [];
    }

    const weekday = weekdayForDate(selectedDateKey);

    if (!availability.days?.includes(weekday)) {
      return [];
    }

    const window = availability.schedule?.[weekday];

    if (!window) return [];

    const openingMinute = timeToMinutes(window.start);
    const closingMinute = timeToMinutes(window.end);

    if (
      openingMinute == null ||
      closingMinute == null ||
      closingMinute <= openingMinute
    ) {
      return [];
    }

    const duration = trainer.session_duration_minutes;
    const slots: AvailableSlot[] = [];
    const now = nowTimestamp;

    // Offer starts on 30-minute clock intervals.
    const firstStart =
      Math.ceil(openingMinute / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

    for (
      let startMinute = firstStart;
      startMinute + duration <= closingMinute;
      startMinute += SLOT_INTERVAL_MINUTES
    ) {
      const startTime = `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
      const endMinute = startMinute + duration;
      const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;

      try {
        const start = zonedDateTimeToUtc(selectedDateKey, startTime, timezone);
        const end = zonedDateTimeToUtc(selectedDateKey, endTime, timezone);

        if (start.getTime() <= now) continue;

        const hasConflict = occupiedSlots.some((occupied) => {
          const occupiedStart = new Date(occupied.start).getTime();
          const occupiedEnd = new Date(occupied.end).getTime();

          return (
            Number.isFinite(occupiedStart) &&
            Number.isFinite(occupiedEnd) &&
            overlaps(start.getTime(), end.getTime(), occupiedStart, occupiedEnd)
          );
        });

        if (!hasConflict) {
          slots.push({
            start: startTime,
            end: endTime,
            label: formatTimeLabel(startTime),
          });
        }
      } catch {
        // Skip local times that cannot be represented in this timezone.
      }
    }

    return slots;
  }, [availability, timezone, trainer, selectedDateKey, occupiedSlots, nowTimestamp]);

  const selectedSlot = availableSlots.find((slot) => slot.start === selectedStartTime);

  function handleDateChange(event: { type: string }, date?: Date) {
    setShowDatePicker(false);

    if (event.type !== 'set' || !date) return;

    setSelectedDate(date);
    setSelectedStartTime(null);
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (!user || !profile) {
      Alert.alert('Sign in required', 'Please sign in before requesting a session.');
      return;
    }

    if (profile.role !== 'gym_goer') {
      Alert.alert(
        'Gym-goer account required',
        'Only gym-goer accounts can request a training session.',
      );
      return;
    }

    if (!trainer || !trainerId) {
      Alert.alert(
        'Trainer unavailable',
        'This trainer is no longer available for booking. Please choose another trainer.',
      );
      return;
    }

    if (!timezone || !selectedSlot) {
      Alert.alert(
        'Choose an available time',
        'Select a date and an available time before continuing.',
      );
      return;
    }

    let scheduledStart: Date;
    let scheduledEnd: Date;

    try {
      scheduledStart = zonedDateTimeToUtc(selectedDateKey, selectedSlot.start, timezone);

      scheduledEnd = zonedDateTimeToUtc(selectedDateKey, selectedSlot.end, timezone);
    } catch (error) {
      Alert.alert(
        'Invalid session time',
        error instanceof Error ? error.message : 'Please select another available time.',
      );
      return;
    }

    // Use the actual current time at submission, not the render timestamp.
    if (scheduledStart.getTime() <= getCurrentTimestamp()) {
      Alert.alert(
        'Choose a future time',
        'This session time has already passed. Please choose another slot.',
      );

      await loadAvailability();
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRescheduling && activeBookingId) {
        const { error } = await supabase.rpc('reschedule_trainer_booking', {
          p_booking_id: activeBookingId,
          p_scheduled_start: scheduledStart.toISOString(),
          p_scheduled_end: scheduledEnd.toISOString(),
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.from('trainer_bookings').insert({
          gym_goer_id: user.id,
          trainer_id: trainer.trainer_id,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          session_rate: trainer.session_rate,
          currency: trainer.currency ?? 'NGN',
          status: 'pending',
          notes: notes.trim() || null,
        });

        if (error) throw error;
      }

      Alert.alert(
        isRescheduling ? 'Rescheduling requested' : 'Request sent',
        isRescheduling
          ? `Your session with ${trainerName} has been rescheduled to ${formatSelectedDate(selectedDateKey)} at ${selectedSlot.label}. The trainer must confirm the new time. Times are shown in the trainer’s timezone (${timezone}).`
          : `Your ${selectedSlot.label} session on ${formatSelectedDate(selectedDateKey)} with ${trainerName} has been sent for confirmation. Times are shown in the trainer’s timezone (${timezone}).`,
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error('[Booking] Submission failed:', error);

      Alert.alert('Booking unsuccessful', getBookingErrorMessage(error, 'submission'), [
        {
          text: 'OK',
          onPress: () => {
            void loadAvailability();
          },
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderPrimaryButton(label: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          minHeight: 52,
          paddingHorizontal: spacing.lg,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: disabled ? colors.text.tertiary : colors.brand.red,
        }}
      >
        <AppText variant="button" color="#FFFFFF">
          {label}
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: spacing.sm,
          }}
        >
          <AppText variant="button" color={colors.brand.red}>
            ← Back
          </AppText>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="displayLarge" color={colors.text.primary}>
            {isRescheduling ? 'Reschedule session' : 'Book a session'}
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            {isRescheduling
              ? 'Choose a new date and available time for your session.'
              : 'Choose a date and an available time with your coach.'}
          </AppText>
        </View>

        {!trainerId ? (
          <AppText variant="body" color={colors.text.secondary}>
            No trainer was selected. Return to Discover and choose a trainer.
          </AppText>
        ) : isLoading ? (
          <View
            style={{
              padding: spacing.xxl,
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />

            <AppText variant="body" color={colors.text.secondary}>
              Loading trainer details…
            </AppText>
          </View>
        ) : errorMessage || !trainer ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage ?? 'This trainer could not be found.'}
            </AppText>

            {renderPrimaryButton('Return to trainer profile', () => router.back())}
          </View>
        ) : (
          <>
            <View
              style={{
                padding: spacing.lg,
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: 16,
                backgroundColor: colors.background.secondary,
              }}
            >
              <AppText variant="caption" color={colors.brand.red}>
                TRAINR COACH
              </AppText>

              <AppText variant="h2" color={colors.text.primary}>
                {trainerName || 'TRAINR Coach'}
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                {trainer.session_duration_minutes} minutes per session
              </AppText>

              <AppText variant="h2" color={colors.brand.red}>
                {formatRate(trainer.session_rate!, trainer.currency)}
              </AppText>

              <AppText variant="caption" color={colors.text.secondary}>
                {isRescheduling
                  ? 'Rescheduling a confirmed session will require the trainer to confirm the new time.'
                  : 'Your request remains pending until the trainer confirms it.'}
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="h2" color={colors.text.primary}>
                1. Choose a date
              </AppText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selected date: ${formatSelectedDate(selectedDateKey)}. Change date`}
                disabled={isSubmitting}
                onPress={() => setShowDatePicker(true)}
                style={{
                  minHeight: 54,
                  paddingHorizontal: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                  justifyContent: 'center',
                }}
              >
                <AppText variant="button" color={colors.text.primary}>
                  {formatSelectedDate(selectedDateKey)}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  Tap to change date
                </AppText>
              </Pressable>

              {showDatePicker ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              ) : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="h2" color={colors.text.primary}>
                  2. Choose a time
                </AppText>

                {timezone ? (
                  <AppText variant="caption" color={colors.text.secondary}>
                    All times are shown in the trainer’s timezone: {timezone}
                  </AppText>
                ) : null}
              </View>

              {isLoadingSlots ? (
                <View
                  style={{
                    padding: spacing.xl,
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <ActivityIndicator color={colors.brand.red} />

                  <AppText variant="body" color={colors.text.secondary}>
                    Checking available times…
                  </AppText>
                </View>
              ) : availabilityError ? (
                <View style={{ gap: spacing.md }}>
                  <AppText variant="body" color={colors.text.secondary}>
                    {availabilityError}
                  </AppText>

                  {renderPrimaryButton(
                    'Retry availability',
                    () => void loadAvailability(),
                    isSubmitting,
                  )}
                </View>
              ) : availableSlots.length === 0 ? (
                <View
                  style={{
                    padding: spacing.lg,
                    gap: spacing.sm,
                    borderRadius: 12,
                    backgroundColor: colors.background.secondary,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                  }}
                >
                  <AppText variant="body" color={colors.text.primary}>
                    No available sessions on this date.
                  </AppText>

                  <AppText variant="caption" color={colors.text.secondary}>
                    Choose another date or check back later. Sessions must fit within the
                    trainer’s working hours and cannot overlap pending or confirmed
                    bookings.
                  </AppText>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                  }}
                >
                  {availableSlots.map((slot) => {
                    const isSelected = selectedStartTime === slot.start;

                    return (
                      <Pressable
                        key={slot.start}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        disabled={isSubmitting}
                        onPress={() => setSelectedStartTime(slot.start)}
                        style={{
                          minWidth: 100,
                          minHeight: 46,
                          paddingHorizontal: spacing.md,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? colors.brand.red
                            : colors.border.default,
                          backgroundColor: isSelected
                            ? colors.brand.red
                            : colors.background.secondary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppText
                          variant="button"
                          color={isSelected ? '#FFFFFF' : colors.text.primary}
                        >
                          {slot.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="h2" color={colors.text.primary}>
                3. Add a note
              </AppText>

              <Input
                label="Notes for your trainer (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Share your goals or anything your trainer should know."
                multiline
                maxLength={1000}
                textAlignVertical="top"
                style={{
                  minHeight: 100,
                  paddingTop: spacing.md,
                }}
                editable={!isSubmitting}
              />
            </View>

            {selectedSlot ? (
              <View
                style={{
                  padding: spacing.lg,
                  gap: spacing.sm,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <AppText variant="h2" color={colors.text.primary}>
                  Booking summary
                </AppText>

                <AppText variant="body" color={colors.text.secondary}>
                  {formatSelectedDate(selectedDateKey)}
                </AppText>

                <AppText variant="body" color={colors.text.secondary}>
                  {selectedSlot.label} – {formatTimeLabel(selectedSlot.end)}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  {timezone}
                </AppText>

                <AppText variant="button" color={colors.brand.red}>
                  {trainer.session_duration_minutes} minutes ·{' '}
                  {formatRate(trainer.session_rate!, trainer.currency)}
                </AppText>
              </View>
            ) : null}

            {renderPrimaryButton(
              isSubmitting
                ? isRescheduling
                  ? 'Rescheduling…'
                  : 'Sending request…'
                : isRescheduling
                  ? 'Reschedule session'
                  : 'Send booking request',
              () => void handleSubmit(),
              isSubmitting ||
                isLoadingSlots ||
                Boolean(availabilityError) ||
                !selectedSlot,
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
