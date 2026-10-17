import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Clock,
  MapPin,
  Star,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import {
  getTrainerProfileExtras,
  getTrainerReviews,
  type TrainerProfileExtras,
  type TrainerReview,
} from '@/services/trainer-reviews';
import { useTrainrTheme } from '@/theme';

export default function TrainerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;

  const [trainer, setTrainer] = useState<PublishedTrainer | null>(null);
  const [extras, setExtras] = useState<TrainerProfileExtras | null>(null);
  const [reviews, setReviews] = useState<TrainerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);
      setTrainer(null);
      setExtras(null);
      setReviews([]);

      if (!id) {
        setErrorMessage(
          'No trainer was selected. Return to Discover and choose a trainer.',
        );
        setIsLoading(false);
        return;
      }

      try {
        const trainers = await discoverPublishedTrainers();
        const selectedTrainer = trainers.find((item) => item.trainer_id === id);

        if (!isActive) return;

        if (!selectedTrainer) {
          setErrorMessage('This trainer profile is unavailable.');
          setIsLoading(false);
          return;
        }

        setTrainer(selectedTrainer);
        setIsLoading(false);

        // These requests are independent of the core profile.
        const [extrasResult, reviewsResult] = await Promise.allSettled([
          getTrainerProfileExtras(selectedTrainer.trainer_id),
          getTrainerReviews(selectedTrainer.trainer_id),
        ]);

        if (!isActive) return;

        if (extrasResult.status === 'fulfilled') {
          setExtras(extrasResult.value);
        } else {
          console.error(
            '[Trainer Profile] Unable to load profile extras:',
            extrasResult.reason,
          );
        }

        if (reviewsResult.status === 'fulfilled') {
          setReviews(reviewsResult.value);
        } else {
          console.error(
            '[Trainer Profile] Unable to load reviews:',
            reviewsResult.reason,
          );
        }
      } catch (error) {
        console.error('[Trainer Profile] Unable to load trainer:', error);

        if (isActive) {
          setErrorMessage('We couldn’t load this trainer’s profile. Please try again.');
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [id]);

  const formatRate = (item: PublishedTrainer) => {
    if (item.session_rate == null) return 'Rate not set';

    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(item.session_rate);

    return `${item.currency ?? ''} ${amount}${
      item.session_duration_minutes ? ` / ${item.session_duration_minutes} min` : ''
    }`.trim();
  };

  const fullName = trainer
    ? [trainer.first_name, trainer.last_name].filter(Boolean).join(' ').trim()
    : '';

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'T';

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/gym-goer/discover');
    }
  };

  const renderSection = (title: string, content: string | null | undefined) => {
    if (!content?.trim()) return null;

    return (
      <View
        style={{
          padding: spacing.lg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border.default,
          backgroundColor: colors.background.secondary,
          gap: spacing.sm,
        }}
      >
        <AppText variant="h3" color={colors.text.primary}>
          {title}
        </AppText>
        <AppText variant="body" color={colors.text.secondary}>
          {content}
        </AppText>
      </View>
    );
  };

  const renderPageMessage = (
    title: string,
    message: string,
    actionLabel: string,
    onAction: () => void,
  ) => (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brand.redLight,
        }}
      >
        <ArrowRight size={24} color={colors.brand.red} />
      </View>

      <AppText variant="h2" color={colors.text.primary}>
        {title}
      </AppText>

      <AppText variant="body" color={colors.text.secondary}>
        {message}
      </AppText>

      <Button onPress={onAction} variant="primary" fullWidth>
        {actionLabel}
      </Button>
    </View>
  );

  const renderReviews = () => (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.background.secondary,
        gap: spacing.md,
      }}
    >
      <AppText variant="h3" color={colors.text.primary}>
        Reviews
      </AppText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Star
          size={22}
          color={colors.brand.red}
          fill={(extras?.review_count ?? 0) > 0 ? colors.brand.red : 'transparent'}
        />

        <AppText variant="h2" color={colors.text.primary}>
          {(extras?.average_rating ?? 0).toFixed(1)}
        </AppText>

        <AppText variant="bodySmall" color={colors.text.secondary}>
          ({extras?.review_count ?? 0}{' '}
          {(extras?.review_count ?? 0) === 1 ? 'review' : 'reviews'})
        </AppText>
      </View>

      {reviews.length === 0 ? (
        <AppText variant="body" color={colors.text.secondary}>
          No reviews yet. Reviews will appear here when gym-goers leave feedback for this
          trainer.
        </AppText>
      ) : (
        <View style={{ gap: spacing.md }}>
          {reviews.map((review) => (
            <View
              key={review.id}
              style={{
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border.default,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}
              >
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  TRAINR member
                </AppText>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Star size={14} color={colors.brand.red} fill={colors.brand.red} />
                  <AppText variant="bodySmall" color={colors.text.primary}>
                    {review.rating}/5
                  </AppText>
                </View>
              </View>

              {review.review_text?.trim() ? (
                <AppText variant="body" color={colors.text.primary}>
                  {review.review_text}
                </AppText>
              ) : (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Rating submitted without a written comment.
                </AppText>
              )}

              <AppText variant="caption" color={colors.text.tertiary}>
                {new Date(review.created_at).toLocaleDateString()}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const bookSession = () => {
    if (!trainer) return;

    router.push({
      pathname: '/(tabs)/booking/[trainerId]',
      params: { trainerId: trainer.trainer_id },
    });
  };

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
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Discover"
          onPress={goBack}
          hitSlop={8}
          style={{
            alignSelf: 'flex-start',
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <ArrowLeft size={18} color={colors.text.primary} />
          <AppText variant="button" color={colors.text.primary}>
            Discover
          </AppText>
        </Pressable>

        {isLoading ? (
          <View
            style={{
              minHeight: 320,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />
            <AppText variant="body" color={colors.text.secondary}>
              Loading trainer profile…
            </AppText>
          </View>
        ) : errorMessage || !trainer ? (
          renderPageMessage(
            'Profile unavailable',
            errorMessage ?? 'This trainer profile could not be found.',
            'Return to Discover',
            goBack,
          )
        ) : (
          <>
            {/* Profile hero */}
            <View
              style={{
                padding: spacing.xl,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.background.secondary,
                alignItems: 'center',
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

              {trainer.avatar_url ? (
                <Image
                  source={{ uri: trainer.avatar_url }}
                  accessibilityLabel={`Profile photo of ${fullName || 'TRAINR Coach'}`}
                  resizeMode="cover"
                  style={{
                    width: 124,
                    height: 124,
                    borderRadius: 62,
                    backgroundColor: colors.background.primary,
                    borderWidth: 2,
                    borderColor: colors.border.default,
                  }}
                />
              ) : (
                <View
                  accessibilityLabel="Trainer profile initials"
                  style={{
                    width: 124,
                    height: 124,
                    borderRadius: 62,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.background.primary,
                    borderWidth: 2,
                    borderColor: colors.border.default,
                  }}
                >
                  <AppText variant="displayLarge" color={colors.brand.red}>
                    {initials}
                  </AppText>
                </View>
              )}

              <View
                style={{
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <AppText
                  variant="displayLarge"
                  color={colors.text.primary}
                  align="center"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  {fullName || 'TRAINR Coach'}
                </AppText>

                {extras?.verification_status === 'verified' ? (
                  <View
                    accessibilityLabel="Verified trainer"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    <BadgeCheck size={17} color={colors.brand.red} />
                    <AppText variant="bodySmall" color={colors.brand.red}>
                      Verified trainer
                    </AppText>
                  </View>
                ) : null}

                <AppText variant="bodySmall" color={colors.text.secondary} align="center">
                  Personal trainer
                </AppText>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                  }}
                >
                  <Star
                    size={16}
                    color={colors.brand.red}
                    fill={
                      (extras?.review_count ?? 0) > 0 ? colors.brand.red : 'transparent'
                    }
                  />
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    {(extras?.average_rating ?? 0).toFixed(1)} (
                    {extras?.review_count ?? 0}{' '}
                    {(extras?.review_count ?? 0) === 1 ? 'review' : 'reviews'})
                  </AppText>
                </View>

                {trainer.location ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    <MapPin size={16} color={colors.text.secondary} />
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      {trainer.location}
                    </AppText>
                  </View>
                ) : null}
              </View>

              {trainer.years_experience != null ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                  }}
                >
                  <Clock size={16} color={colors.text.secondary} />
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    {trainer.years_experience}{' '}
                    {trainer.years_experience === 1 ? 'year' : 'years'} of experience
                  </AppText>
                </View>
              ) : null}

              {/* Session rate */}
              <View
                style={{
                  width: '100%',
                  marginTop: spacing.sm,
                  padding: spacing.lg,
                  borderRadius: 16,
                  backgroundColor: colors.background.primary,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  gap: spacing.xs,
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color={colors.text.secondary}>
                  SESSION RATE
                </AppText>
                <AppText variant="h2" color={colors.brand.red} align="center">
                  {formatRate(trainer)}
                </AppText>
              </View>

              <Button
                fullWidth
                size="large"
                variant="primary"
                rightIcon={<ArrowRight size={18} color="#FFFFFF" />}
                onPress={bookSession}
              >
                Book a session
              </Button>

              <AppText
                variant="caption"
                color={colors.text.tertiary}
                style={{ textAlign: 'center' }}
              >
                Booking will be available once session scheduling is implemented.
              </AppText>
            </View>

            {/* Training formats */}
            {extras?.training_formats && extras.training_formats.length > 0 ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.md,
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  Training formats
                </AppText>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                  }}
                >
                  {extras.training_formats.map((format) => (
                    <View
                      key={format}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: 999,
                        backgroundColor: colors.brand.redLight,
                      }}
                    >
                      <AppText variant="bodySmall" color={colors.brand.red}>
                        {format}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* About */}
            {renderSection('About the trainer', trainer.professional_bio)}

            {/* Specialties */}
            {trainer.specialities?.length ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.md,
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  Specialties
                </AppText>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                  }}
                >
                  {trainer.specialities.map((specialty) => (
                    <View
                      key={specialty}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: 999,
                        backgroundColor: colors.brand.redLight,
                      }}
                    >
                      <AppText variant="bodySmall" color={colors.brand.red}>
                        {specialty}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {trainer.qualifications?.length
              ? renderSection('Qualifications', trainer.qualifications.join(' · '))
              : null}

            {/* Certifications */}
            {trainer.certifications?.length ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <Award size={20} color={colors.brand.red} />
                  <AppText variant="h3" color={colors.text.primary}>
                    Certifications
                  </AppText>
                </View>

                <View style={{ gap: spacing.sm }}>
                  {trainer.certifications.map((certification, index) => (
                    <View
                      key={`${certification}-${index}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.brand.red,
                          marginTop: 7,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" color={colors.text.primary}>
                          {certification}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {renderSection('Coaching approach', trainer.coaching_approach)}

            {/* Reviews */}
            {renderReviews()}

            {/* Final booking action */}
            <Button
              fullWidth
              size="large"
              variant="primary"
              rightIcon={<ArrowRight size={18} color="#FFFFFF" />}
              onPress={bookSession}
            >
              Book a session
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
