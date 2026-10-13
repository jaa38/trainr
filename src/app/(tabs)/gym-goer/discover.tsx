import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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

export default function DiscoverScreen() {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;

  const [trainers, setTrainers] = useState<PublishedTrainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrainers = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const results = await discoverPublishedTrainers();
      setTrainers(results);
    } catch (error) {
      console.error('[Discover] Unable to load trainers:', error);
      setErrorMessage('We couldn’t load trainers right now. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function fetchTrainers() {
      try {
        const results = await discoverPublishedTrainers();

        if (isActive) {
          setTrainers(results);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('[Discover] Unable to load trainers:', error);

        if (isActive) {
          setErrorMessage('We couldn’t load trainers right now. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchTrainers();

    return () => {
      isActive = false;
    };
  }, []);

  const formatRate = (trainer: PublishedTrainer) => {
    if (trainer.session_rate == null) {
      return 'Rate not set';
    }

    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(trainer.session_rate);

    return `${trainer.currency ?? ''} ${amount}${
      trainer.session_duration_minutes ? ` / ${trainer.session_duration_minutes} min` : ''
    }`.trim();
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
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadTrainers(true)}
            tintColor={colors.brand.red}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.sm }}>
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}
          >
            FIND YOUR COACH
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            DISCOVER
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ lineHeight: 24 }}
          >
            Meet qualified trainers who can help you work towards your fitness goals.
          </AppText>
        </View>

        {isLoading ? (
          <View
            style={{
              minHeight: 220,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand.red} />
            <AppText variant="body" color={colors.text.secondary}>
              Finding published trainers…
            </AppText>
          </View>
        ) : errorMessage ? (
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
              Trainers unavailable
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              {errorMessage}
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => void loadTrainers()}
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
        ) : trainers.length === 0 ? (
          <View
            style={{
              padding: spacing.xl,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.sm,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              No trainers yet
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Published trainer profiles will appear here. Check back soon.
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="h2" color={colors.text.primary}>
              AVAILABLE TRAINERS ({trainers.length})
            </AppText>

            {trainers.map((trainer) => {
              const fullName = [trainer.first_name, trainer.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              return (
                <Pressable
                  key={trainer.trainer_id}
                  accessibilityRole="button"
                  accessibilityLabel={`View profile for ${fullName || 'TRAINR Coach'}`}
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/gym-goer/trainer/[id]',
                      params: { id: trainer.trainer_id },
                    });
                  }}
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
                    <AppText variant="h3" color={colors.text.primary}>
                      {fullName || 'TRAINR Coach'}
                    </AppText>

                    {trainer.location ? (
                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {trainer.location}
                      </AppText>
                    ) : null}
                  </View>

                  {trainer.professional_bio ? (
                    <AppText
                      variant="body"
                      color={colors.text.secondary}
                      style={{ lineHeight: 22 }}
                    >
                      {trainer.professional_bio}
                    </AppText>
                  ) : null}

                  {trainer.specialities?.length ? (
                    <View style={{ gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.text.tertiary}>
                        SPECIALTIES
                      </AppText>
                      <AppText variant="body" color={colors.text.primary}>
                        {trainer.specialities.join(' · ')}
                      </AppText>
                    </View>
                  ) : null}

                  {trainer.years_experience != null ? (
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      {trainer.years_experience}{' '}
                      {trainer.years_experience === 1 ? 'year' : 'years'} of experience
                    </AppText>
                  ) : null}

                  <View
                    style={{
                      paddingTop: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.border.default,
                    }}
                  >
                    <AppText variant="h3" color={colors.brand.red}>
                      {formatRate(trainer)}
                    </AppText>
                  </View>

                  <AppText variant="button" color={colors.brand.red}>
                    View profile →
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
