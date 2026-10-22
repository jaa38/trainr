import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
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

type BookingPayment = {
  id?: string;
  booking_id: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled';
  initialization_status: string;
};

type PaymentFunctionResponse = {
  paymentId?: string;
  reference?: string;
  authorizationUrl?: string;
  status?: 'pending' | 'successful' | 'failed' | 'cancelled';
  providerStatus?: string;
  initializationStatus?: string;
  recovery?: string;
  error?: string;
  message?: string;
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

function createIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export default function SessionsScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTrainrTheme();

  const [activeTab, setActiveTab] = useState<SessionTab>('Upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Map<string, BookingPayment>>(
    new Map(),
  );
  const [processingPaymentBookingId, setProcessingPaymentBookingId] = useState<
    string | null
  >(null);
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
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const loadBookings = useCallback(
    async (refresh = false) => {
      if (!user) {
        setBookings([]);
        setPaymentStatuses(new Map());
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

        const { data: paymentRows, error: paymentsError } = await supabase
          .from('booking_payments')
          .select('id, booking_id, status, initialization_status, created_at')
          .eq('gym_goer_id', user.id)
          .order('created_at', { ascending: false });

        if (paymentsError) {
          console.error('[Sessions] Unable to load payment statuses:', paymentsError);
          // Preserve the last known statuses when a refresh fails.
        } else {
          const latestPaymentsByBooking = new Map<string, BookingPayment>();

          for (const payment of paymentRows ?? []) {
            if (!latestPaymentsByBooking.has(payment.booking_id)) {
              latestPaymentsByBooking.set(payment.booking_id, payment as BookingPayment);
            }
          }

          setPaymentStatuses(latestPaymentsByBooking);
        }

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

  const handleCancelBooking = (booking: Booking) => {
    if (!user || booking.status === 'cancelled') return;

    Alert.alert(
      'Cancel booking?',
      'Are you sure you want to cancel this training session? This action cannot be undone.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingBookingId(booking.id);

              try {
                const { error } = await supabase.rpc('cancel_trainer_booking', {
                  p_booking_id: booking.id,
                });

                if (error) throw error;

                await loadBookings(true);

                Alert.alert(
                  'Booking cancelled',
                  'Your training session has been cancelled successfully.',
                );
              } catch (error) {
                console.error('[Sessions] Unable to cancel booking:', error);

                Alert.alert(
                  'Unable to cancel booking',
                  error instanceof Error
                    ? error.message
                    : 'We couldn’t cancel this booking. Please refresh and try again.',
                );
              } finally {
                setCancellingBookingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handlePayForBooking = async (booking: Booking) => {
    if (!user || booking.status !== 'confirmed') {
      Alert.alert('Payment unavailable', 'Only confirmed bookings can be paid for.');
      return;
    }

    if (processingPaymentBookingId) return;

    setProcessingPaymentBookingId(booking.id);

    try {
      const { data: existingPayments, error: lookupError } = await supabase
        .from('booking_payments')
        .select('id, booking_id, status, initialization_status, created_at')
        .eq('booking_id', booking.id)
        .eq('gym_goer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lookupError) throw lookupError;

      const existingPayment = existingPayments?.[0];

      if (existingPayment?.status === 'successful') {
        await loadBookings(true);
        Alert.alert('Already paid', 'This booking has already been paid for.');
        return;
      }

      let paymentId: string | undefined = existingPayment?.id;
      let authorizationUrl: string | undefined;

      if (existingPayment?.status === 'pending') {
        if (!paymentId) {
          Alert.alert(
            'Payment needs review',
            'We could not identify the existing payment. Please contact support.',
          );
          return;
        }

        const { data: verification, error: verificationError } =
          await supabase.functions.invoke<PaymentFunctionResponse>('verify-payment', {
            body: { paymentId },
          });

        if (verificationError) {
          Alert.alert(
            'Payment status unavailable',
            'We could not verify your existing payment. No new transaction was created.',
          );
          return;
        }

        if (verification?.status === 'successful') {
          await loadBookings(true);
          Alert.alert(
            'Payment confirmed',
            'Your payment has been verified successfully.',
          );
          return;
        }

        if (verification?.status === 'failed') {
          Alert.alert(
            'Payment failed',
            'Paystack reports that this transaction failed. Please contact support before trying again.',
          );
          return;
        }

        const canResumeCheckout = existingPayment.initialization_status === 'initialized';

        const requiresRecovery =
          existingPayment.initialization_status === 'reconciliation_required';

        if (!canResumeCheckout && !requiresRecovery) {
          Alert.alert(
            'Payment needs review',
            'This payment is not in a state that can safely be recovered. Please contact support.',
          );
          return;
        }

        const { data: recovery, error: recoveryError } =
          await supabase.functions.invoke<PaymentFunctionResponse>('recover-payment', {
            body: { paymentId },
          });

        if (recoveryError) {
          Alert.alert(
            'Checkout unavailable',
            'We could not recover your existing checkout. Please try again later.',
          );
          return;
        }

        if (recovery?.status === 'successful') {
          await loadBookings(true);
          Alert.alert(
            'Payment confirmed',
            'Your payment has been verified successfully.',
          );
          return;
        }

        if (
          recovery?.recovery === 'reconciliation_required' ||
          !recovery?.authorizationUrl
        ) {
          Alert.alert(
            'Payment needs review',
            recovery?.message ??
              'We could not safely recover this checkout. No new transaction was created.',
          );
          return;
        }

        authorizationUrl = recovery.authorizationUrl;
      } else if (!existingPayment) {
        const { data: initialization, error: initializationError } =
          await supabase.functions.invoke<PaymentFunctionResponse>('initiate-payment', {
            body: {
              bookingId: booking.id,
              idempotencyKey: createIdempotencyKey(),
            },
          });

        if (initializationError) {
          Alert.alert(
            'Payment initialization unavailable',
            'Check your payment status before trying again. No automatic retry was made.',
          );
          return;
        }

        if (initialization?.status === 'successful') {
          await loadBookings(true);
          Alert.alert('Already paid', 'This booking has already been paid for.');
          return;
        }

        if (initialization?.error) {
          Alert.alert('Unable to start checkout', initialization.error);
          return;
        }

        paymentId = initialization?.paymentId;
        authorizationUrl = initialization?.authorizationUrl;
      } else {
        Alert.alert(
          'Payment needs review',
          'This payment is not in a state that can safely be retried. No new transaction was created.',
        );
        return;
      }

      if (!paymentId || !authorizationUrl?.startsWith('https://')) {
        Alert.alert(
          'Checkout unavailable',
          'TRAINR could not safely obtain a valid checkout URL.',
        );
        return;
      }

      await WebBrowser.openBrowserAsync(authorizationUrl);

      // Returning from checkout is not proof of payment; verify with Paystack.
      const { data: finalVerification, error: finalVerificationError } =
        await supabase.functions.invoke<PaymentFunctionResponse>('verify-payment', {
          body: { paymentId },
        });

      await loadBookings(true);

      if (finalVerificationError) {
        Alert.alert(
          'Payment status pending',
          'We could not confirm your payment yet. Refresh Sessions later to check again.',
        );
      } else if (finalVerification?.status === 'successful') {
        Alert.alert('Payment successful', 'Your payment has been verified.');
      } else if (finalVerification?.status === 'failed') {
        Alert.alert('Payment failed', 'Paystack reports that this transaction failed.');
      } else {
        Alert.alert(
          'Payment not confirmed',
          'Your payment is still pending. Refresh Sessions to check its status.',
        );
      }
    } catch (error) {
      console.error('[Sessions] Payment action failed:', error);

      Alert.alert(
        'Unable to process payment',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setProcessingPaymentBookingId(null);
    }
  };

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
            <Button variant="primary" fullWidth onPress={() => void loadBookings()}>
              Try again
            </Button>
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
              const payment = paymentStatuses.get(booking.id);
              const isPaid = payment?.status === 'successful';
              const paymentNeedsReview =
                payment?.status === 'failed' || payment?.status === 'cancelled';

              const canPay =
                booking.status === 'confirmed' &&
                new Date(booking.scheduled_start).getTime() > currentTime &&
                !isPaid &&
                !paymentNeedsReview;

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

                    {isPaid ? (
                      <AppText variant="caption" color={colors.text.secondary}>
                        PAYMENT: PAID
                      </AppText>
                    ) : payment?.status === 'pending' ? (
                      <AppText variant="caption" color={colors.text.secondary}>
                        PAYMENT: PENDING
                      </AppText>
                    ) : payment?.status === 'failed' ? (
                      <AppText variant="caption" color={colors.text.secondary}>
                        PAYMENT: FAILED
                      </AppText>
                    ) : null}
                  </View>

                  {booking.notes ? (
                    <AppText variant="body" color={colors.text.secondary}>
                      Notes: {booking.notes}
                    </AppText>
                  ) : null}

                  {canPay ? (
                    <Button
                      variant="primary"
                      fullWidth
                      loading={processingPaymentBookingId === booking.id}
                      disabled={
                        processingPaymentBookingId !== null ||
                        cancellingBookingId !== null
                      }
                      accessibilityLabel={`Pay ${formatCurrency(
                        Number(booking.session_rate),
                        booking.currency,
                      )} for this session`}
                      onPress={() => void handlePayForBooking(booking)}
                    >
                      {payment?.status === 'pending'
                        ? 'Continue payment'
                        : 'Pay for session'}
                    </Button>
                  ) : null}

                  {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  new Date(booking.scheduled_start).getTime() > currentTime ? (
                    <>
                      <Button
                        variant="outline"
                        fullWidth
                        accessibilityLabel="Reschedule booking"
                        disabled={
                          cancellingBookingId !== null ||
                          processingPaymentBookingId !== null
                        }
                        onPress={() =>
                          router.push({
                            pathname: '/(tabs)/booking/[trainerId]',
                            params: {
                              trainerId: booking.trainer_id,
                              bookingId: booking.id,
                            },
                          })
                        }
                      >
                        Reschedule
                      </Button>

                      <Button
                        variant="destructive"
                        fullWidth
                        accessibilityLabel="Cancel booking"
                        disabled={
                          cancellingBookingId !== null ||
                          processingPaymentBookingId !== null
                        }
                        loading={cancellingBookingId === booking.id}
                        onPress={() => handleCancelBooking(booking)}
                      >
                        Cancel booking
                      </Button>
                    </>
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
                          <Button
                            variant="primary"
                            fullWidth
                            onPress={() => openReviewForm(booking.id)}
                          >
                            Leave a review
                          </Button>
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
                                    accessibilityLabel={`${star} ${
                                      star === 1 ? 'star' : 'stars'
                                    }`}
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

                            <Button
                              variant="primary"
                              fullWidth
                              loading={isSubmittingReview}
                              disabled={isSubmittingReview}
                              onPress={() => void handleSubmitReview(booking)}
                            >
                              Submit review
                            </Button>

                            <Button
                              variant="ghost"
                              fullWidth
                              disabled={isSubmittingReview}
                              onPress={closeReviewForm}
                            >
                              Cancel
                            </Button>
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
