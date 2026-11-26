import { router, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  Dumbbell,
  Minus,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/providers/AuthProvider';
import {
  getExercisePerformanceHistory,
  type ExercisePerformanceHistoryItem,
} from '@/services/exercise-performance-history';
import { getBodyWeightHistory, type FitnessProgress } from '@/services/fitness-progress';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import {
  getPersonalWorkoutStatistics,
  type PersonalWorkoutStatistics,
} from '@/services/workout-statistics';
import { useTrainrTheme } from '@/theme';
import type { PersonalWorkout } from '@/types/personal-workouts';

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function formatWorkoutDuration(seconds: number | null) {
  if (seconds === null) return 'Not recorded';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function formatWeightDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Weight Trend Chart
// -----------------------------------------------------------------------------

function DashboardWeightChart({
  records,
  unit,
  colors,
}: {
  records: FitnessProgress[];
  unit: 'kg' | 'lb';
  colors: ReturnType<typeof useTrainrTheme>['colors'];
}) {
  const [chartWidth, setChartWidth] = useState(0);

  const chartHeight = 125;
  const horizontalPadding = 12;
  const verticalPadding = 16;

  const chartRecords = useMemo(
    () =>
      [...records]
        .filter((record) => record.unit === unit)
        .reverse()
        .slice(-7),
    [records, unit],
  );

  if (chartRecords.length < 2) {
    return (
      <View
        style={{
          minHeight: 90,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TrendingUp size={24} color={colors.text.tertiary} />

        <AppText variant="caption" color={colors.text.secondary}>
          Record another measurement to see your weight trend.
        </AppText>
      </View>
    );
  }

  const values = chartRecords.map((record) => record.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const points = chartRecords.map((record, index) => {
    const x =
      horizontalPadding +
      (index / (chartRecords.length - 1)) *
        Math.max(chartWidth - horizontalPadding * 2, 1);

    const y =
      chartHeight -
      verticalPadding -
      ((record.value - minValue) / valueRange) * (chartHeight - verticalPadding * 2);

    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <View
      onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      style={{ width: '100%' }}
    >
      {chartWidth > 0 ? (
        <Svg width={chartWidth} height={chartHeight}>
          {[0, 0.5, 1].map((position) => {
            const y = verticalPadding + position * (chartHeight - verticalPadding * 2);

            return (
              <Line
                key={position}
                x1={horizontalPadding}
                y1={y}
                x2={chartWidth - horizontalPadding}
                y2={y}
                stroke={colors.border.default}
                strokeWidth={1}
                strokeDasharray="4 5"
              />
            );
          })}

          <Path
            d={linePath}
            fill="none"
            stroke={colors.brand.red}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <Circle
              key={chartRecords[index].id}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={colors.brand.red}
              stroke={colors.background.secondary}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Gym-Goer Dashboard
// -----------------------------------------------------------------------------

export default function HomeTabScreen() {
  const { colors, spacing, mode } = useTrainrTheme();
  const { user } = useAuth();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [weightRecords, setWeightRecords] = useState<FitnessProgress[]>([]);
  const [isLoadingWeight, setIsLoadingWeight] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);

  const [workoutStatistics, setWorkoutStatistics] =
    useState<PersonalWorkoutStatistics | null>(null);

  const [recentWorkout, setRecentWorkout] = useState<PersonalWorkout | null>(null);

  const [exercisePerformanceHistory, setExercisePerformanceHistory] = useState<
    ExercisePerformanceHistoryItem[]
  >([]);

  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  const [activeProgressTab, setActiveProgressTab] = useState<'fitness' | 'workouts'>(
    'fitness',
  );

  // ---------------------------------------------------------------------------
  // Application Icon
  // ---------------------------------------------------------------------------

  const appIcon =
    mode === 'dark'
      ? require('../../../../assets/images/icons/darkModeAppIcon.png')
      : require('../../../../assets/images/icons/lightModeAppIcon.png');

  // ---------------------------------------------------------------------------
  // Fitness Progress
  // ---------------------------------------------------------------------------

  const loadWeightProgress = useCallback(
    async (showLoading = true) => {
      if (!user?.id) {
        setWeightRecords([]);
        setIsLoadingWeight(false);
        return;
      }

      if (showLoading) {
        setIsLoadingWeight(true);
      }

      setWeightError(null);

      try {
        const result = await getBodyWeightHistory();
        setWeightRecords(result);
      } catch (error) {
        console.error('[Home] Unable to load weight progress:', error);

        setWeightError(
          error instanceof Error ? error.message : 'Unable to load your weight progress.',
        );
      } finally {
        if (showLoading) {
          setIsLoadingWeight(false);
        }
      }
    },
    [user?.id],
  );

  // ---------------------------------------------------------------------------
  // Personal Workout Progress
  // ---------------------------------------------------------------------------

  const loadPersonalWorkoutProgress = useCallback(
    async (showLoading = true) => {
      if (!user?.id) {
        setWorkoutStatistics(null);
        setRecentWorkout(null);
        setExercisePerformanceHistory([]);
        setIsLoadingWorkouts(false);
        return;
      }

      if (showLoading) {
        setIsLoadingWorkouts(true);
      }

      setWorkoutError(null);

      try {
        const [statisticsResult, recentWorkoutsResult, exerciseHistoryResult] =
          await Promise.allSettled([
            getPersonalWorkoutStatistics(),
            getPersonalWorkoutHistory({ limit: 1 }),
            getExercisePerformanceHistory(),
          ]);

        const failedSections: string[] = [];

        if (statisticsResult.status === 'fulfilled') {
          setWorkoutStatistics(statisticsResult.value);
        } else {
          failedSections.push('workout statistics');
        }

        if (recentWorkoutsResult.status === 'fulfilled') {
          setRecentWorkout(recentWorkoutsResult.value[0] ?? null);
        } else {
          failedSections.push('recent workouts');
        }

        if (exerciseHistoryResult.status === 'fulfilled') {
          setExercisePerformanceHistory(exerciseHistoryResult.value);
        } else {
          failedSections.push('exercise performance history');
        }

        if (failedSections.length > 0) {
          throw new Error(`Unable to load ${failedSections.join(', ')}.`);
        }
      } catch (error) {
        console.error('[Home] Unable to load personal workout progress:', error);

        setWorkoutError(
          error instanceof Error
            ? error.message
            : 'Unable to load your workout progress.',
        );
      } finally {
        if (showLoading) {
          setIsLoadingWorkouts(false);
        }
      }
    },
    [user?.id],
  );

  // ---------------------------------------------------------------------------
  // Screen Focus Effects
  // ---------------------------------------------------------------------------

  // Refresh progress whenever the Home screen regains focus.
  useFocusEffect(
    useCallback(() => {
      void loadWeightProgress();
      void loadPersonalWorkoutProgress();
    }, [loadPersonalWorkoutProgress, loadWeightProgress]),
  );

  // ---------------------------------------------------------------------------
  // Pull-to-Refresh
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await Promise.all([loadWeightProgress(false), loadPersonalWorkoutProgress(false)]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadPersonalWorkoutProgress, loadWeightProgress]);

  // ---------------------------------------------------------------------------
  // Derived Fitness Data
  // ---------------------------------------------------------------------------

  const currentWeight = weightRecords[0] ?? null;
  const previousWeight = weightRecords[1] ?? null;

  const weightDifference =
    currentWeight && previousWeight && currentWeight.unit === previousWeight.unit
      ? currentWeight.value - previousWeight.value
      : null;

  // ---------------------------------------------------------------------------
  // Tab Selection
  // ---------------------------------------------------------------------------

  function selectProgressTab(tab: 'fitness' | 'workouts') {
    setActiveProgressTab(tab);
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      {/* ================================================================ */}
      {/* Brand Header */}
      {/* ================================================================ */}

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xxl,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="h1" color={colors.text.primary}>
            TRAINR
          </AppText>

          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>
        </View>

        <NotificationBell />

        <Image
          source={appIcon}
          accessibilityLabel="TRAINR app icon"
          resizeMode="contain"
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
          }}
        />
      </View>

      {/* ================================================================ */}
      {/* Refreshable Dashboard Content */}
      {/* ================================================================ */}

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.red}
            colors={[colors.brand.red]}
            progressBackgroundColor={colors.background.secondary}
          />
        }
      >
        {/* ============================================================ */}
        {/* Welcome Section */}
        {/* ============================================================ */}

        <View
          style={{
            gap: spacing.sm,
            marginBottom: spacing.xl,
          }}
        >
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            YOUR NEXT CHAPTER
          </AppText>

          <AppText variant="displayMedium" color={colors.text.primary}>
            YOUR JOURNEY
          </AppText>

          <AppText variant="displayMedium" color={colors.brand.red}>
            STARTS HERE.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{
              lineHeight: 24,
              marginTop: spacing.xs,
            }}
          >
            Your fitness journey begins today. Set your goals, build healthy habits, stay
            consistent and take the first step towards becoming a stronger version of
            yourself.
          </AppText>
        </View>

        {/* ============================================================ */}
        {/* Fitness and Workout Progress */}
        {/* ============================================================ */}

        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {/* Progress Heading */}

          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" color={colors.brand.red}>
              YOUR JOURNEY
            </AppText>

            <AppText variant="h2" color={colors.text.primary}>
              YOUR PROGRESS
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              Track your fitness journey and personal workout performance.
            </AppText>
          </View>

          {/* ========================================================== */}
          {/* Progress Tabs */}
          {/* ========================================================== */}

          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              padding: spacing.xs,
              gap: spacing.xs,
              borderRadius: 999,
              backgroundColor: colors.background.secondary,
              zIndex: 20,
              elevation: 20,
            }}
          >
            {[
              { key: 'fitness', label: 'Fitness' },
              { key: 'workouts', label: 'Workout' },
            ].map((tab) => {
              const selected = activeProgressTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${tab.label} tab`}
                  onPress={() => selectProgressTab(tab.key as 'fitness' | 'workouts')}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.xs,
                    paddingVertical: spacing.md,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.surface.default : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <AppText
                    variant="label"
                    weight="600"
                    color={selected ? colors.brand.red : colors.text.secondary}
                  >
                    {tab.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* ========================================================== */}
          {/* Fitness Progress Tab */}
          {/* ========================================================== */}

          {activeProgressTab === 'fitness' ? (
            <View style={{ gap: spacing.md }}>
              {/* Section Heading */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  FITNESS PROGRESS
                </AppText>

                <Scale size={23} color={colors.brand.red} />
              </View>

              {/* Weight Progress Card */}

              <Card
                variant="outlined"
                style={{
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                {isLoadingWeight ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Loading your fitness progress...
                  </AppText>
                ) : weightError ? (
                  <View style={{ gap: spacing.md }}>
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {weightError}
                    </AppText>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadWeightProgress()}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <AppText variant="button" color={colors.brand.red}>
                        Try again
                      </AppText>
                    </Pressable>
                  </View>
                ) : currentWeight ? (
                  <>
                    {/* Current Weight */}

                    <View style={{ gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.text.secondary}>
                        CURRENT WEIGHT
                      </AppText>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          gap: spacing.sm,
                        }}
                      >
                        <AppText variant="displayLarge" color={colors.text.primary}>
                          {currentWeight.value}
                        </AppText>

                        <AppText variant="h3" color={colors.text.secondary}>
                          {currentWeight.unit}
                        </AppText>
                      </View>

                      <AppText variant="caption" color={colors.text.tertiary}>
                        Last recorded {formatWeightDate(currentWeight.recorded_at)}
                      </AppText>
                    </View>

                    {/* Weight Difference */}

                    {weightDifference !== null ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.xs,
                        }}
                      >
                        {weightDifference > 0 ? (
                          <TrendingUp size={17} color={colors.brand.red} />
                        ) : weightDifference < 0 ? (
                          <TrendingDown size={17} color={colors.text.secondary} />
                        ) : (
                          <Minus size={17} color={colors.text.tertiary} />
                        )}

                        <AppText variant="bodySmall" color={colors.text.secondary}>
                          {weightDifference > 0 ? '+' : ''}
                          {weightDifference.toFixed(1)} {currentWeight.unit} since
                          previous measurement
                        </AppText>
                      </View>
                    ) : null}

                    {/* Weight Trend */}

                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border.default,
                        paddingTop: spacing.md,
                        gap: spacing.sm,
                      }}
                    >
                      <AppText variant="caption" color={colors.text.secondary}>
                        WEIGHT TREND
                      </AppText>

                      <DashboardWeightChart
                        records={weightRecords}
                        unit={currentWeight.unit as 'kg' | 'lb'}
                        colors={colors}
                      />
                    </View>
                  </>
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="h3" color={colors.text.primary}>
                      START TRACKING YOUR PROGRESS
                    </AppText>

                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      Record your first weight measurement to see your fitness progress
                      here.
                    </AppText>
                  </View>
                )}

                {/* Weight History Navigation */}

                {!isLoadingWeight && !weightError ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View weight history"
                    onPress={() => router.push('/(tabs)/gym-goer-weight/history')}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.border.default,
                      paddingTop: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <AppText variant="button" color={colors.brand.red}>
                      {currentWeight ? 'View Weight History' : 'Record Your Weight'}
                    </AppText>

                    <ArrowRight size={19} color={colors.brand.red} />
                  </Pressable>
                ) : null}
              </Card>
            </View>
          ) : null}

          {/* ========================================================== */}
          {/* Workout Progress Tab */}
          {/* ========================================================== */}

          {activeProgressTab === 'workouts' ? (
            <View style={{ gap: spacing.md }}>
              {/* Section Heading */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  WORKOUT PROGRESS
                </AppText>

                <Dumbbell size={23} color={colors.brand.red} />
              </View>

              {/* Workout Statistics Card */}

              <Card
                variant="outlined"
                style={{
                  padding: spacing.lg,
                  gap: spacing.lg,
                }}
              >
                {isLoadingWorkouts ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Loading your workout progress...
                  </AppText>
                ) : workoutError ? (
                  <View style={{ gap: spacing.md }}>
                    <AppText variant="bodySmall" color={colors.text.error}>
                      {workoutError}
                    </AppText>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadPersonalWorkoutProgress()}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <AppText variant="button" color={colors.brand.red}>
                        Try again
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {/* Completed Workouts */}

                    <View style={{ gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.text.secondary}>
                        COMPLETED WORKOUTS
                      </AppText>

                      <AppText variant="displayLarge" color={colors.text.primary}>
                        {workoutStatistics?.completedWorkoutCount ?? 0}
                      </AppText>

                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        All completed personal workouts
                      </AppText>
                    </View>

                    {/* Weekly and Monthly Statistics */}

                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {[
                        {
                          label: 'THIS WEEK',
                          value: workoutStatistics?.workoutsThisWeek ?? 0,
                        },
                        {
                          label: 'THIS MONTH',
                          value: workoutStatistics?.workoutsThisMonth ?? 0,
                        },
                        {
                          label: 'ACTIVE DAYS',
                          value: workoutStatistics?.activeDaysThisWeek ?? 0,
                        },
                      ].map((item) => (
                        <View
                          key={item.label}
                          style={{
                            flex: 1,
                            padding: spacing.sm,
                            borderRadius: 12,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                          }}
                        >
                          <AppText variant="h2" color={colors.text.primary}>
                            {item.value}
                          </AppText>

                          <AppText
                            variant="caption"
                            color={colors.text.secondary}
                            style={{ fontSize: 9 }}
                          >
                            {item.label}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    {/* Workout Duration Statistics */}

                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {[
                        {
                          label: 'TOTAL RECORDED TIME',
                          value: formatWorkoutDuration(
                            workoutStatistics?.recordedDurationSeconds ?? null,
                          ),
                        },
                        {
                          label: 'AVERAGE DURATION',
                          value: formatWorkoutDuration(
                            workoutStatistics?.averageDurationSeconds ?? null,
                          ),
                        },
                      ].map((item) => (
                        <View
                          key={item.label}
                          style={{
                            flex: 1,
                            padding: spacing.md,
                            borderRadius: 12,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.xs,
                          }}
                        >
                          <AppText variant="h3" color={colors.text.primary}>
                            {item.value}
                          </AppText>

                          <AppText
                            variant="caption"
                            color={colors.text.secondary}
                            style={{ fontSize: 9 }}
                          >
                            {item.label}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    {/* Most Recent Workout */}

                    {recentWorkout ? (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: colors.border.default,
                          paddingTop: spacing.md,
                          gap: spacing.xs,
                        }}
                      >
                        <AppText variant="caption" color={colors.text.secondary}>
                          MOST RECENT WORKOUT
                        </AppText>

                        <AppText variant="h3" color={colors.text.primary}>
                          {recentWorkout.workout_name}
                        </AppText>

                        <AppText variant="bodySmall" color={colors.text.secondary}>
                          {new Date(
                            `${recentWorkout.workout_date}T00:00:00`,
                          ).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {' · '}
                          {recentWorkout.status.replace('_', ' ')}
                        </AppText>
                      </View>
                    ) : (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: colors.border.default,
                          paddingTop: spacing.md,
                          gap: spacing.xs,
                        }}
                      >
                        <AppText variant="h3" color={colors.text.primary}>
                          YOUR TRAINING STARTS HERE
                        </AppText>

                        <AppText variant="bodySmall" color={colors.text.secondary}>
                          Complete your first personal workout to start tracking your
                          progress.
                        </AppText>
                      </View>
                    )}
                  </>
                )}

                {/* ====================================================== */}
                {/* Exercise Performance History */}
                {/* ====================================================== */}

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border.default,
                    paddingTop: spacing.md,
                    gap: spacing.md,
                  }}
                >
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="h3" color={colors.text.primary}>
                      EXERCISE PERFORMANCE
                    </AppText>

                    <AppText variant="caption" color={colors.text.secondary}>
                      Your latest recorded exercise sessions
                    </AppText>
                  </View>

                  {isLoadingWorkouts ? (
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      Loading exercise history...
                    </AppText>
                  ) : exercisePerformanceHistory.length === 0 ? (
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      Complete workouts with recorded sets to build your exercise history.
                    </AppText>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {exercisePerformanceHistory.map((exercise) => (
                        <View
                          key={exercise.exerciseKey}
                          style={{
                            padding: spacing.md,
                            borderRadius: 12,
                            backgroundColor: colors.background.secondary,
                            gap: spacing.sm,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: spacing.sm,
                            }}
                          >
                            <View style={{ flex: 1, gap: spacing.xs }}>
                              <AppText variant="bodyMedium" color={colors.text.primary}>
                                {exercise.exerciseName}
                              </AppText>

                              <AppText variant="caption" color={colors.text.tertiary}>
                                {exercise.exerciseSource === 'personal'
                                  ? 'Personal exercise'
                                  : 'TRAINR exercise'}
                                {' · '}
                                {exercise.totalSessions}{' '}
                                {exercise.totalSessions === 1 ? 'session' : 'sessions'}
                              </AppText>
                            </View>
                          </View>

                          {/* Latest Exercise Sessions */}

                          {exercise.sessions.slice(0, 2).map((session) => (
                            <View
                              key={session.workoutId}
                              style={{
                                borderTopWidth: 1,
                                borderTopColor: colors.border.default,
                                paddingTop: spacing.sm,
                                gap: spacing.xs,
                              }}
                            >
                              <AppText variant="bodySmall" color={colors.text.primary}>
                                {session.workoutName}
                              </AppText>

                              <AppText variant="caption" color={colors.text.secondary}>
                                {new Date(
                                  `${session.workoutDate}T00:00:00`,
                                ).toLocaleDateString(undefined, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </AppText>

                              {/* Recorded Sets */}

                              {session.sets.map((set) => {
                                const measurements = [
                                  set.repetitions !== null
                                    ? `${set.repetitions} reps`
                                    : null,

                                  set.weight !== null
                                    ? `${set.weight}${
                                        set.weight_unit ? ` ${set.weight_unit}` : ''
                                      }`
                                    : null,

                                  set.duration_seconds !== null
                                    ? formatWorkoutDuration(set.duration_seconds)
                                    : null,

                                  set.distance !== null
                                    ? `${set.distance}${
                                        set.distance_unit ? ` ${set.distance_unit}` : ''
                                      }`
                                    : null,
                                ].filter(Boolean);

                                return (
                                  <AppText
                                    key={set.id}
                                    variant="caption"
                                    color={colors.text.secondary}
                                  >
                                    Set {set.set_number}:{' '}
                                    {measurements.length > 0
                                      ? measurements.join(' · ')
                                      : (set.notes ?? 'Not recorded')}
                                  </AppText>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* ====================================================== */}
                {/* Personal Workout Navigation */}
                {/* ====================================================== */}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View personal workouts"
                  onPress={() => router.push('/(tabs)/personal-workout')}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border.default,
                    paddingTop: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="button" color={colors.brand.red}>
                    View Personal Workouts
                  </AppText>

                  <ArrowRight size={19} color={colors.brand.red} />
                </Pressable>
              </Card>
            </View>
          ) : null}
        </View>

        {/* ============================================================ */}
        {/* Sign Off Section */}
        {/* ============================================================ */}

        <View
          style={{
            paddingTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{ textAlign: 'center' }}
          >
            KEEP SHOWING UP. YOUR WORK ADDS UP.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
