import DateTimePicker from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
  type PublishedTrainerSessionRate,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

import { formatCurrency } from '../../../utils/formatCurrency';

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

type RescheduleBooking = {
  id: string;
  trainer_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_rate: number;
  currency: string;
  session_rate_id: string | null;
  session_type: string | null;
  training_format: string | null;
  session_duration_minutes: number;
};

type IdempotencyRequest = {
  fingerprint: string;
  key: string;
};

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
  return formatCurrency(rate, {
    currency: currency ?? 'NGN',
  });
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

  if (
    code === '23P01' ||
    combined.includes('exclusion constraint') ||
    combined.includes('overlap')
  ) {
    return 'This slot is no longer available. Please refresh the available times and select another slot.';
  }

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

  const [rescheduleBooking, setRescheduleBooking] = useState<RescheduleBooking | null>(
    null,
  );

  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

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

  const idempotencyRequestRef = useRef<IdempotencyRequest | null>(null);

  const selectedDateKey = dateKey(selectedDate);

  const minimumSelectableDate = useMemo(() => {
    const trainerTimezone = timezone ?? trainer?.timezone;

    if (!trainerTimezone) {
      return new Date();
    }

    const trainerLocalToday = getZonedDateParts(new Date(), trainerTimezone).date;

    const [year, month, day] = trainerLocalToday.split('-').map(Number);

    return new Date(year, month - 1, day);
  }, [timezone, trainer?.timezone]);

  const trainerName = trainer
    ? [trainer.first_name, trainer.last_name].filter(Boolean).join(' ').trim()
    : 'TRAINR Coach';

  const selectedRate = useMemo(
    () => trainer?.session_rates.find((rate) => rate.id === selectedRateId) ?? null,
    [trainer, selectedRateId],
  );

  /**
   * New bookings use the explicitly selected rate.
   * Rescheduling uses the original booking's stored duration.
   */
  const sessionDurationMinutes = isRescheduling
    ? (rescheduleBooking?.session_duration_minutes ?? null)
    : (selectedRate?.session_duration_minutes ?? null);

  const displayRate = isRescheduling
    ? rescheduleBooking
      ? {
          session_rate: rescheduleBooking.session_rate,
          currency: rescheduleBooking.currency,
        }
      : null
    : selectedRate
      ? {
          session_rate: selectedRate.session_rate,
          currency: selectedRate.currency,
        }
      : null;

  // Load the selected published trainer and, when rescheduling,
  // the original booking.
  useEffect(() => {
    let isActive = true;

    async function loadTrainer() {
      setIsLoading(true);
      setErrorMessage(null);
      setTrainer(null);
      setRescheduleBooking(null);
      setSelectedRateId(null);

      try {
        if (isRescheduling && (!activeBookingId || !user?.id)) {
          throw new Error('Sign in is required to reschedule this booking.');
        }

        const trainers = await discoverPublishedTrainers();

        const selected = trainers.find((item) => item.trainer_id === trainerId);

        if (!selected) {
          throw new Error(
            'This trainer is no longer available for booking. Please choose another trainer.',
          );
        }

        const trainerTimezone = selected.timezone;

        if (!trainerTimezone) {
          throw new Error(
            'This trainer’s timezone is not configured. Please try again later.',
          );
        }

        // Validate the IANA timezone before using it.
        new Intl.DateTimeFormat('en-GB', {
          timeZone: trainerTimezone,
        }).format(new Date());

        // Determine today's calendar date in the trainer's timezone.
        const trainerLocalToday = getZonedDateParts(new Date(), trainerTimezone).date;

        const [todayYear, todayMonth, todayDay] = trainerLocalToday
          .split('-')
          .map(Number);

        if (isActive && !isRescheduling) {
          setSelectedDate(new Date(todayYear, todayMonth - 1, todayDay));
        }

        let existingBooking: RescheduleBooking | null = null;

        if (isRescheduling && activeBookingId && user?.id) {
          const { data, error } = await supabase
            .from('trainer_bookings')
            .select(
              'id, trainer_id, scheduled_start, scheduled_end, session_rate, currency, session_rate_id, session_type, training_format, session_duration_minutes',
            )
            .eq('id', activeBookingId)
            .eq('gym_goer_id', user.id)
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            throw new Error(
              'This booking could not be found or you do not have permission to reschedule it.',
            );
          }

          if (data.trainer_id !== selected.trainer_id) {
            throw new Error('The selected trainer does not match this booking.');
          }

          const startTimestamp = new Date(data.scheduled_start).getTime();

          const endTimestamp = new Date(data.scheduled_end).getTime();

          const storedDuration = data.session_duration_minutes;

          const originalDuration =
            storedDuration ?? Math.round((endTimestamp - startTimestamp) / 60000);

          if (
            !Number.isFinite(startTimestamp) ||
            !Number.isFinite(endTimestamp) ||
            endTimestamp <= startTimestamp ||
            !Number.isFinite(originalDuration) ||
            originalDuration <= 0
          ) {
            throw new Error(
              'The original session duration could not be determined. Please contact support before rescheduling.',
            );
          }

          // A rate-backed booking must have its complete duration snapshot.
          if (data.session_rate_id && storedDuration == null) {
            throw new Error(
              'The original session details are incomplete. Please contact support before rescheduling.',
            );
          }

          existingBooking = {
            id: data.id,
            trainer_id: data.trainer_id,
            scheduled_start: data.scheduled_start,
            scheduled_end: data.scheduled_end,
            session_rate: Number(data.session_rate),
            currency: data.currency,
            session_rate_id: data.session_rate_id,
            session_type: data.session_type,
            training_format: data.training_format,
            session_duration_minutes: originalDuration,
          };

          // Preserve the original calendar date in the trainer's timezone.
          const originalLocalDate = getZonedDateParts(
            new Date(data.scheduled_start),
            trainerTimezone,
          ).date;

          const [year, month, day] = originalLocalDate.split('-').map(Number);

          if (isActive) {
            setSelectedDate(new Date(year, month - 1, day));
            setNotes('');
          }
        }

        if (!isActive) return;

        setTrainer(selected);
        setRescheduleBooking(existingBooking);
        setErrorMessage(null);
      } catch (error) {
        console.error('[Booking] Unable to load trainer or booking:', error);

        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'We couldn’t load this trainer. Check your connection and try again.',
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
  }, [trainerId, isRescheduling, activeBookingId, user?.id]);

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

      // The reschedule RPC already excludes the current booking.
      setOccupiedSlots(response.occupied_slots ?? []);
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
    if (!availability || !timezone || !sessionDurationMinutes) {
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

    const duration = sessionDurationMinutes;
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
      const startTime = `${String(Math.floor(startMinute / 60)).padStart(
        2,
        '0',
      )}:${String(startMinute % 60).padStart(2, '0')}`;

      const endMinute = startMinute + duration;

      const endTime = `${String(Math.floor(endMinute / 60)).padStart(
        2,
        '0',
      )}:${String(endMinute % 60).padStart(2, '0')}`;

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
  }, [
    availability,
    timezone,
    sessionDurationMinutes,
    selectedDateKey,
    occupiedSlots,
    nowTimestamp,
  ]);

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

    if (isRescheduling && !rescheduleBooking) {
      Alert.alert(
        'Booking unavailable',
        'The original booking could not be loaded. Please try again.',
      );
      return;
    }

    if (!isRescheduling && !selectedRate) {
      Alert.alert(
        'Choose a session rate',
        'Select the session type and rate you want before continuing.',
      );
      return;
    }

    if (!sessionDurationMinutes || sessionDurationMinutes <= 0) {
      Alert.alert(
        'Session details unavailable',
        'The session duration could not be determined. Please try again.',
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

      // Used for rescheduling validation. New booking end time is
      // calculated by the database from the selected session rate.
      scheduledEnd = zonedDateTimeToUtc(selectedDateKey, selectedSlot.end, timezone);
    } catch (error) {
      Alert.alert(
        'Invalid session time',
        error instanceof Error ? error.message : 'Please select another available slot.',
      );
      return;
    }

    if (scheduledStart.getTime() <= getCurrentTimestamp()) {
      Alert.alert(
        'Choose a future time',
        'This session time has already passed. Please choose another slot.',
      );

      await loadAvailability();
      return;
    }

    if (
      scheduledEnd.getTime() - scheduledStart.getTime() !==
      sessionDurationMinutes * 60 * 1000
    ) {
      Alert.alert(
        'Invalid session duration',
        'The selected time does not match the session duration. Please choose another slot.',
      );
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
        if (!selectedRate) {
          throw new Error('Please select a session rate before booking.');
        }

        const trimmedNotes = notes.trim();

        // Retain the same idempotency key when retrying the exact same
        // request after a network or server response failure.
        const fingerprint = JSON.stringify({
          trainerId: trainer.trainer_id,
          sessionRateId: selectedRate.id,
          scheduledStart: scheduledStart.toISOString(),
          notes: trimmedNotes || null,
        });

        let idempotencyRequest = idempotencyRequestRef.current;

        if (!idempotencyRequest || idempotencyRequest.fingerprint !== fingerprint) {
          idempotencyRequest = {
            fingerprint,
            key: Crypto.randomUUID(),
          };

          idempotencyRequestRef.current = idempotencyRequest;
        }

        const { error } = await supabase.rpc('create_trainer_booking', {
          p_session_rate_id: selectedRate.id,
          p_scheduled_start: scheduledStart.toISOString(),
          p_idempotency_key: idempotencyRequest.key,
          p_notes: trimmedNotes || null,
        });

        if (error) throw error;

        // Clear the key only after the server confirms success.
        idempotencyRequestRef.current = null;
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

  function renderRateOption(rate: PublishedTrainerSessionRate) {
    const isSelected = selectedRateId === rate.id;

    return (
      <Pressable
        key={rate.id}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        disabled={isSubmitting}
        onPress={() => {
          setSelectedRateId(rate.id);
          setSelectedStartTime(null);
        }}
        style={{
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isSelected ? colors.brand.red : colors.border.default,
          backgroundColor: isSelected
            ? colors.background.secondary
            : colors.background.primary,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <AppText variant="button" color={colors.text.primary}>
            {formatLabel(rate.session_type)}
          </AppText>

          {isSelected ? (
            <AppText variant="caption" color={colors.brand.red}>
              SELECTED
            </AppText>
          ) : null}
        </View>

        <AppText variant="body" color={colors.text.secondary}>
          {rate.session_duration_minutes} minutes · {formatLabel(rate.training_format)}
        </AppText>

        <AppText variant="h2" color={colors.brand.red}>
          {formatRate(rate.session_rate, rate.currency)}
        </AppText>
      </Pressable>
    );
  }

  const isReadyToSubmit =
    !isSubmitting &&
    !isLoadingSlots &&
    !availabilityError &&
    Boolean(selectedSlot) &&
    Boolean(sessionDurationMinutes) &&
    (isRescheduling ? Boolean(rescheduleBooking) : Boolean(selectedRate));

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
              : 'Choose a session rate, date and available time with your coach.'}
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

              {isRescheduling && rescheduleBooking ? (
                <>
                  <AppText variant="body" color={colors.text.secondary}>
                    Original session: {rescheduleBooking.session_duration_minutes} minutes
                  </AppText>

                  <AppText variant="h2" color={colors.brand.red}>
                    {formatRate(
                      rescheduleBooking.session_rate,
                      rescheduleBooking.currency,
                    )}
                  </AppText>

                  {rescheduleBooking.session_type ? (
                    <AppText variant="caption" color={colors.text.secondary}>
                      {formatLabel(rescheduleBooking.session_type)}
                      {rescheduleBooking.training_format
                        ? ` · ${formatLabel(rescheduleBooking.training_format)}`
                        : ''}
                    </AppText>
                  ) : null}

                  <AppText variant="caption" color={colors.text.secondary}>
                    Your original session rate and duration will remain unchanged.
                  </AppText>
                </>
              ) : (
                <AppText variant="caption" color={colors.text.secondary}>
                  Select one of the trainer’s available session options below.
                </AppText>
              )}

              <AppText variant="caption" color={colors.text.secondary}>
                {isRescheduling
                  ? 'Rescheduling a confirmed session will require the trainer to confirm the new time.'
                  : 'Your request remains pending until the trainer confirms it.'}
              </AppText>
            </View>

            {!isRescheduling ? (
              <View style={{ gap: spacing.md }}>
                <AppText variant="h2" color={colors.text.primary}>
                  1. Choose a session
                </AppText>

                {trainer.session_rates.length === 0 ? (
                  <AppText variant="body" color={colors.text.secondary}>
                    This trainer currently has no bookable session rates.
                  </AppText>
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {trainer.session_rates.map(renderRateOption)}
                  </View>
                )}
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <AppText variant="h2" color={colors.text.primary}>
                {isRescheduling ? '1.' : '2.'} Choose a date
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
                  minimumDate={minimumSelectableDate}
                  onChange={handleDateChange}
                />
              ) : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="h2" color={colors.text.primary}>
                  {isRescheduling ? '2.' : '3.'} Choose a time
                </AppText>

                {timezone ? (
                  <AppText variant="caption" color={colors.text.secondary}>
                    All times are shown in the trainer’s timezone: {timezone}
                  </AppText>
                ) : null}
              </View>

              {!sessionDurationMinutes && !isRescheduling ? (
                <AppText variant="body" color={colors.text.secondary}>
                  Select a session option first to see available times.
                </AppText>
              ) : isLoadingSlots ? (
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

            {!isRescheduling ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="h2" color={colors.text.primary}>
                  4. Add a note
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
            ) : null}

            {selectedSlot && displayRate ? (
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
                  {sessionDurationMinutes} minutes ·{' '}
                  {formatRate(displayRate.session_rate, displayRate.currency)}
                </AppText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !isReadyToSubmit }}
              disabled={!isReadyToSubmit}
              onPress={() => {
                void handleSubmit();
              }}
              style={{
                minHeight: 52,
                paddingHorizontal: spacing.lg,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: !isReadyToSubmit
                  ? colors.text.tertiary
                  : colors.brand.red,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                {isSubmitting
                  ? isRescheduling
                    ? 'Rescheduling…'
                    : 'Sending request…'
                  : isRescheduling
                    ? 'Reschedule session'
                    : 'Send booking request'}
              </AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
