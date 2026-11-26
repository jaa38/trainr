
import { router, useFocusEffect } from 'expo-router';
import {
  Activity,
  ArrowLeft,
  Dumbbell,
  Flag,
  Trophy,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { getFitnessGoals } from '@/services/fitness-goals';
import { getPersonalRecords } from '@/services/personal-records';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { useTrainrTheme } from '@/theme';
import type {
  FitnessGoal,
  PersonalRecord,
  PersonalWorkout,
  PersonalWorkoutCategory,
} from '@/types/personal-workouts';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return 'Duration not recorded';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0
    ? `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} sec` : ''}`
    : `${remainingSeconds} sec`;
}

const HISTORY_PAGE_SIZE = 20;

const CATEGORIES: {
  label: string;
  value: PersonalWorkoutCategory | null;
}[] = [
  { label: 'All', value: null },
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Flexibility', value: 'flexibility' },
  { label: 'Functional', value: 'functional' },
  { label: 'Custom', value: 'custom' },
];

function formatRecordType(value: PersonalRecord['record_type']) {
  const labels: Record<PersonalRecord['record_type'], string> = {
    max_weight: 'Heaviest weight',
    max_repetitions: 'Most repetitions',
    max_distance: 'Longest distance',
    fastest_time: 'Fastest time',
  };

  return labels[value];
}

function formatCategory(value: PersonalWorkout['workout_type']) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PersonalWorkoutOverviewScreen() {
  const { colors, spacing, radius } = useTrainrTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'overview' | 'history'>(
    'overview',
  );

  const [workouts, setWorkouts] = useState<PersonalWorkout[]>([]);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  const [searchDraft, setSearchDraft] = useState('');
  const [categoryDraft, setCategoryDraft] =
    useState<PersonalWorkoutCategory | null>(null);
  const [startDateDraft, setStartDateDraft] = useState('');
  const [endDateDraft, setEndDateDraft] = useState('');

  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedCategory, setAppliedCategory] =
    useState<PersonalWorkoutCategory | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Reserve space for the floating NativeTabs bar and bottom safe area.
  const bottomContentPadding = spacing.xxxl + insets.bottom + 100;

  const loadOverview = useCallback(async () => {
    setIsLoading(true);

    const [goalResult, recordResult] = await Promise.allSettled([
      getFitnessGoals({ status: 'active' }),
      getPersonalRecords({ limit: 5 }),
    ]);

    if (goalResult.status === 'fulfilled') {
      setGoals(goalResult.value);
      setGoalError(null);
    } else {
      setGoalError(
        goalResult.reason instanceof Error
          ? goalResult.reason.message
          : 'Unable to load your fitness goals.',
      );
    }

    if (recordResult.status === 'fulfilled') {
      setRecords(recordResult.value);
      setRecordError(null);
    } else {
      setRecordError(
        recordResult.reason instanceof Error
          ? recordResult.reason.message
          : 'Unable to load your personal records.',
      );
    }

    setIsLoading(false);
  }, []);

  const loadHistory = useCallback(
    async (offset = 0, append = false) => {
      if (append) {
        setHistoryLoadingMore(true);
      } else {
        setHistoryLoading(true);
      }

      setHistoryError(null);

      try {
        const result = await getPersonalWorkoutHistory({
          limit: HISTORY_PAGE_SIZE,
          offset,
          search: appliedSearch || undefined,
          workout_type: appliedCategory ?? undefined,
          start_date: appliedStartDate || undefined,
          end_date: appliedEndDate || undefined,
        });

        setWorkouts((current) =>
          append ? [...current, ...result] : result,
        );

        setHasMore(result.length === HISTORY_PAGE_SIZE);
      } catch (error) {
        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Unable to load your workout history.',
        );
      } finally {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    },
    [appliedSearch, appliedCategory, appliedStartDate, appliedEndDate],
  );

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  function applyFilters() {
    setAppliedSearch(searchDraft.trim());
    setAppliedCategory(categoryDraft);
    setAppliedStartDate(startDateDraft.trim());
    setAppliedEndDate(endDateDraft.trim());
  }

  function clearFilters() {
    setSearchDraft('');
    setCategoryDraft(null);
    setStartDateDraft('');
    setEndDateDraft('');

    setAppliedSearch('');
    setAppliedCategory(null);
    setAppliedStartDate('');
    setAppliedEndDate('');
  }

  const sectionTitleStyle = {
    marginBottom: spacing.md,
  } as const;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>

        <AppText variant="h2" color={colors.text.primary}>
          Personal Training
        </AppText>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          paddingBottom: bottomContentPadding,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Introduction */}
        <View style={{ gap: spacing.xs }}>
          <AppText
            variant="caption"
            color={colors.brand.red}
            weight="700"
          >
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Personal Training
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Your workouts, progress and goals — all in one place.
          </AppText>
        </View>

        {/* Personal Workout Tabs */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: spacing.xs,
            gap: spacing.xs,
            borderRadius: radius.pill,
            backgroundColor: colors.background.secondary,
            zIndex: 20,
            elevation: 20,
          }}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{
              selected: activeTab === 'overview',
            }}
            accessibilityLabel="Overview tab"
            onPress={() => setActiveTab('overview')}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.pill,
              backgroundColor:
                activeTab === 'overview'
                  ? colors.surface.default
                  : 'transparent',
            }}
          >
            <AppText
              variant="label"
              weight="600"
              color={
                activeTab === 'overview'
                  ? colors.brand.red
                  : colors.text.secondary
              }
            >
              Overview
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{
              selected: activeTab === 'history',
            }}
            accessibilityLabel="Workout History tab"
            onPress={() => setActiveTab('history')}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.pill,
              backgroundColor:
                activeTab === 'history'
                  ? colors.surface.default
                  : 'transparent',
            }}
          >
            <AppText
              variant="label"
              weight="600"
              color={
                activeTab === 'history'
                  ? colors.brand.red
                  : colors.text.secondary
              }
            >
              Workout History
            </AppText>
          </Pressable>
        </View>

        {activeTab === 'overview' ? (
          <>
            {/* Summary */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.sm,
                }}
              >
                <Dumbbell size={20} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  {historyLoading ? '—' : workouts.length}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  Loaded workouts
                </AppText>
              </View>

              <View
                style={{
                  flex: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.sm,
                }}
              >
                <Flag size={20} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  {isLoading ? '—' : goals.length}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  Active goals
                </AppText>
              </View>

              <View
                style={{
                  flex: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: colors.background.secondary,
                  gap: spacing.sm,
                }}
              >
                <Trophy size={20} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  {isLoading ? '—' : records.length}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  Recent records
                </AppText>
              </View>
            </View>

            {/* Active Goals */}
            <View>
              <AppText
                variant="h3"
                color={colors.text.primary}
                style={sectionTitleStyle}
              >
                Active fitness goals
              </AppText>

              {isLoading ? (
                <ActivityIndicator color={colors.brand.red} />
              ) : goalError ? (
                <Card variant="outlined">
                  <AppText
                    variant="bodySmall"
                    color={colors.text.error}
                  >
                    {goalError}
                  </AppText>
                </Card>
              ) : goals.length === 0 ? (
                <Card variant="outlined" style={{ gap: spacing.xs }}>
                  <AppText
                    variant="bodyMedium"
                    color={colors.text.primary}
                  >
                    Set your next target
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                  >
                    Measurable fitness goals you create will appear here.
                  </AppText>
                </Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {goals.slice(0, 5).map((goal) => (
                    <Card
                      key={goal.id}
                      variant="outlined"
                      style={{ gap: spacing.xs }}
                    >
                      <AppText
                        variant="bodyMedium"
                        color={colors.text.primary}
                      >
                        {goal.goal_name}
                      </AppText>

                      <AppText
                        variant="bodySmall"
                        color={colors.text.secondary}
                      >
                        Target: {goal.target_value}
                        {goal.measurement_unit
                          ? ` ${goal.measurement_unit}`
                          : ''}
                      </AppText>

                      {goal.target_date ? (
                        <AppText
                          variant="caption"
                          color={colors.text.tertiary}
                        >
                          Target date: {formatDate(goal.target_date)}
                        </AppText>
                      ) : null}
                    </Card>
                  ))}
                </View>
              )}
            </View>

            {/* Personal Records */}
            <View>
              <AppText
                variant="h3"
                color={colors.text.primary}
                style={sectionTitleStyle}
              >
                Personal records
              </AppText>

              {isLoading ? (
                <ActivityIndicator color={colors.brand.red} />
              ) : recordError ? (
                <Card variant="outlined">
                  <AppText
                    variant="bodySmall"
                    color={colors.text.error}
                  >
                    {recordError}
                  </AppText>
                </Card>
              ) : records.length === 0 ? (
                <Card variant="outlined" style={{ gap: spacing.xs }}>
                  <AppText
                    variant="bodyMedium"
                    color={colors.text.primary}
                  >
                    Your achievements will appear here
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                  >
                    Complete logged workouts to start building your personal
                    records.
                  </AppText>
                </Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {records.map((record) => (
                    <Card
                      key={record.id}
                      variant="outlined"
                      style={{ gap: spacing.xs }}
                    >
                      <AppText
                        variant="bodySmall"
                        color={colors.text.secondary}
                      >
                        {formatRecordType(record.record_type)}
                      </AppText>

                      <AppText
                        variant="h3"
                        color={colors.text.primary}
                      >
                        {record.record_value} {record.measurement_unit}
                      </AppText>

                      <AppText
                        variant="caption"
                        color={colors.text.tertiary}
                      >
                        Achieved {formatDate(record.achieved_at)}
                      </AppText>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            {/* Create Workout */}
            <Button
              fullWidth
              onPress={() =>
                router.push('/(tabs)/personal-workout/new')
              }
            >
              Create personal workout
            </Button>
          </>
        ) : (
          <>
            {/* Workout History */}
            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Activity size={19} color={colors.brand.red} />

                <AppText variant="h3" color={colors.text.primary}>
                  Workout history
                </AppText>
              </View>

              {/* Search and Filters */}
              <View style={{ gap: spacing.md }}>
                <Input
                  label="Search workouts"
                  placeholder="Search by workout name"
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  returnKeyType="search"
                  accessibilityLabel="Search workouts by name"
                />

                {/* Workout Categories */}
                <View style={{ gap: spacing.sm }}>
                  <AppText
                    variant="label"
                    color={colors.text.primary}
                  >
                    Workout category
                  </AppText>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing.xs,
                    }}
                  >
                    {CATEGORIES.map((category) => {
                      const selected =
                        categoryDraft === category.value;

                      return (
                        <Pressable
                          key={category.label}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Filter by ${category.label}`}
                          onPress={() =>
                            setCategoryDraft(category.value)
                          }
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: selected
                              ? colors.brand.red
                              : colors.border.default,
                            backgroundColor: selected
                              ? colors.brand.redLight
                              : colors.surface.default,
                          }}
                        >
                          <AppText
                            variant="caption"
                            weight="600"
                            color={
                              selected
                                ? colors.brand.red
                                : colors.text.secondary
                            }
                          >
                            {category.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Date Filters */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      label="From date"
                      placeholder="YYYY-MM-DD"
                      value={startDateDraft}
                      onChangeText={setStartDateDraft}
                      autoCapitalize="none"
                      accessibilityLabel="Workout history start date"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Input
                      label="To date"
                      placeholder="YYYY-MM-DD"
                      value={endDateDraft}
                      onChangeText={setEndDateDraft}
                      autoCapitalize="none"
                      accessibilityLabel="Workout history end date"
                    />
                  </View>
                </View>

                {/* Filter Actions */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Button fullWidth onPress={applyFilters}>
                      Apply filters
                    </Button>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Button
                      fullWidth
                      variant="outline"
                      onPress={clearFilters}
                    >
                      Clear filters
                    </Button>
                  </View>
                </View>
              </View>

              {/* History Results */}
              {historyLoading ? (
                <ActivityIndicator color={colors.brand.red} />
              ) : historyError ? (
                <Card
                  variant="outlined"
                  style={{ gap: spacing.sm }}
                >
                  <AppText
                    variant="bodySmall"
                    color={colors.text.error}
                  >
                    {historyError}
                  </AppText>

                  <Button
                    variant="outline"
                    onPress={() => void loadHistory()}
                  >
                    Try again
                  </Button>
                </Card>
              ) : workouts.length === 0 ? (
                <Card
                  variant="outlined"
                  style={{ gap: spacing.xs }}
                >
                  <AppText
                    variant="bodyMedium"
                    color={colors.text.primary}
                  >
                    No workouts found
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                  >
                    Try changing your search or filters, or create a
                    personal workout to start building your history.
                  </AppText>
                </Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <AppText
                    variant="caption"
                    color={colors.text.secondary}
                  >
                    Showing {workouts.length} workout
                    {workouts.length === 1 ? '' : 's'}
                  </AppText>

                  {workouts.map((workout) => (
                    <Card
                      key={workout.id}
                      variant="interactive"
                      onPress={() =>
                        router.push(
                          `/(tabs)/personal-workout/${workout.id}`,
                        )
                      }
                      accessibilityLabel={`View ${workout.workout_name}`}
                      style={{ gap: spacing.sm }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        <AppText
                          variant="bodyMedium"
                          color={colors.text.primary}
                          style={{ flex: 1 }}
                        >
                          {workout.workout_name}
                        </AppText>

                        <Badge
                          tone={
                            workout.status === 'completed'
                              ? 'success'
                              : workout.status === 'in_progress'
                                ? 'primary'
                                : 'neutral'
                          }
                        >
                          {workout.status.replace('_', ' ')}
                        </Badge>
                      </View>

                      <AppText
                        variant="caption"
                        color={colors.text.secondary}
                      >
                        {formatCategory(workout.workout_type)} ·{' '}
                        {formatDate(workout.workout_date)}
                      </AppText>

                      <AppText
                        variant="caption"
                        color={colors.text.tertiary}
                      >
                        {formatDuration(workout.duration_seconds)}
                      </AppText>
                    </Card>
                  ))}

                  {/* Pagination */}
                  {hasMore ? (
                    <Button
                      fullWidth
                      variant="outline"
                      loading={historyLoadingMore}
                      disabled={historyLoadingMore}
                      onPress={() =>
                        void loadHistory(workouts.length, true)
                      }
                    >
                      Load more workouts
                    </Button>
                  ) : null}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
