import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

export default function TrainerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTrainrTheme();

  const [trainer, setTrainer] = useState<PublishedTrainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTrainer() {
      try {
        const trainers = await discoverPublishedTrainers();

        const selectedTrainer = trainers.find(
          (item) => item.trainer_id === id,
        );

        if (isActive) {
          setTrainer(selectedTrainer ?? null);

          if (!selectedTrainer) {
            setErrorMessage('This trainer profile is unavailable.');
          } else {
            setErrorMessage(null);
          }
        }
      } catch (error) {
        console.error(
          '[Trainer Profile] Unable to load trainer:',
          error,
        );

        if (isActive) {
          setErrorMessage(
            'We couldn’t load this trainer’s profile. Please try again.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    if (id) {
      void loadTrainer();
    }

    return () => {
      isActive = false;
    };
  }, [id]);

  const formatRate = (item: PublishedTrainer) => {
    if (item.session_rate == null) {
      return 'Rate not set';
    }

    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(item.session_rate);

    return `${item.currency ?? ''} ${amount}${
      item.session_duration_minutes
        ? ` / ${item.session_duration_minutes} min`
        : ''
    }`.trim();
  };

  const fullName = trainer
    ? [trainer.first_name, trainer.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';

  function renderSection(
    title: string,
    content: string | null | undefined,
  ) {
    if (!content) {
      return null;
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" color={colors.text.tertiary}>
          {title.toUpperCase()}
        </AppText>

        <AppText variant="body" color={colors.text.primary}>
          {content}
        </AppText>
      </View>
    );
  }

  function renderBackButton(label = '← Back to Discover') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to Discover"
        onPress={() => router.back()}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: spacing.sm,
        }}
      >
        <AppText variant="button" color={colors.brand.red}>
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
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {renderBackButton()}

        {!id ? (
          <View
            style={{
              gap: spacing.md,
              paddingVertical: spacing.xl,
            }}
          >
            <AppText variant="h2" color={colors.text.primary}>
              No trainer selected
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Return to Discover and select a trainer to view their profile.
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.brand.red,
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
              minHeight: 260,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator
              size="large"
              color={colors.brand.red}
            />

            <AppText variant="body" color={colors.text.secondary}>
              Loading trainer profile…
            </AppText>
          </View>
        ) : errorMessage || !trainer ? (
          <View
            style={{
              paddingVertical: spacing.xl,
              gap: spacing.md,
            }}
          >
            <AppText variant="h2" color={colors.text.primary}>
              Profile unavailable
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage ?? 'This trainer profile could not be found.'}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Return to Discover
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
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
              <AppText
                variant="caption"
                color={colors.brand.red}
                style={{ letterSpacing: 1.5 }}
              >
                TRAINR COACH
              </AppText>

              <AppText
                variant="displayLarge"
                color={colors.text.primary}
              >
                {fullName || 'TRAINR Coach'}
              </AppText>

              {trainer.location
                ? renderSection('Location', trainer.location)
                : null}

              {trainer.years_experience != null ? (
                <AppText
                  variant="body"
                  color={colors.text.secondary}
                >
                  {trainer.years_experience}{' '}
                  {trainer.years_experience === 1
                    ? 'year'
                    : 'years'}{' '}
                  of experience
                </AppText>
              ) : null}

              <View
                style={{
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border.default,
                  gap: spacing.xs,
                }}
              >
                <AppText
                  variant="caption"
                  color={colors.text.secondary}
                >
                  SESSION RATE
                </AppText>

                <AppText variant="h2" color={colors.brand.red}>
                  {formatRate(trainer)}
                </AppText>
              </View>
            </View>

            {renderSection(
              'About the trainer',
              trainer.professional_bio,
            )}

            {trainer.specialities?.length
              ? renderSection(
                  'Specialties',
                  trainer.specialities.join(' · '),
                )
              : null}

            {trainer.qualifications?.length
              ? renderSection(
                  'Qualifications',
                  trainer.qualifications.join(' · '),
                )
              : null}

            {trainer.certifications?.length
              ? renderSection(
                  'Certifications',
                  trainer.certifications.join(' · '),
                )
              : null}

            {renderSection(
              'Coaching approach',
              trainer.coaching_approach,
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                // Connect the booking flow in a later step.
              }}
              style={{
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: colors.brand.red,
                paddingHorizontal: spacing.lg,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Book a session
              </AppText>
            </Pressable>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
            >
              Booking will be available once session scheduling is implemented.
            </AppText>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}