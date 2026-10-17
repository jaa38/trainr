import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Award, Clock, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

export default function TrainerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;

  const [trainer, setTrainer] = useState<PublishedTrainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrainer = useCallback(async () => {
    if (!id) {
      setTrainer(null);
      setErrorMessage(
        'No trainer was selected. Return to Discover and choose a trainer.',
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const trainers = await discoverPublishedTrainers();
      const selectedTrainer = trainers.find((item) => item.trainer_id === id);
      setTrainer(selectedTrainer ?? null);

      if (!selectedTrainer) {
        setErrorMessage('This trainer profile is unavailable.');
      }
    } catch (error) {
      console.error('[Trainer Profile] Unable to load trainer:', error);
      setErrorMessage('We couldn’t load this trainer’s profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isActive = true;

    async function fetchTrainer() {
      if (!id) {
        if (isActive) {
          setTrainer(null);
          setErrorMessage(
            'No trainer was selected. Return to Discover and choose a trainer.',
          );
          setIsLoading(false);
        }
        return;
      }

      try {
        const trainers = await discoverPublishedTrainers();
        const selectedTrainer = trainers.find((item) => item.trainer_id === id);

        if (isActive) {
          setTrainer(selectedTrainer ?? null);
          setErrorMessage(
            selectedTrainer ? null : 'This trainer profile is unavailable.',
          );
        }
      } catch (error) {
        console.error('[Trainer Profile] Unable to load trainer:', error);
        if (isActive) {
          setErrorMessage('We couldn’t load this trainer’s profile. Please try again.');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void fetchTrainer();
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

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/gym-goer/discover');
    }
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

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
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

                <AppText variant="bodySmall" color={colors.text.secondary} align="center">
                  Personal trainer
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
                onPress={() => {
                  router.push({
                    pathname: '/(tabs)/booking/[trainerId]',
                    params: { trainerId: trainer.trainer_id },
                  });
                }}
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

            {/* Final booking action for long profiles */}
            <Button
              fullWidth
              size="large"
              variant="primary"
              rightIcon={<ArrowRight size={18} color="#FFFFFF" />}
              onPress={() => {
                router.push({
                  pathname: '/(tabs)/booking/[trainerId]',
                  params: { trainerId: trainer.trainer_id },
                });
              }}
            >
              Book a session
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
