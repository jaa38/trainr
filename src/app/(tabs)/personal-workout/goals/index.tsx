import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  Target,
  TrendingUp,
} from 'lucide-react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import {
  getFitnessGoals,
} from '@/services/fitness-goals';
import {
  getFitnessGoalsProgress,
  type FitnessGoalProgress,
} from '@/services/fitness-goal-progress';
import { useTrainrTheme } from '@/theme';
import type {
  FitnessGoal,
  FitnessGoalStatus,
} from '@/types/personal-workouts';

type GoalFilter = 'all' | FitnessGoalStatus;

const FILTERS: { label: string; value: GoalFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
];

const STATUS_LABELS: Record<FitnessGoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

const GOAL_TYPE_LABELS: Record<FitnessGoal['goal_type'], string> = {
  workout_frequency: 'Workout frequency',
  strength_target: 'Strength target',
  cardio_target: 'Cardio target',
  workout_duration: 'Workout duration',
  body_weight: 'Body weight',
  custom: 'Custom goal',
};

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function GoalProgressBar({
  percentage,
  colors,
}: {
  percentage: number | null;
  colors: ReturnType<typeof useTrainrTheme>['colors'];
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percentage ?? 0,
        text: percentage === null ? 'Progress unavailable' : `${Math.round(percentage)}%`,
      }}
      style={{
        height: 8,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.border.default,
      }}
    >
      <View
        style={{
          width: `${percentage ?? 0}%`,
          height: '100%',
          borderRadius: 8,
          backgroundColor: colors.brand.red,
        }}
      />
    </View>
  );
}

export default function FitnessGoalsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const insets = useSafeAreaInsets();

  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [progressById, setProgressById] = useState<
    Record<string, FitnessGoalProgress>
  >({});
  const [filter, setFilter] = useState<GoalFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [allGoals, allProgress] = await Promise.all([
        getFitnessGoals(),
        getFitnessGoalsProgress(),
      ]);

      setGoals(allGoals);
      setProgressById(
        Object.fromEntries(allProgress.map((item) => [item.goalId, item])),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load your fitness goals. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGoals();
    }, [loadGoals]),
  );

  const visibleGoals = goals.filter(
    (goal) => filter === 'all' || goal.goal_status === filter,
  );

  const activeCount = goals.filter((goal) => goal.goal_status === 'active').length;

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl + insets.bottom + 36,
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={10}
            style={{ padding: spacing.xs }}
          >
            <ArrowLeft size={23} color={colors.text.primary} />
          </Pressable>

          <AppText variant="h3" color={colors.text.primary}>
            Fitness goals
          </AppText>

          <View style={{ width: 32 }} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="h1" color={colors.text.primary}>
            Your goals
          </AppText>
          <AppText variant="bodySmall" color={colors.text.secondary}>
            Set targets, follow your progress and keep building consistency.
          </AppText>
        </View>

        <Card variant="outlined" style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Target size={21} color={colors.brand.red} />
            <AppText variant="bodyMedium" color={colors.text.primary}>
              Goal overview
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <AppText variant="h2" color={colors.text.primary}>
                {goals.length}
              </AppText>
              <AppText variant="caption" color={colors.text.secondary}>
                Total goals
              </AppText>
            </View>
            <View style={{ gap: 2 }}>
              <AppText variant="h2" color={colors.brand.red}>
                {activeCount}
              </AppText>
              <AppText variant="caption" color={colors.text.secondary}>
                Active goals
              </AppText>
            </View>
          </View>
        </Card>

        <Button
          fullWidth
          onPress={() => router.push('/(tabs)/personal-workout/goals/new')}
        >
          <Plus size={18} color="#FFFFFF" />
          {'  '}Create a goal
        </Button>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="bodyMedium" color={colors.text.primary}>
            Browse goals
          </AppText>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.xs }}
          >
            {FILTERS.map((item) => {
              const selected = filter === item.value;

              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(item.value)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand.red : colors.border.default,
                    backgroundColor: selected ? colors.brand.red : colors.background.secondary,
                  }}
                >
                  <AppText
                    variant="caption"
                    color={selected ? '#FFFFFF' : colors.text.secondary}
                  >
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.brand.red} />
            <AppText variant="caption" color={colors.text.secondary}>
              Loading your goals…
            </AppText>
          </View>
        ) : errorMessage ? (
          <Card variant="outlined" style={{ gap: spacing.md }}>
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage}
            </AppText>
            <Button fullWidth onPress={() => void loadGoals()}>
              Try again
            </Button>
          </Card>
        ) : visibleGoals.length === 0 ? (
          <Card variant="outlined" style={{ alignItems: 'center', gap: spacing.sm }}>
            <Target size={30} color={colors.text.tertiary} />
            <AppText variant="bodyMedium" color={colors.text.primary}>
              {filter === 'all' ? 'No goals yet' : `No ${filter} goals`}
            </AppText>
            <AppText
              variant="bodySmall"
              color={colors.text.secondary}
              style={{ textAlign: 'center' }}
            >
              {filter === 'all'
                ? 'Create your first fitness goal and start tracking your progress.'
                : 'Goals with this status will appear here.'}
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {visibleGoals.map((goal) => {
              const progress = progressById[goal.id];
              const percentage = progress?.progressPercentage ?? null;

              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${goal.goal_name}`}
                  onPress={() =>
                    router.push(`/(tabs)/personal-workout/goals/${goal.id}`)
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Card variant="outlined" style={{ gap: spacing.sm }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1, gap: 3 }}>
                        <AppText variant="bodyMedium" color={colors.text.primary}>
                          {goal.goal_name}
                        </AppText>
                        <AppText variant="caption" color={colors.text.secondary}>
                          {GOAL_TYPE_LABELS[goal.goal_type]}
                        </AppText>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 4,
                          borderRadius: 14,
                          backgroundColor:
                            goal.goal_status === 'active'
                              ? colors.brand.redLight
                              : colors.background.tertiary,
                        }}
                      >
                        <AppText
                          variant="caption"
                          color={
                            goal.goal_status === 'active'
                              ? colors.brand.red
                              : colors.text.secondary
                          }
                        >
                          {STATUS_LABELS[goal.goal_status]}
                        </AppText>
                      </View>
                    </View>

                    <View style={{ gap: 5 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <AppText variant="caption" color={colors.text.secondary}>
                          {progress?.isAvailable && progress.currentValue !== null
                            ? `${formatValue(progress.currentValue)}${progress.unit ? ` ${progress.unit}` : ''} of ${formatValue(progress.targetValue)}${progress.unit ? ` ${progress.unit}` : ''}`
                            : `Target: ${formatValue(goal.target_value)}${goal.measurement_unit ? ` ${goal.measurement_unit}` : ''}`}
                        </AppText>

                        <AppText variant="caption" color={colors.text.primary}>
                          {percentage === null ? '—' : `${Math.round(percentage)}%`}
                        </AppText>
                      </View>

                      <GoalProgressBar percentage={percentage} colors={colors} />

                      {!progress?.isAvailable ? (
                        <AppText variant="caption" color={colors.text.tertiary}>
                          Progress will appear when the required activity is recorded.
                        </AppText>
                      ) : null}
                    </View>

                    {goal.target_date ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <CalendarDays size={14} color={colors.text.tertiary} />
                        <AppText variant="caption" color={colors.text.tertiary}>
                          Target date: {formatDate(goal.target_date)}
                        </AppText>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <TrendingUp size={15} color={colors.brand.red} />
                      <AppText variant="caption" color={colors.brand.red}>
                        View goal details
                      </AppText>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
