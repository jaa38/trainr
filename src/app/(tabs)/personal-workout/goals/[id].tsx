import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Pause,
  Play,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import {
  completeFitnessGoal,
  deleteFitnessGoal,
  getFitnessGoalById,
  updateFitnessGoal,
} from '@/services/fitness-goals';
import {
  getFitnessGoalProgress,
  type FitnessGoalProgress,
} from '@/services/fitness-goal-progress';
import { useTrainrTheme } from '@/theme';
import type {
  FitnessGoal,
  FitnessGoalStatus,
} from '@/types/personal-workouts';

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

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );
}

export default function FitnessGoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTrainrTheme();

  const [goal, setGoal] = useState<FitnessGoal | null>(null);
  const [progress, setProgress] = useState<FitnessGoalProgress | null>(null);
  const [manualProgress, setManualProgress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGoal = useCallback(async () => {
    if (!id) {
      setErrorMessage('A valid fitness goal could not be identified.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [goalData, progressData] = await Promise.all([
        getFitnessGoalById(id),
        getFitnessGoalProgress(id),
      ]);

      setGoal(goalData);
      setProgress(progressData);
      setManualProgress(
        goalData.current_value === null
          ? ''
          : String(goalData.current_value),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load this fitness goal. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadGoal();
    }, [loadGoal]),
  );

  const runAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setIsSaving(true);

    try {
      await action();
      Alert.alert('Goal updated', successMessage);
      await loadGoal();
    } catch (error) {
      Alert.alert(
        'Unable to update goal',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualProgress = async () => {
    if (!goal) return;

    const value = Number(manualProgress.trim());

    if (!manualProgress.trim() || !Number.isFinite(value) || value < 0) {
      Alert.alert(
        'Invalid progress',
        'Enter a valid number greater than or equal to zero.',
      );
      return;
    }

    await runAction(
      () => updateFitnessGoal(goal.id, { current_value: value }),
      'Your goal progress has been updated.',
    );
  };

  const confirmStatusChange = (
    status: FitnessGoalStatus,
    title: string,
    message: string,
  ) => {
    if (!goal) return;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: title,
        onPress: () => {
          void runAction(
            () => updateFitnessGoal(goal.id, { goal_status: status }),
            `Goal status changed to ${STATUS_LABELS[status].toLowerCase()}.`,
          );
        },
      },
    ]);
  };

  const handleComplete = () => {
    if (!goal) return;

    Alert.alert(
      'Complete this goal?',
      'This will mark the goal as completed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark completed',
          onPress: () => {
            void runAction(
              () => completeFitnessGoal(goal.id),
              'Your goal has been completed.',
            );
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!goal) return;

    Alert.alert(
      'Delete fitness goal?',
      'This action cannot be undone. Your goal will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsSaving(true);
            void deleteFitnessGoal(goal.id)
              .then(() => {
                router.replace('/(tabs)/personal-workout/goals');
              })
              .catch((error) => {
                Alert.alert(
                  'Unable to delete goal',
                  error instanceof Error
                    ? error.message
                    : 'Please try again.',
                );
              })
              .finally(() => setIsSaving(false));
          },
        },
      ],
    );
  };

  const percentage = progress?.progressPercentage ?? null;
  const progressValue = progress?.currentValue ?? null;
  const isTerminal =
    goal?.goal_status === 'completed' ||
    goal?.goal_status === 'archived';

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
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
            Goal details
          </AppText>

          <View style={{ width: 32 }} />
        </View>

        {isLoading ? (
          <View
            style={{
              paddingVertical: spacing.xxxl,
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <ActivityIndicator color={colors.brand.red} />
            <AppText variant="caption" color={colors.text.secondary}>
              Loading goal details…
            </AppText>
          </View>
        ) : errorMessage || !goal ? (
          <Card variant="outlined" style={{ gap: spacing.md }}>
            <AppText variant="bodySmall" color={colors.text.error}>
              {errorMessage ?? 'This fitness goal could not be found.'}
            </AppText>
            <Button fullWidth onPress={() => void loadGoal()}>
              Try again
            </Button>
            <Button
              fullWidth
              variant="outline"
              onPress={() => router.back()}
            >
              Go back
            </Button>
          </Card>
        ) : (
          <>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="caption" color={colors.brand.red}>
                {GOAL_TYPE_LABELS[goal.goal_type].toUpperCase()}
              </AppText>

              <AppText variant="h1" color={colors.text.primary}>
                {goal.goal_name}
              </AppText>

              {goal.description ? (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  {goal.description}
                </AppText>
              ) : null}

              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: 20,
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

            <Card variant="outlined" style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <TrendingUp size={20} color={colors.brand.red} />
                <AppText variant="bodyMedium" color={colors.text.primary}>
                  Goal progress
                </AppText>
              </View>

              <View style={{ gap: spacing.xs }}>
                <AppText variant="h1" color={colors.text.primary}>
                  {percentage === null ? '—' : `${Math.round(percentage)}%`}
                </AppText>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: percentage ?? 0,
                    text:
                      percentage === null
                        ? 'Progress unavailable'
                        : `${Math.round(percentage)}%`,
                  }}
                  style={{
                    height: 10,
                    borderRadius: 10,
                    overflow: 'hidden',
                    backgroundColor: colors.border.default,
                  }}
                >
                  <View
                    style={{
                      width: `${percentage ?? 0}%`,
                      height: '100%',
                      borderRadius: 10,
                      backgroundColor: colors.brand.red,
                    }}
                  />
                </View>
              </View>

              {progress?.isAvailable && progressValue !== null ? (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  {formatValue(progressValue)}
                  {progress.unit ? ` ${progress.unit}` : ''} of{' '}
                  {formatValue(progress.targetValue)}
                  {progress.unit ? ` ${progress.unit}` : ''}
                </AppText>
              ) : (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Progress is not available yet. Record the required activity
                  to start tracking this goal.
                </AppText>
              )}

              <View style={{ gap: 4 }}>
                <AppText variant="caption" color={colors.text.tertiary}>
                  Target
                </AppText>
                <AppText variant="bodyMedium" color={colors.text.primary}>
                  {formatValue(goal.target_value)}
                  {goal.measurement_unit
                    ? ` ${goal.measurement_unit}`
                    : ''}
                </AppText>
              </View>
            </Card>

            {goal.goal_type === 'custom' && !isTerminal ? (
              <Card variant="outlined" style={{ gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <Target size={20} color={colors.brand.red} />
                  <AppText variant="bodyMedium" color={colors.text.primary}>
                    Update your progress
                  </AppText>
                </View>

                <Input
                  label={`Current progress (${goal.measurement_unit ?? 'units'})`}
                  accessibilityLabel="Current progress"
                  value={manualProgress}
                  onChangeText={setManualProgress}
                  keyboardType="decimal-pad"
                  placeholder="Enter your current progress"
                />

                <Button
                  fullWidth
                  loading={isSaving}
                  disabled={isSaving}
                  onPress={() => void handleManualProgress()}
                >
                  Save progress
                </Button>
              </Card>
            ) : null}

            <Card variant="outlined" style={{ gap: spacing.md }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Goal timeline
              </AppText>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <CalendarDays size={18} color={colors.text.tertiary} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="caption" color={colors.text.secondary}>
                    Start date
                  </AppText>
                  <AppText variant="bodySmall" color={colors.text.primary}>
                    {formatDate(goal.start_date)}
                  </AppText>
                </View>
              </View>

              {goal.target_date ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Target size={18} color={colors.text.tertiary} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText variant="caption" color={colors.text.secondary}>
                      Target date
                    </AppText>
                    <AppText variant="bodySmall" color={colors.text.primary}>
                      {formatDate(goal.target_date)}
                    </AppText>
                  </View>
                </View>
              ) : (
                <AppText variant="caption" color={colors.text.tertiary}>
                  No target date set.
                </AppText>
              )}
            </Card>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Manage goal
              </AppText>

              {!isTerminal ? (
                <>
                  <Button
                    fullWidth
                    variant="outline"
                    leftIcon={<Edit3 size={17} color={colors.text.primary} />}
                    onPress={() =>
                      router.push(
                        `/(tabs)/personal-workout/goals/edit/${goal.id}`,
                      )
                    }
                  >
                    Edit goal
                  </Button>

                  {goal.goal_status === 'active' ? (
                    <Button
                      fullWidth
                      variant="secondary"
                      leftIcon={<Pause size={17} color={colors.text.primary} />}
                      disabled={isSaving}
                      onPress={() =>
                        confirmStatusChange(
                          'paused',
                          'Pause goal',
                          'You can resume this goal whenever you are ready.',
                        )
                      }
                    >
                      Pause goal
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant="secondary"
                      leftIcon={<Play size={17} color={colors.text.primary} />}
                      disabled={isSaving}
                      onPress={() =>
                        confirmStatusChange(
                          'active',
                          'Resume goal',
                          'This goal will become active again.',
                        )
                      }
                    >
                      Resume goal
                    </Button>
                  )}

                  <Button
                    fullWidth
                    leftIcon={
                      <CheckCircle2 size={17} color="#FFFFFF" />
                    }
                    disabled={isSaving}
                    onPress={handleComplete}
                  >
                    Mark as completed
                  </Button>

                  <Button
                    fullWidth
                    variant="outline"
                    leftIcon={<Archive size={17} color={colors.text.primary} />}
                    disabled={isSaving}
                    onPress={() =>
                      confirmStatusChange(
                        'archived',
                        'Archive goal',
                        'This goal will be moved to your archived goals.',
                      )
                    }
                  >
                    Archive goal
                  </Button>
                </>
              ) : goal.goal_status === 'completed' ? (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  This goal has been completed. You can still review its
                  details or archive it.
                </AppText>
              ) : (
                <AppText variant="bodySmall" color={colors.text.secondary}>
                  This goal is archived. You can still review its details.
                </AppText>
              )}

              {goal.goal_status === 'completed' ? (
                <Button
                  fullWidth
                  variant="outline"
                  leftIcon={<Archive size={17} color={colors.text.primary} />}
                  disabled={isSaving}
                  onPress={() =>
                    confirmStatusChange(
                      'archived',
                      'Archive goal',
                      'This completed goal will be moved to your archived goals.',
                    )
                  }
                >
                  Archive goal
                </Button>
              ) : null}

              <Button
                fullWidth
                variant="destructive"
                leftIcon={<Trash2 size={17} color="#FFFFFF" />}
                disabled={isSaving}
                onPress={handleDelete}
              >
                Delete goal
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
