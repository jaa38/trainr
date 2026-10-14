import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

type SessionTab = 'Upcoming' | 'History';

type Booking = {
  id: string;
  trainer_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_rate: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  notes: string | null;
  trainer: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const HISTORY_STATUSES = ['declined', 'cancelled', 'completed'];

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

function formatStatus(status: Booking['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function SessionsScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTrainrTheme();

  const [activeTab, setActiveTab] = useState<SessionTab>('Upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBookings = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setErrorMessage(null);
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
            'id, trainer_id, scheduled_start, scheduled_end, session_rate, currency, status, notes',
          )
          .eq('gym_goer_id', user.id)
          .order('scheduled_start', { ascending: true });

        if (error) throw error;

        const bookingRows = data ?? [];

        const { data: trainerProfiles, error: profilesError } = await supabase.rpc(
          'get_booked_trainer_names',
        );

        if (profilesError) throw profilesError;

        type TrainerProfileName = {
          trainer_id: string;
          first_name: string | null;
          last_name: string | null;
        };

        const profilesById = new Map(
          ((trainerProfiles ?? []) as TrainerProfileName[]).map((profile) => [
            profile.trainer_id,
            {
              first_name: profile.first_name,
              last_name: profile.last_name,
            },
          ]),
        );

        const bookingsWithTrainers: Booking[] = bookingRows.map((booking) => ({
          ...booking,
          trainer: profilesById.get(booking.trainer_id) ?? null,
        })) as Booking[];

        setBookings(bookingsWithTrainers);
      } catch (error) {
        console.error('[Sessions] Unable to load bookings:', error);
        setErrorMessage('We couldn’t load your bookings. Please try again.');
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

  const visibleBookings = bookings.filter((booking) => {
    if (activeTab === 'History') {
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
            YOUR BOOKINGS
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            SESSIONS.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Your training appointments, all in one place.
          </AppText>
        </View>

        <View
          style={{
            flexDirection: 'row',
            padding: 4,
            borderRadius: 14,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          {(['Upcoming', 'History'] as const).map((tab) => {
            const selected = activeTab === tab;

            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 10,
                  backgroundColor: selected ? colors.brand.red : 'transparent',
                }}
              >
                <AppText
                  variant="button"
                  color={selected ? '#FFFFFF' : colors.text.secondary}
                >
                  {tab}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
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
              Bookings unavailable
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => void loadBookings()}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
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
              alignItems: 'center',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              {activeTab === 'Upcoming' ? 'NO UPCOMING SESSIONS' : 'NO SESSION HISTORY'}
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              {activeTab === 'Upcoming'
                ? 'Your pending requests and confirmed sessions will appear here.'
                : 'Declined, cancelled and completed sessions will appear here.'}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="h2" color={colors.text.primary}>
              {activeTab === 'Upcoming' ? 'UPCOMING BOOKINGS' : 'SESSION HISTORY'} (
              {visibleBookings.length})
            </AppText>

            {visibleBookings.map((booking) => {
              const trainerName = [
                booking.trainer?.first_name,
                booking.trainer?.last_name,
              ]
                .filter(Boolean)
                .join(' ')
                .trim();

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
                      TRAINR COACH
                    </AppText>

                    <AppText variant="h3" color={colors.text.primary}>
                      {trainerName || 'TRAINR Coach'}
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
                      STATUS: {formatStatus(booking.status).toUpperCase()}
                    </AppText>
                  </View>

                  {booking.notes ? (
                    <AppText variant="body" color={colors.text.secondary}>
                      Notes: {booking.notes}
                    </AppText>
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
            BEFORE YOUR SESSION
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            • Check your appointment details.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            • Arrive ready to train.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            • Contact your trainer if plans change.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
