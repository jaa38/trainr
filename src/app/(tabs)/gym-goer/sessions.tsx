import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { submitTrainerReview } from '@/services/trainer-reviews';
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
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBookings = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
        setReviewedBookingIds(new Set());
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

        const completedBookingIds = bookingsWithTrainers
          .filter((booking) => booking.status === 'completed')
          .map((booking) => booking.id);

        if (completedBookingIds.length === 0) {
          setReviewedBookingIds(new Set());
        } else {
          const { data: reviews, error: reviewsError } = await supabase
            .from('trainer_reviews')
            .select('booking_id')
            .eq('gym_goer_id', user.id)
            .in('booking_id', completedBookingIds);

          if (reviewsError) {
            console.error('[Sessions] Unable to load review statuses:', reviewsError);
          } else {
            setReviewedBookingIds(
              new Set((reviews ?? []).map((review) => review.booking_id)),
            );
          }
        }
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

  const openReviewForm = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setReviewRating(0);
    setReviewText('');
    setReviewError(null);
    setReviewSuccess(null);
  };

  const closeReviewForm = () => {
    if (isSubmittingReview) return;

    setReviewBookingId(null);
    setReviewRating(0);
    setReviewText('');
    setReviewError(null);
    setReviewSuccess(null);
  };

  const handleSubmitReview = async (booking: Booking) => {
    if (!user) {
      setReviewError('Please sign in to submit a review.');
      return;
    }

    if (booking.status !== 'completed') {
      setReviewError('You can only review a completed session.');
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a rating from 1 to 5 stars.');
      return;
    }

    if (reviewedBookingIds.has(booking.id)) {
      setReviewError('You have already reviewed this session.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      await submitTrainerReview({
        bookingId: booking.id,
        trainerId: booking.trainer_id,
        rating: reviewRating,
        reviewText: reviewText.trim(),
      });

      setReviewedBookingIds((previous) => {
        const updated = new Set(previous);
        updated.add(booking.id);
        return updated;
      });

      setReviewSuccess('Your review has been submitted successfully.');
      setReviewBookingId(null);
      setReviewRating(0);
      setReviewText('');

      await loadBookings(true);
    } catch (error) {
      console.error('[Sessions] Unable to submit review:', error);

      setReviewError(
        error instanceof Error
          ? error.message
          : 'We couldn’t submit your review. Please try again.',
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

        {reviewSuccess ? (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.brand.red,
              gap: spacing.xs,
            }}
          >
            <AppText variant="body" color={colors.text.primary}>
              {reviewSuccess}
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => setReviewSuccess(null)}>
              <AppText variant="caption" color={colors.brand.red}>
                Dismiss
              </AppText>
            </Pressable>
          </View>
        ) : null}

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

              const isReviewed = reviewedBookingIds.has(booking.id);
              const isReviewFormOpen = reviewBookingId === booking.id;

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

                  {booking.status === 'completed' ? (
                    isReviewed ? (
                      <View
                        style={{
                          padding: spacing.md,
                          borderRadius: 12,
                          backgroundColor: colors.background.primary,
                        }}
                      >
                        <AppText variant="button" color={colors.text.secondary}>
                          ✓ REVIEW SUBMITTED
                        </AppText>
                      </View>
                    ) : (
                      <View style={{ gap: spacing.md }}>
                        {!isReviewFormOpen ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => openReviewForm(booking.id)}
                            style={{
                              minHeight: 48,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 12,
                              backgroundColor: colors.brand.red,
                            }}
                          >
                            <AppText variant="button" color="#FFFFFF">
                              Leave a review
                            </AppText>
                          </Pressable>
                        ) : (
                          <View
                            style={{
                              padding: spacing.md,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: colors.border.default,
                              gap: spacing.md,
                            }}
                          >
                            <AppText variant="h3" color={colors.text.primary}>
                              RATE YOUR SESSION
                            </AppText>
                            <AppText variant="body" color={colors.text.secondary}>
                              How was your experience with this trainer?
                            </AppText>

                            <View
                              accessibilityRole="radiogroup"
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: spacing.sm,
                              }}
                            >
                              {[1, 2, 3, 4, 5].map((star) => {
                                const selected = star <= reviewRating;

                                return (
                                  <Pressable
                                    key={star}
                                    accessibilityRole="radio"
                                    accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
                                    accessibilityState={{
                                      selected: reviewRating === star,
                                    }}
                                    onPress={() => setReviewRating(star)}
                                    disabled={isSubmittingReview}
                                    hitSlop={6}
                                    style={{
                                      minWidth: 40,
                                      minHeight: 44,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <AppText
                                      variant="h2"
                                      color={
                                        selected
                                          ? colors.brand.red
                                          : colors.text.secondary
                                      }
                                    >
                                      {selected ? '★' : '☆'}
                                    </AppText>
                                  </Pressable>
                                );
                              })}
                            </View>

                            <AppText
                              variant="caption"
                              color={colors.text.secondary}
                              style={{ textAlign: 'center' }}
                            >
                              {reviewRating === 0
                                ? 'Select a star rating'
                                : `${reviewRating} out of 5 stars`}
                            </AppText>

                            <TextInput
                              value={reviewText}
                              onChangeText={setReviewText}
                              placeholder="Share your experience (optional)"
                              placeholderTextColor={colors.text.secondary}
                              multiline
                              maxLength={2000}
                              editable={!isSubmittingReview}
                              textAlignVertical="top"
                              accessibilityLabel="Written trainer review"
                              style={{
                                minHeight: 110,
                                padding: spacing.md,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                color: colors.text.primary,
                                backgroundColor: colors.background.primary,
                                fontSize: 15,
                                lineHeight: 22,
                              }}
                            />

                            <AppText
                              variant="caption"
                              color={colors.text.secondary}
                              style={{ textAlign: 'right' }}
                            >
                              {reviewText.length}/2000
                            </AppText>

                            {reviewError ? (
                              <AppText variant="body" color={colors.brand.red}>
                                {reviewError}
                              </AppText>
                            ) : null}

                            <Pressable
                              accessibilityRole="button"
                              disabled={isSubmittingReview}
                              onPress={() => void handleSubmitReview(booking)}
                              style={{
                                minHeight: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                                backgroundColor: colors.brand.red,
                                opacity: isSubmittingReview ? 0.6 : 1,
                              }}
                            >
                              {isSubmittingReview ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <AppText variant="button" color="#FFFFFF">
                                  Submit review
                                </AppText>
                              )}
                            </Pressable>

                            <Pressable
                              accessibilityRole="button"
                              disabled={isSubmittingReview}
                              onPress={closeReviewForm}
                              style={{
                                minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <AppText variant="button" color={colors.text.secondary}>
                                Cancel
                              </AppText>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )
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
