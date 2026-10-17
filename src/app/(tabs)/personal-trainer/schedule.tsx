import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

type ScheduleView = 'Upcoming' | 'Availability' | 'History';

type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

type Booking = {
  id: string;
  gym_goer_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_rate: number;
  currency: string;
  status: BookingStatus;
  notes: string | null;
  client: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const DEFAULT_TIMEZONE = 'Africa/Lagos';

const views: ScheduleView[] = ['Upcoming', 'Availability', 'History'];

const availabilityOptions = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type AvailableDay = (typeof availabilityOptions)[number];

type DailyTimeWindow = {
  start: string;
  end: string;
};

type WeeklySchedule = Partial<Record<AvailableDay, DailyTimeWindow>>;

const HISTORY_STATUSES: BookingStatus[] = ['declined', 'cancelled', 'completed'];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

function createDefaultTimeWindow(): DailyTimeWindow {
  return { start: '09:00', end: '17:00' };
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToDate(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date;
}

function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function formatTimeLabel(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function formatDate(value: string, timezone: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });
}

function formatTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  });
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTrainrTheme();

  const [now, setNow] = useState(() => new Date());
  const [activeView, setActiveView] = useState<ScheduleView>('Upcoming');
  const [trainerTimezone, setTrainerTimezone] = useState(DEFAULT_TIMEZONE);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [savedDays, setSavedDays] = useState<AvailableDay[]>([]);

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [savedWeeklySchedule, setSavedWeeklySchedule] = useState<WeeklySchedule>({});

  const [activeTimePicker, setActiveTimePicker] = useState<{
    day: AvailableDay;
    field: 'start' | 'end';
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const loadSchedule = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
        setAvailableDays([]);
        setSavedDays([]);
        setWeeklySchedule({});
        setSavedWeeklySchedule({});
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);
      setAvailabilityError(null);

      try {
        const [
          { data: bookingRows, error: bookingsError },
          { data: trainerProfile, error: availabilityLoadError },
        ] = await Promise.all([
          supabase
            .from('trainer_bookings')
            .select(
              'id, gym_goer_id, scheduled_start, scheduled_end, session_rate, currency, status, notes',
            )
            .eq('trainer_id', user.id)
            .order('scheduled_start', { ascending: true }),

          supabase
            .from('trainer_profiles')
            .select('availability, timezone')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (bookingsError) throw bookingsError;
        if (availabilityLoadError) throw availabilityLoadError;

        setTrainerTimezone(trainerProfile?.timezone || DEFAULT_TIMEZONE);

        const rows = bookingRows ?? [];
        const clientIds = [...new Set(rows.map((booking) => booking.gym_goer_id))];

        const { data: clientProfiles, error: profilesError } = clientIds.length
          ? await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', clientIds)
          : { data: [], error: null };

        if (profilesError) throw profilesError;

        const profilesById = new Map(
          (clientProfiles ?? []).map((profile) => [
            profile.id,
            {
              first_name: profile.first_name,
              last_name: profile.last_name,
            },
          ]),
        );

        const bookingsWithClients: Booking[] = rows.map((booking) => ({
          ...booking,
          client: profilesById.get(booking.gym_goer_id) ?? null,
        })) as Booking[];

        setBookings(bookingsWithClients);

        // Load available days and the existing daily training hours.
        const availability = trainerProfile?.availability;
        let loadedDays: AvailableDay[] = [];
        let loadedSchedule: WeeklySchedule = {};

        if (
          availability &&
          typeof availability === 'object' &&
          !Array.isArray(availability)
        ) {
          if ('days' in availability && Array.isArray(availability.days)) {
            const validDays = availability.days.filter(
              (day: unknown): day is AvailableDay =>
                typeof day === 'string' &&
                availabilityOptions.includes(day as AvailableDay),
            );

            loadedDays = [...new Set<AvailableDay>(validDays)];
          }

          if (
            'schedule' in availability &&
            availability.schedule &&
            typeof availability.schedule === 'object' &&
            !Array.isArray(availability.schedule)
          ) {
            const storedSchedule = availability.schedule as Record<string, unknown>;

            for (const day of availabilityOptions) {
              const window = storedSchedule[day];

              if (
                window &&
                typeof window === 'object' &&
                'start' in window &&
                'end' in window &&
                typeof window.start === 'string' &&
                typeof window.end === 'string' &&
                isValidTime(window.start) &&
                isValidTime(window.end)
              ) {
                loadedSchedule[day] = {
                  start: window.start,
                  end: window.end,
                };
              }
            }
          }
        }

        setAvailableDays(loadedDays);
        setSavedDays(loadedDays);
        setWeeklySchedule(loadedSchedule);
        setSavedWeeklySchedule(loadedSchedule);
        setActiveTimePicker(null);
      } catch (error) {
        console.error('[Trainer Schedule] Unable to load schedule:', error);
        setErrorMessage('We couldn’t load your sessions. Please try again.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void loadSchedule();
    }, [loadSchedule]),
  );

  function toggleDay(day: AvailableDay) {
    if (isSavingAvailability || isLoading) return;

    setAvailableDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : availabilityOptions.filter(
            (option) => option === day || current.includes(option),
          ),
    );

    setAvailabilityError(null);
  }

  function updateDailyTime(day: AvailableDay, field: 'start' | 'end', value: string) {
    setWeeklySchedule((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? createDefaultTimeWindow()),
        [field]: value,
      },
    }));

    setAvailabilityError(null);
  }

  function handleTimePickerChange(event: { type: string }, selectedDate?: Date) {
    if (event.type === 'dismissed' || !selectedDate || !activeTimePicker) {
      setActiveTimePicker(null);
      return;
    }

    updateDailyTime(
      activeTimePicker.day,
      activeTimePicker.field,
      dateToTime(selectedDate),
    );

    setActiveTimePicker(null);
  }

  async function saveAvailability() {
    if (!user || isSavingAvailability || isLoading) return;

    if (availableDays.length === 0) {
      setAvailabilityError('Select at least one training day.');
      return;
    }

    // Validate each enabled day's time window.
    for (const day of availableDays) {
      const window = weeklySchedule[day] ?? createDefaultTimeWindow();

      if (!isValidTime(window.start) || !isValidTime(window.end)) {
        setAvailabilityError(`Set valid start and end times for ${day}.`);
        return;
      }

      if (window.end <= window.start) {
        setAvailabilityError(`${day}: the end time must be later than the start time.`);
        return;
      }
    }

    setIsSavingAvailability(true);
    setAvailabilityError(null);
    setActiveTimePicker(null);

    try {
      const orderedDays = availabilityOptions.filter((day) =>
        availableDays.includes(day),
      );

      // Read the latest stored value so other availability fields are preserved.
      const { data: trainerProfile, error: loadError } = await supabase
        .from('trainer_profiles')
        .select('availability')
        .eq('user_id', user.id)
        .single();

      if (loadError) throw loadError;

      const existingAvailability = trainerProfile?.availability;

      const existingObject =
        existingAvailability &&
        typeof existingAvailability === 'object' &&
        !Array.isArray(existingAvailability)
          ? existingAvailability
          : {};

      const existingSchedule =
        'schedule' in existingObject &&
        existingObject.schedule &&
        typeof existingObject.schedule === 'object' &&
        !Array.isArray(existingObject.schedule)
          ? existingObject.schedule
          : {};

      // Merge edited hours with the saved schedule. Unedited days are retained.
      const updatedSchedule = {
        ...existingSchedule,
        ...weeklySchedule,
      };

      const updatedAvailability = {
        ...existingObject,
        days: orderedDays,
        schedule: updatedSchedule,
      };

      const { error: saveError } = await supabase
        .from('trainer_profiles')
        .update({
          availability: updatedAvailability,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (saveError) throw saveError;

      setAvailableDays(orderedDays);
      setSavedDays(orderedDays);
      setSavedWeeklySchedule({ ...weeklySchedule });

      Alert.alert(
        'Availability saved',
        'Your training days and hours have been updated.',
      );
    } catch (error) {
      console.error('[Trainer Schedule] Unable to save availability:', error);

      setAvailabilityError('Unable to save your availability. Please try again.');
    } finally {
      setIsSavingAvailability(false);
    }
  }

  async function updateBookingStatus(
    booking: Booking,
    status: 'confirmed' | 'declined' | 'completed',
  ) {
    if (!user) return;

    if (status === 'completed') {
      if (booking.status !== 'confirmed') {
        Alert.alert(
          'Cannot complete session',
          'Only confirmed sessions can be marked as completed.',
        );
        return;
      }

      if (new Date(booking.scheduled_end).getTime() > now.getTime()) {
        Alert.alert(
          'Session has not ended',
          'You can mark this session as completed after its scheduled end time.',
        );
        return;
      }
    } else if (booking.status !== 'pending') {
      Alert.alert(
        'Booking already updated',
        'Refresh your schedule before trying again.',
      );
      return;
    }

    const action =
      status === 'confirmed' ? 'confirm' : status === 'declined' ? 'decline' : 'complete';

    setUpdatingBookingId(booking.id);

    try {
      const { data, error } = await supabase
        .from('trainer_bookings')
        .update({ status })
        .eq('id', booking.id)
        .eq('trainer_id', user.id)
        .eq('status', booking.status)
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        Alert.alert(
          'Booking not updated',
          'The booking may have changed. Refresh your schedule and try again.',
        );

        await loadSchedule(true);
        return;
      }

      await loadSchedule(true);

      Alert.alert(
        status === 'confirmed'
          ? 'Session confirmed'
          : status === 'declined'
            ? 'Request declined'
            : 'Session completed',
        status === 'confirmed'
          ? 'The session has been confirmed.'
          : status === 'declined'
            ? 'The booking request has been declined.'
            : 'The session is now marked as completed. The gym-goer can leave a review.',
      );
    } catch (error) {
      console.error(`[Trainer Schedule] Unable to ${action} booking:`, error);

      Alert.alert(
        'Unable to update booking',
        'Please check your connection and try again.',
      );
    } finally {
      setUpdatingBookingId(null);
    }
  }

  const visibleBookings = bookings.filter((booking) => {
    if (activeView === 'Availability') return false;

    if (activeView === 'History') {
      return HISTORY_STATUSES.includes(booking.status);
    }

    return !HISTORY_STATUSES.includes(booking.status);
  });

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadSchedule(true)}
            tintColor={colors.brand.red}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Screen heading */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            TRAINER WORKSPACE
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            SCHEDULE.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Plan your time. Show up for your clients.
          </AppText>
        </View>

        {/* Schedule tabs */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {views.map((view) => {
            const selected = activeView === view;

            return (
              <Pressable
                key={view}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActiveView(view)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.xs,
                  paddingVertical: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand.red : colors.border.default,
                  backgroundColor: selected
                    ? colors.brand.red
                    : colors.background.secondary,
                }}
              >
                <AppText
                  variant="caption"
                  color={selected ? '#FFFFFF' : colors.text.secondary}
                >
                  {view}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Weekly availability editor */}
        {activeView === 'Availability' ? (
          <View
            style={{
              padding: spacing.xl,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              WEEKLY AVAILABILITY
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Select the days you can train clients, then set your start and finish times.
              Your changes are saved to your trainer profile.
            </AppText>

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.brand.red} />
            ) : (
              availabilityOptions.map((day) => {
                const selected = availableDays.includes(day);
                const window = weeklySchedule[day] ?? createDefaultTimeWindow();

                return (
                  <View key={day} style={{ gap: spacing.sm }}>
                    {/* Day selection */}
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={day}
                      accessibilityState={{
                        checked: selected,
                        disabled: isSavingAvailability,
                      }}
                      disabled={isSavingAvailability}
                      onPress={() => toggleDay(day)}
                      style={({ pressed }) => ({
                        minHeight: 54,
                        paddingHorizontal: spacing.md,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? colors.brand.red : colors.border.default,
                        backgroundColor: selected
                          ? colors.background.primary
                          : colors.background.secondary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: isSavingAvailability ? 0.6 : pressed ? 0.8 : 1,
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

                    {/* Start and end time controls */}
                    {selected ? (
                      <View
                        style={{
                          padding: spacing.md,
                          borderRadius: 12,
                          backgroundColor: colors.background.primary,
                          borderWidth: 1,
                          borderColor: colors.border.default,
                          gap: spacing.md,
                        }}
                      >
                        <AppText variant="caption" color={colors.text.secondary}>
                          TRAINING HOURS
                        </AppText>

                        <View
                          style={{
                            flexDirection: 'row',
                            gap: spacing.sm,
                          }}
                        >
                          {(['start', 'end'] as const).map((field) => (
                            <Pressable
                              key={field}
                              accessibilityRole="button"
                              accessibilityLabel={`${day} ${
                                field === 'start' ? 'start' : 'end'
                              } time`}
                              accessibilityState={{
                                disabled: isSavingAvailability,
                              }}
                              disabled={isSavingAvailability}
                              onPress={() => setActiveTimePicker({ day, field })}
                              style={({ pressed }) => ({
                                flex: 1,
                                minHeight: 64,
                                padding: spacing.sm,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor:
                                  activeTimePicker?.day === day &&
                                  activeTimePicker.field === field
                                    ? colors.brand.red
                                    : colors.border.default,
                                justifyContent: 'center',
                                gap: spacing.xs,
                                opacity: pressed ? 0.75 : 1,
                              })}
                            >
                              <AppText variant="caption" color={colors.text.secondary}>
                                {field === 'start' ? 'START TIME' : 'END TIME'}
                              </AppText>

                              <AppText variant="h3" color={colors.text.primary}>
                                {formatTimeLabel(window[field])}
                              </AppText>
                            </Pressable>
                          ))}
                        </View>

                        {/* Native time picker */}
                        {activeTimePicker?.day === day ? (
                          <View style={{ alignItems: 'center' }}>
                            <DateTimePicker
                              value={timeToDate(window[activeTimePicker.field])}
                              mode="time"
                              display="spinner"
                              onChange={handleTimePickerChange}
                            />

                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setActiveTimePicker(null)}
                              style={{
                                paddingHorizontal: spacing.lg,
                                paddingVertical: spacing.sm,
                                borderRadius: 10,
                                backgroundColor: colors.brand.red,
                              }}
                            >
                              <AppText variant="button" color="#FFFFFF">
                                DONE
                              </AppText>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}

            {availabilityError ? (
              <AppText
                variant="bodySmall"
                color={colors.text.error}
                accessibilityRole="alert"
              >
                {availabilityError}
              </AppText>
            ) : null}

            {/* Save availability */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: isLoading || isSavingAvailability || availableDays.length === 0,
                busy: isSavingAvailability,
              }}
              disabled={isLoading || isSavingAvailability || availableDays.length === 0}
              onPress={() => void saveAvailability()}
              style={({ pressed }) => ({
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: colors.brand.red,
                opacity:
                  isLoading || isSavingAvailability || availableDays.length === 0
                    ? 0.6
                    : pressed
                      ? 0.8
                      : 1,
              })}
            >
              {isSavingAvailability ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <AppText variant="buttonLarge" color="#FFFFFF">
                  SAVE AVAILABILITY
                </AppText>
              )}
            </Pressable>

            {/* Last successfully saved availability */}
            {savedDays.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Saved days: {savedDays.join(', ')}
                </AppText>

                {savedDays.map((day) => {
                  const savedWindow = savedWeeklySchedule[day];

                  return (
                    <AppText key={day} variant="bodySmall" color={colors.text.secondary}>
                      {day}:{' '}
                      {savedWindow
                        ? `${formatTimeLabel(
                            savedWindow.start,
                          )} – ${formatTimeLabel(savedWindow.end)}`
                        : 'Hours not configured'}
                    </AppText>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : isLoading ? (
          /* Loading state */
          <View
            style={{
              padding: spacing.xxl,
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />

            <AppText variant="body" color={colors.text.secondary}>
              Loading your sessions…
            </AppText>
          </View>
        ) : errorMessage ? (
          /* Error state */
          <View
            style={{
              padding: spacing.xl,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              SESSIONS UNAVAILABLE
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => void loadSchedule()}
              style={{
                padding: spacing.md,
                alignItems: 'center',
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Try again
              </AppText>
            </Pressable>
          </View>
        ) : visibleBookings.length === 0 ? (
          /* Empty state */
          <View
            style={{
              padding: spacing.xl,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {activeView === 'History' ? 'NO SESSION HISTORY' : 'NO UPCOMING SESSIONS'}
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              {activeView === 'History'
                ? 'Completed, declined and cancelled sessions will appear here.'
                : 'New booking requests and confirmed appointments will appear here.'}
            </AppText>
          </View>
        ) : (
          /* Booking cards */
          <View style={{ gap: spacing.md }}>
            <AppText variant="h2" color={colors.text.primary}>
              {activeView === 'History' ? 'SESSION HISTORY' : 'YOUR SESSIONS'} (
              {visibleBookings.length})
            </AppText>

            {visibleBookings.map((booking) => {
              const clientName = [booking.client?.first_name, booking.client?.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              const isPending = booking.status === 'pending';
              const isUpdating = updatingBookingId === booking.id;

              const statusColors: Record<BookingStatus, string> = {
                pending: '#D97706',
                confirmed: '#16A34A',
                declined: colors.text.tertiary,
                cancelled: colors.text.tertiary,
                completed: colors.brand.red,
              };

              const statusColor = statusColors[booking.status];

              return (
                <View
                  key={booking.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    borderLeftWidth: 4,
                    borderLeftColor: statusColor,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.md,
                  }}
                >
                  {/* Client and status */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.brand.red}>
                        TRAINR CLIENT
                      </AppText>

                      <AppText variant="h3" color={colors.text.primary}>
                        {clientName || 'TRAINR Client'}
                      </AppText>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: statusColor,
                        backgroundColor: colors.background.primary,
                      }}
                    >
                      <AppText variant="caption" color={statusColor}>
                        {STATUS_LABELS[booking.status].toUpperCase()}
                      </AppText>
                    </View>
                  </View>

                  {/* Session date and time in trainer timezone */}
                  <View
                    style={{
                      padding: spacing.md,
                      borderRadius: 12,
                      backgroundColor: colors.background.primary,
                      gap: spacing.xs,
                    }}
                  >
                    <AppText variant="body" color={colors.text.primary}>
                      {formatDate(booking.scheduled_start, trainerTimezone)}
                    </AppText>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                      }}
                    >
                      <AppText variant="h3" color={colors.brand.red}>
                        {formatTime(booking.scheduled_start, trainerTimezone)}
                      </AppText>

                      <AppText variant="body" color={colors.text.tertiary}>
                        –
                      </AppText>

                      <AppText variant="h3" color={colors.text.primary}>
                        {formatTime(booking.scheduled_end, trainerTimezone)}
                      </AppText>
                    </View>
                  </View>

                  {/* Session fee */}
                  <View
                    style={{
                      paddingTop: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.border.default,
                      gap: spacing.xs,
                    }}
                  >
                    <AppText variant="caption" color={colors.text.secondary}>
                      SESSION FEE
                    </AppText>

                    <AppText variant="h3" color={colors.brand.red}>
                      {formatCurrency(Number(booking.session_rate), booking.currency)}
                    </AppText>
                  </View>

                  {booking.notes ? (
                    <AppText variant="body" color={colors.text.secondary}>
                      Notes: {booking.notes}
                    </AppText>
                  ) : null}

                  {/* Pending booking actions */}
                  {isPending && activeView === 'Upcoming' ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: spacing.sm,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decline booking"
                        disabled={isUpdating}
                        onPress={() => void updateBookingStatus(booking, 'declined')}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border.default,
                          opacity: isUpdating ? 0.6 : pressed ? 0.8 : 1,
                        })}
                      >
                        <AppText variant="button" color={colors.text.primary}>
                          Decline
                        </AppText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Confirm booking"
                        disabled={isUpdating}
                        onPress={() => void updateBookingStatus(booking, 'confirmed')}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          backgroundColor: colors.brand.red,
                          opacity: isUpdating ? 0.6 : pressed ? 0.8 : 1,
                        })}
                      >
                        {isUpdating ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <AppText variant="button" color="#FFFFFF">
                            Confirm
                          </AppText>
                        )}
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Complete confirmed sessions after their scheduled end time */}
                  {booking.status === 'confirmed' &&
                  activeView === 'Upcoming' &&
                  new Date(booking.scheduled_end).getTime() <= now.getTime() ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark session as completed"
                      disabled={isUpdating}
                      onPress={() => {
                        Alert.alert(
                          'Complete session?',
                          'Confirm that this training session has taken place.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Complete session',
                              onPress: () =>
                                void updateBookingStatus(booking, 'completed'),
                            },
                          ],
                        );
                      }}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        backgroundColor: colors.brand.red,
                        opacity: isUpdating ? 0.6 : pressed ? 0.8 : 1,
                      })}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <AppText variant="button" color="#FFFFFF">
                          Complete session
                        </AppText>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Session checklist */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            gap: spacing.sm,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            SESSION CHECKLIST
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Review the booking details.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Prepare the client&apos;s workout.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Record session completion when available.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
