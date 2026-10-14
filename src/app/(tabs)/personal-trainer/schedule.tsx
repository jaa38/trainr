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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
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

      try {
        const { data, error } = await supabase
          .from('trainer_bookings')
          .select(
            'id, gym_goer_id, scheduled_start, scheduled_end, session_rate, currency, status, notes',
          )
          .eq('trainer_id', user.id)
          .order('scheduled_start', { ascending: true });

        if (error) throw error;

        const bookingRows = data ?? [];
        const clientIds = [...new Set(bookingRows.map((booking) => booking.gym_goer_id))];

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

        const bookingsWithClients: Booking[] = bookingRows.map((booking) => ({
          ...booking,
          client: profilesById.get(booking.gym_goer_id) ?? null,
        })) as Booking[];

        setBookings(bookingsWithClients);
      } catch (error) {
        console.error('[Trainer Schedule] Unable to load bookings:', error);
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
      void loadBookings();
    }, [loadBookings]),
  );

  const updateBookingStatus = async (
    booking: Booking,
    status: 'confirmed' | 'declined',
  ) => {
    const action = status === 'confirmed' ? 'confirm' : 'decline';

    setUpdatingBookingId(booking.id);

    try {
      const { data, error } = await supabase
        .from('trainer_bookings')
        .update({ status })
        .eq('id', booking.id)
        .eq('trainer_id', user?.id ?? '')
        .eq('status', 'pending')
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        Alert.alert(
          'Booking not updated',
          'This request may already have been updated. Refresh the schedule and try again.',
        );
        await loadBookings(true);
        return;
      }

      await loadBookings(true);
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
  };

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
            onRefresh={() => void loadBookings(true)}
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
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              TRAINING DAYS
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              Your configured training days are saved in your trainer profile. You can
              review and update them through your onboarding settings.
            </AppText>
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
              onPress={() => void loadBookings()}
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
