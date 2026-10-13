import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function BookingScreen() {
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const { user, profile } = useAuth();
  const { colors, spacing } = useTrainrTheme();

  const [trainer, setTrainer] = useState<PublishedTrainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadTrainer() {
      try {
        const trainers = await discoverPublishedTrainers();
        const selected = trainers.find((item) => item.trainer_id === trainerId);

        if (!isActive) return;

        if (!selected) {
          setErrorMessage('This trainer is unavailable for booking.');
        } else if (
          selected.session_rate == null ||
          selected.session_duration_minutes == null
        ) {
          setErrorMessage(
            'This trainer has not configured a complete session rate and duration.',
          );
        } else {
          setTrainer(selected);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('[Booking] Unable to load trainer:', error);

        if (isActive) {
          setErrorMessage('Unable to load this trainer. Please try again.');
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

  const trainerName = trainer
    ? [trainer.first_name, trainer.last_name].filter(Boolean).join(' ').trim()
    : 'TRAINR Coach';

  const formatRate = (rate: number, currency: string | null) =>
    `${currency ?? ''} ${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(rate)}`.trim();

  function handleSubmit() {
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
        'Please return to the trainer profile and try again.',
      );
      return;
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime.trim());

    if (!dateMatch) {
      Alert.alert('Check the date', 'Enter a date in YYYY-MM-DD format.');
      return;
    }

    if (!timeMatch) {
      Alert.alert('Check the time', 'Enter a 24-hour start time in HH:MM format.');
      return;
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    const localStart = new Date(year, month - 1, day, hour, minute);

    if (
      localStart.getFullYear() !== year ||
      localStart.getMonth() !== month - 1 ||
      localStart.getDate() !== day
    ) {
      Alert.alert('Check the date', 'Enter a valid calendar date.');
      return;
    }

    const now = new Date();

    if (localStart.getTime() <= now.getTime()) {
      Alert.alert('Choose a future time', 'Your session must start in the future.');
      return;
    }

    const duration = trainer.session_duration_minutes;

    if (!duration || duration <= 0) {
      Alert.alert('Session duration unavailable', 'Please contact the trainer.');
      return;
    }

    const localEnd = new Date(localStart.getTime() + duration * 60_000);

    void submitBooking(localStart.toISOString(), localEnd.toISOString());
  }

  async function submitBooking(scheduledStart: string, scheduledEnd: string) {
    if (!user || !trainer || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('trainer_bookings').insert({
        gym_goer_id: user.id,
        trainer_id: trainer.trainer_id,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        session_rate: trainer.session_rate,
        currency: trainer.currency ?? 'NGN',
        status: 'pending',
        notes: notes.trim() || null,
      });

      if (error) throw error;

      Alert.alert(
        'Request sent',
        `Your session request with ${trainerName} has been sent for confirmation.`,
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error('[Booking] Submission failed:', error);

      Alert.alert(
        'Booking unsuccessful',
        error instanceof Error
          ? error.message
          : 'We could not submit your request. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
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
            Book a session
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Request a training session with your selected coach.
          </AppText>
        </View>

        {!trainerId ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.text.secondary}>
              No trainer was selected. Return to Discover and choose a trainer.
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                minHeight: 50,
                borderRadius: 12,
                backgroundColor: colors.brand.red,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Return to Discover
              </AppText>
            </Pressable>
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
              Loading trainer details…
            </AppText>
          </View>
        ) : errorMessage || !trainer ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage ?? 'This trainer could not be found.'}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                minHeight: 50,
                borderRadius: 12,
                backgroundColor: colors.brand.red,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Return to trainer profile
              </AppText>
            </Pressable>
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
                Final booking is subject to trainer confirmation.
              </AppText>
            </View>

            <Input
              label="Session date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              accessibilityLabel="Session date in year-month-day format"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              helperText="Use your local date, for example 2026-10-20."
              editable={!isSubmitting}
            />

            <Input
              label="Start time"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM (24-hour time)"
              accessibilityLabel="Session start time in 24-hour format"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              helperText="For example, 14:30 for 2:30 PM."
              editable={!isSubmitting}
            />

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

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={{
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: isSubmitting ? colors.text.tertiary : colors.brand.red,
                paddingHorizontal: spacing.lg,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <AppText variant="button" color="#FFFFFF">
                  Send booking request
                </AppText>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
