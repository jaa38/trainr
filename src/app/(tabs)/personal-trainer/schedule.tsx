import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

const HISTORY_STATUSES: BookingStatus[] = ['declined', 'cancelled', 'completed'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
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

  const [activeView, setActiveView] = useState<ScheduleView>('Upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [savedDays, setSavedDays] = useState<AvailableDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  const loadSchedule = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
        setAvailableDays([]);
        setSavedDays([]);
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
            .select('availability')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (bookingsError) throw bookingsError;
        if (availabilityLoadError) throw availabilityLoadError;

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

        const availability = trainerProfile?.availability;
        let loadedDays: AvailableDay[] = [];

        if (
          availability &&
          typeof availability === 'object' &&
          !Array.isArray(availability) &&
          'days' in availability &&
          Array.isArray(availability.days)
        ) {
          const validDays = availability.days.filter(
            (day: unknown): day is AvailableDay =>
              typeof day === 'string' &&
              availabilityOptions.includes(day as AvailableDay),
          );

          loadedDays = [...new Set<AvailableDay>(validDays)];
        }

        setAvailableDays(loadedDays);
        setSavedDays(loadedDays);
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

  async function saveAvailability() {
    if (!user || isSavingAvailability || isLoading) return;

    if (availableDays.length === 0) {
      setAvailabilityError('Select at least one training day.');
      return;
    }

    setIsSavingAvailability(true);
    setAvailabilityError(null);

    try {
      const orderedDays = availabilityOptions.filter((day) =>
        availableDays.includes(day),
      );

      const { error } = await supabase
        .from('trainer_profiles')
        .update({
          availability: { days: orderedDays },
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setAvailableDays(orderedDays);
      setSavedDays(orderedDays);

      Alert.alert('Availability saved', 'Your training days have been updated.');
    } catch (error) {
      console.error('[Trainer Schedule] Unable to save availability:', error);
      setAvailabilityError('Unable to save your availability. Please try again.');
    } finally {
      setIsSavingAvailability(false);
    }
  }

  async function updateBookingStatus(booking: Booking, status: 'confirmed' | 'declined') {
    if (!user) return;

    const action = status === 'confirmed' ? 'confirm' : 'decline';

    setUpdatingBookingId(booking.id);

    try {
      const { data, error } = await supabase
        .from('trainer_bookings')
        .update({ status })
        .eq('id', booking.id)
        .eq('trainer_id', user.id)
        .eq('status', 'pending')
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        Alert.alert(
          'Booking not updated',
          'This request may already have been updated. Refresh the schedule and try again.',
        );
        await loadSchedule(true);
        return;
      }

      await loadSchedule(true);

      Alert.alert(
        status === 'confirmed' ? 'Session confirmed' : 'Request declined',
        status === 'confirmed'
          ? 'The session has been confirmed.'
          : 'The booking request has been declined.',
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
      style={{ flex: 1, backgroundColor: colors.background.primary }}
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
              Select the days you can train clients. Your changes are saved to your
              trainer profile.
            </AppText>

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.brand.red} />
            ) : (
              availabilityOptions.map((day) => {
                const selected = availableDays.includes(day);

                return (
                  <Pressable
                    key={day}
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

            {savedDays.length > 0 ? (
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Saved days: {savedDays.join(', ')}
              </AppText>
            ) : null}
          </View>
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
              Loading your sessions…
            </AppText>
          </View>
        ) : errorMessage ? (
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

              return (
                <View
                  key={booking.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.md,
                  }}
                >
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="caption" color={colors.brand.red}>
                      TRAINR CLIENT
                    </AppText>

                    <AppText variant="h3" color={colors.text.primary}>
                      {clientName || 'TRAINR Client'}
                    </AppText>

                    <AppText variant="body" color={colors.text.secondary}>
                      {formatDate(booking.scheduled_start)}
                    </AppText>

                    <AppText variant="body" color={colors.text.secondary}>
                      {formatTime(booking.scheduled_start)} –{' '}
                      {formatTime(booking.scheduled_end)}
                    </AppText>
                  </View>

                  <View
                    style={{
                      paddingTop: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.border.default,
                      gap: spacing.xs,
                    }}
                  >
                    <AppText variant="h3" color={colors.brand.red}>
                      {formatCurrency(Number(booking.session_rate), booking.currency)}
                    </AppText>

                    <AppText variant="caption" color={colors.text.secondary}>
                      STATUS: {booking.status.toUpperCase()}
                    </AppText>
                  </View>

                  {booking.notes ? (
                    <AppText variant="body" color={colors.text.secondary}>
                      Notes: {booking.notes}
                    </AppText>
                  ) : null}

                  {isPending && activeView === 'Upcoming' ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decline booking"
                        disabled={isUpdating}
                        onPress={() => void updateBookingStatus(booking, 'declined')}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border.default,
                          opacity: isUpdating ? 0.6 : 1,
                        }}
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
                        style={{
                          flex: 1,
                          minHeight: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          backgroundColor: colors.brand.red,
                          opacity: isUpdating ? 0.6 : 1,
                        }}
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
                </View>
              );
            })}
          </View>
        )}

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
