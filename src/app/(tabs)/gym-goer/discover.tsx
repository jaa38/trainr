import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Input } from '@/components/Input';
import {
  TrainerFilters,
  type FitnessGoal,
  type TrainingDay,
} from '@/components/TrainerFilters';
import type { TrainerSpecialty } from '@/components/TrainerSpecialtyFilters';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { getSpecialtiesForFitnessGoals } from '@/services/fitness-goal-matching';
import {
  discoverPublishedTrainers,
  type PublishedTrainer,
} from '@/services/trainer-discovery';
import { useTrainrTheme } from '@/theme';

export default function DiscoverScreen() {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;
  const { user } = useAuth();

  const [savedFitnessGoals, setSavedFitnessGoals] = useState<string[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  const [trainers, setTrainers] = useState<PublishedTrainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<TrainerSpecialty[]>([]);
  const [selectedFitnessGoals, setSelectedFitnessGoals] = useState<FitnessGoal[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

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

  useEffect(() => {
    let isActive = true;

    async function loadSavedFitnessGoals() {
      if (!user) {
        setSavedFitnessGoals([]);
        setGoalsError(null);
        setIsLoadingGoals(false);
        return;
      }

      setIsLoadingGoals(true);
      setGoalsError(null);

      try {
        const { data, error } = await supabase
          .from('gym_goer_fitness_goals')
          .select('goal')
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        if (isActive) {
          setSavedFitnessGoals((data ?? []).map((item) => item.goal));
        }
      } catch (error) {
        console.error('[Discover] Unable to load saved fitness goals:', error);

        if (isActive) {
          setGoalsError('We couldn’t load your saved fitness goals.');
        }
      } finally {
        if (isActive) {
          setIsLoadingGoals(false);
        }
      }
    }

    void loadSavedFitnessGoals();

    return () => {
      isActive = false;
    };
  }, [user]);

  const availableLocations = useMemo(
    () =>
      [
        ...new Set(
          trainers
            .map((trainer) => trainer.location?.trim())
            .filter((location): location is string => Boolean(location)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [trainers],
  );

  const availableCurrencies = useMemo(
    () =>
      [
        ...new Set(
          trainers
            .filter(
              (trainer) =>
                trainer.session_rate != null && Boolean(trainer.currency?.trim()),
            )
            .map((trainer) => trainer.currency!.trim().toUpperCase()),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [trainers],
  );

  // Use the selected currency when it remains available.
  // Otherwise, fall back to the first available currency without updating state in an effect.
  const effectiveCurrency =
    selectedCurrency && availableCurrencies.includes(selectedCurrency)
      ? selectedCurrency
      : (availableCurrencies[0] ?? null);

  const onToggleSpecialty = useCallback((specialty: TrainerSpecialty) => {
    setSelectedSpecialties((current) =>
      current.includes(specialty)
        ? current.filter((item) => item !== specialty)
        : [...current, specialty],
    );
  }, []);

  const onClearSpecialties = useCallback(() => {
    setSelectedSpecialties([]);
  }, []);

  const onToggleFitnessGoal = useCallback((goal: FitnessGoal) => {
    setSelectedFitnessGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal],
    );
  }, []);

  const onClearFitnessGoals = useCallback(() => {
    setSelectedFitnessGoals([]);
  }, []);

  const onClearPrice = useCallback(() => {
    setMinimumPrice('');
    setMaximumPrice('');
  }, []);

  const onClearAllFilters = useCallback(() => {
    onClearSpecialties();
    onClearFitnessGoals();
    setSelectedLocation(null);
    setSelectedDay(null);
    onClearPrice();
  }, [onClearSpecialties, onClearFitnessGoals, onClearPrice]);

  const filteredTrainers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const goalSpecialties = getSpecialtiesForFitnessGoals(selectedFitnessGoals).map(
      (specialty) => specialty.toLowerCase(),
    );

    const savedGoalSpecialties = getSpecialtiesForFitnessGoals(savedFitnessGoals).map(
      (specialty) => specialty.toLowerCase(),
    );

    const hasPriceFilter = minimumPrice.trim() !== '' || maximumPrice.trim() !== '';

    const minimum = minimumPrice.trim() === '' ? null : Number(minimumPrice);
    const maximum = maximumPrice.trim() === '' ? null : Number(maximumPrice);

    const validPriceRange =
      (minimum === null || (Number.isFinite(minimum) && minimum >= 0)) &&
      (maximum === null || (Number.isFinite(maximum) && maximum >= 0)) &&
      !(minimum !== null && maximum !== null && minimum > maximum);

    const matchingTrainers = trainers.filter((trainer) => {
      const fullName = [trainer.first_name, trainer.last_name].filter(Boolean).join(' ');

      const searchableFields = [
        fullName,
        trainer.professional_bio,
        trainer.location,
        ...(trainer.specialities ?? []),
        ...(trainer.qualifications ?? []),
        ...(trainer.certifications ?? []),
      ];

      const matchesSearch =
        !query || searchableFields.some((field) => field?.toLowerCase().includes(query));

      const trainerSpecialties = (trainer.specialities ?? []).map((specialty) =>
        specialty.toLowerCase(),
      );

      const matchesSpecialty =
        selectedSpecialties.length === 0 ||
        selectedSpecialties.some((specialty) =>
          trainerSpecialties.some(
            (trainerSpecialty) =>
              trainerSpecialty.includes(specialty.toLowerCase()) ||
              specialty.toLowerCase().includes(trainerSpecialty),
          ),
        );

      const matchesFitnessGoal =
        selectedFitnessGoals.length === 0 ||
        goalSpecialties.some((goalSpecialty) =>
          trainerSpecialties.some(
            (trainerSpecialty) =>
              trainerSpecialty.includes(goalSpecialty) ||
              goalSpecialty.includes(trainerSpecialty),
          ),
        );

      const matchesLocation =
        !selectedLocation || trainer.location?.trim() === selectedLocation;

      const trainerDays = (trainer.availability?.days ?? []).map((day) =>
        day.trim().toLowerCase(),
      );
      const matchesDay = !selectedDay || trainerDays.includes(selectedDay.toLowerCase());

      const trainerCurrency = (trainer.currency ?? '').trim().toUpperCase();

      const matchesPrice =
        !hasPriceFilter ||
        (validPriceRange &&
          effectiveCurrency !== null &&
          trainer.session_rate !== null &&
          trainerCurrency === effectiveCurrency &&
          (minimum === null || trainer.session_rate >= minimum) &&
          (maximum === null || trainer.session_rate <= maximum));

      return (
        matchesSearch &&
        matchesSpecialty &&
        matchesFitnessGoal &&
        matchesLocation &&
        matchesDay &&
        matchesPrice
      );
    });

    return matchingTrainers
      .map((trainer) => {
        const trainerSpecialties = (trainer.specialities ?? []).map((specialty) =>
          specialty.toLowerCase(),
        );

        const relevanceScore = savedGoalSpecialties.filter((goalSpecialty) =>
          trainerSpecialties.some(
            (trainerSpecialty) =>
              trainerSpecialty.includes(goalSpecialty) ||
              goalSpecialty.includes(trainerSpecialty),
          ),
        ).length;

        return { trainer, relevanceScore };
      })
      .sort((a, b) => {
        const relevanceDifference = b.relevanceScore - a.relevanceScore;

        if (relevanceDifference !== 0) {
          return relevanceDifference;
        }

        const firstNameDifference = (a.trainer.first_name ?? '').localeCompare(
          b.trainer.first_name ?? '',
        );

        if (firstNameDifference !== 0) {
          return firstNameDifference;
        }

        return (a.trainer.last_name ?? '').localeCompare(b.trainer.last_name ?? '');
      })
      .map(({ trainer }) => trainer);
  }, [
    trainers,
    searchQuery,
    selectedSpecialties,
    selectedFitnessGoals,
    selectedLocation,
    selectedDay,
    savedFitnessGoals,
    minimumPrice,
    maximumPrice,
    effectiveCurrency,
  ]);

  const savedGoalSpecialties = useMemo(
    () =>
      getSpecialtiesForFitnessGoals(savedFitnessGoals).map((specialty) =>
        specialty.toLowerCase(),
      ),
    [savedFitnessGoals],
  );

  const isTrainerRecommended = useCallback(
    (trainer: PublishedTrainer) => {
      const trainerSpecialties = (trainer.specialities ?? []).map((specialty) =>
        specialty.toLowerCase(),
      );

      return savedGoalSpecialties.some((goalSpecialty) =>
        trainerSpecialties.some(
          (trainerSpecialty) =>
            trainerSpecialty.includes(goalSpecialty) ||
            goalSpecialty.includes(trainerSpecialty),
        ),
      );
    },
    [savedGoalSpecialties],
  );

  const recommendedTrainers = useMemo(
    () => filteredTrainers.filter(isTrainerRecommended),
    [filteredTrainers, isTrainerRecommended],
  );

  const otherTrainers = useMemo(
    () =>
      filteredTrainers
        .filter((trainer) => !isTrainerRecommended(trainer))
        .sort((a, b) => {
          const firstNameDifference = (a.first_name ?? '').localeCompare(
            b.first_name ?? '',
          );

          if (firstNameDifference !== 0) {
            return firstNameDifference;
          }

          return (a.last_name ?? '').localeCompare(b.last_name ?? '');
        }),
    [filteredTrainers, isTrainerRecommended],
  );

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

  const renderTrainerCard = (trainer: PublishedTrainer) => {
    const fullName = [trainer.first_name, trainer.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    const isRecommended = isTrainerRecommended(trainer);

    return (
      <Pressable
        key={trainer.trainer_id}
        accessibilityRole="button"
        accessibilityLabel={`View profile for ${fullName || 'TRAINR Coach'}`}
        onPress={() => {
          router.push({
            pathname: '/(tabs)/trainer-profile/[id]',
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          {trainer.avatar_url ? (
            <Image
              source={{ uri: trainer.avatar_url }}
              accessibilityLabel={`Profile photo of ${fullName || 'TRAINR Coach'}`}
              resizeMode="cover"
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: colors.background.primary,
              }}
            />
          ) : (
            <View
              accessibilityLabel="Default trainer profile image"
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background.primary,
                borderWidth: 1,
                borderColor: colors.border.default,
              }}
            >
              <AppText variant="h2" color={colors.brand.red}>
                {fullName.charAt(0).toUpperCase() || 'T'}
              </AppText>
            </View>
          )}

          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="h3" color={colors.text.primary}>
              {fullName || 'TRAINR Coach'}
            </AppText>

            {trainer.location ? (
              <AppText variant="bodySmall" color={colors.text.secondary}>
                {trainer.location}
              </AppText>
            ) : null}
          </View>
        </View>

        {isRecommended ? (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: theme.radius.md,
              backgroundColor: colors.brand.redLight,
            }}
          >
            <AppText variant="caption" color={colors.brand.red}>
              RECOMMENDED FOR YOU
            </AppText>
          </View>
        ) : null}

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
            {trainer.years_experience} {trainer.years_experience === 1 ? 'year' : 'years'}{' '}
            of experience
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
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedSpecialties.length > 0 ||
    selectedFitnessGoals.length > 0 ||
    selectedLocation !== null ||
    selectedDay !== null ||
    minimumPrice.trim() !== '' ||
    maximumPrice.trim() !== '';

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
            style={{
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
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

        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          {/* Search field and main filter button */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Input
                accessibilityLabel="Search trainers"
                placeholder="Search trainers, skills, or location"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
              />
            </View>

            <View
              style={{
                width: theme.sizes.inputHeight,
                flexShrink: 0,
              }}
            >
              <TrainerFilters
                showMainFilterButton
                mainFilterButtonOnly
                selectedSpecialties={selectedSpecialties}
                selectedGoals={selectedFitnessGoals}
                locations={availableLocations}
                selectedLocation={selectedLocation}
                selectedDay={selectedDay}
                minimumPrice={minimumPrice}
                maximumPrice={maximumPrice}
                availableCurrencies={availableCurrencies}
                selectedCurrency={effectiveCurrency}
                onMinimumPriceChange={setMinimumPrice}
                onMaximumPriceChange={setMaximumPrice}
                onSelectCurrency={setSelectedCurrency}
                onToggleSpecialty={onToggleSpecialty}
                onToggleGoal={onToggleFitnessGoal}
                onSelectLocation={setSelectedLocation}
                onSelectDay={setSelectedDay}
                onClearPrice={onClearPrice}
                onClearAll={onClearAllFilters}
              />
            </View>
          </View>

          {/* Location, Day and Price chips */}
          <TrainerFilters
            showMainFilterButton={false}
            selectedSpecialties={selectedSpecialties}
            selectedGoals={selectedFitnessGoals}
            locations={availableLocations}
            selectedLocation={selectedLocation}
            selectedDay={selectedDay}
            minimumPrice={minimumPrice}
            maximumPrice={maximumPrice}
            availableCurrencies={availableCurrencies}
            selectedCurrency={effectiveCurrency}
            onMinimumPriceChange={setMinimumPrice}
            onMaximumPriceChange={setMaximumPrice}
            onSelectCurrency={setSelectedCurrency}
            onToggleSpecialty={onToggleSpecialty}
            onToggleGoal={onToggleFitnessGoal}
            onSelectLocation={setSelectedLocation}
            onSelectDay={setSelectedDay}
            onClearPrice={onClearPrice}
            onClearAll={onClearAllFilters}
          />
        </View>

        {!isLoadingGoals && !goalsError && savedFitnessGoals.length > 0 ? (
          <AppText variant="bodySmall" color={colors.text.secondary}>
            Your saved fitness goals are ready for personalised recommendations.
          </AppText>
        ) : null}

        {goalsError ? (
          <AppText variant="bodySmall" color={colors.text.secondary}>
            {goalsError}
          </AppText>
        ) : null}

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
        ) : filteredTrainers.length === 0 ? (
          <View
            style={{
              padding: spacing.xl,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              No trainers found
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              No trainers match your current search and filters. Try changing your search
              or filters.
            </AppText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search and filters"
              onPress={() => {
                setSearchQuery('');
                onClearAllFilters();
              }}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.brand.red,
                paddingHorizontal: spacing.lg,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Clear search and filters
              </AppText>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.xl }}>
            {recommendedTrainers.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="h2" color={colors.text.primary}>
                    RECOMMENDED FOR YOU
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Trainers matched to your saved fitness goals.
                  </AppText>
                </View>

                {recommendedTrainers.map(renderTrainerCard)}
              </View>
            ) : null}

            {otherTrainers.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="h2" color={colors.text.primary}>
                    {recommendedTrainers.length > 0
                      ? 'EXPLORE ALL TRAINERS'
                      : hasActiveFilters
                        ? `SEARCH RESULTS (${otherTrainers.length})`
                        : `AVAILABLE TRAINERS (${otherTrainers.length})`}
                  </AppText>

                  {recommendedTrainers.length > 0 ? (
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      Discover other trainers and their areas of expertise.
                    </AppText>
                  ) : null}
                </View>

                {otherTrainers.map(renderTrainerCard)}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
