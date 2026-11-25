import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Activity, Dumbbell, Flag, Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { getFitnessGoals } from '@/services/fitness-goals';
import { getPersonalRecords } from '@/services/personal-records';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';
import { useTrainrTheme } from '@/theme';
import type {
  FitnessGoal,
  PersonalRecord,
  PersonalWorkout,
} from '@/types/personal-workouts';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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

  const [workouts, setWorkouts] = useState<PersonalWorkout[]>([]);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);

    const [workoutResult, goalResult, recordResult] = await Promise.allSettled([
      getPersonalWorkoutHistory({ limit: 5 }),
      getFitnessGoals({ status: 'active' }),
      getPersonalRecords({ limit: 5 }),
    ]);

    if (workoutResult.status === 'fulfilled') {
      setWorkouts(workoutResult.value);
      setWorkoutError(null);
    } else {
      setWorkoutError(
        workoutResult.reason instanceof Error
          ? workoutResult.reason.message
          : 'Unable to load your personal workouts.',
      );
    }

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

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  const sectionTitleStyle = {
    marginBottom: spacing.md,
  } as const;

  return (
    <Screen
      scroll
      contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <View style={{ gap: spacing.xl }}>
        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.brand.red} weight="700">
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>

          <AppText variant="h1" color={colors.text.primary}>
            Personal Training
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Your workouts, progress and goals — all in one place.
          </AppText>

          <Button fullWidth onPress={() => router.push('/(tabs)/personal-workout/new')}>
            Create personal workout
          </Button>
        </View>

        {/* Summary */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.background.secondary,
              gap: spacing.sm,
            }}
          >
            <Dumbbell size={20} color={colors.brand.red} />
            <AppText variant="h2" color={colors.text.primary}>
              {isLoading ? '—' : workouts.length}
            </AppText>
            <AppText variant="caption" color={colors.text.secondary}>
              Recent workouts
            </AppText>
          </View>

          <View
            style={{
              flex: 1,
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

        {/* Recent workouts */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Activity size={19} color={colors.brand.red} />
            <AppText variant="h3" color={colors.text.primary} style={sectionTitleStyle}>
              Recent workouts
            </AppText>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.brand.red} />
          ) : workoutError ? (
            <Card variant="outlined">
              <AppText variant="bodySmall" color={colors.text.error}>
                {workoutError}
              </AppText>
            </Card>
          ) : workouts.length === 0 ? (
            <Card variant="outlined" style={{ gap: spacing.xs }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Your training starts here
              </AppText>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Your personal workout sessions will appear here once you start logging
                them.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {workouts.map((workout) => (
                <Card key={workout.id} variant="outlined" style={{ gap: spacing.sm }}>
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

                  <AppText variant="caption" color={colors.text.secondary}>
                    {formatCategory(workout.workout_type)} ·{' '}
                    {formatDate(workout.workout_date)}
                  </AppText>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Active goals */}
        <View>
          <AppText variant="h3" color={colors.text.primary} style={sectionTitleStyle}>
            Active fitness goals
          </AppText>

          {isLoading ? (
            <ActivityIndicator color={colors.brand.red} />
          ) : goalError ? (
            <Card variant="outlined">
              <AppText variant="bodySmall" color={colors.text.error}>
                {goalError}
              </AppText>
            </Card>
          ) : goals.length === 0 ? (
            <Card variant="outlined" style={{ gap: spacing.xs }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Set your next target
              </AppText>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Measurable fitness goals you create will appear here.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {goals.slice(0, 5).map((goal) => (
                <Card key={goal.id} variant="outlined" style={{ gap: spacing.xs }}>
                  <AppText variant="bodyMedium" color={colors.text.primary}>
                    {goal.goal_name}
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Target: {goal.target_value}
                    {goal.measurement_unit ? ` ${goal.measurement_unit}` : ''}
                  </AppText>

                  {goal.target_date ? (
                    <AppText variant="caption" color={colors.text.tertiary}>
                      Target date: {formatDate(goal.target_date)}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Personal records */}
        <View>
          <AppText variant="h3" color={colors.text.primary} style={sectionTitleStyle}>
            Personal records
          </AppText>

          {isLoading ? (
            <ActivityIndicator color={colors.brand.red} />
          ) : recordError ? (
            <Card variant="outlined">
              <AppText variant="bodySmall" color={colors.text.error}>
                {recordError}
              </AppText>
            </Card>
          ) : records.length === 0 ? (
            <Card variant="outlined" style={{ gap: spacing.xs }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Your achievements will appear here
              </AppText>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Complete logged workouts to start building your personal records.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {records.map((record) => (
                <Card key={record.id} variant="outlined" style={{ gap: spacing.xs }}>
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    {formatRecordType(record.record_type)}
                  </AppText>

                  <AppText variant="h3" color={colors.text.primary}>
                    {record.record_value} {record.measurement_unit}
                  </AppText>

                  <AppText variant="caption" color={colors.text.tertiary}>
                    Achieved {formatDate(record.achieved_at)}
                  </AppText>
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
