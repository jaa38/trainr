
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useAuth } from '@/providers/AuthProvider';
import {
    completeWorkoutLog,
    getWorkoutLogById,
    updateWorkoutLog,
    type WorkoutExerciseLog,
    type WorkoutLog,
} from '@/services/workout-logs';
import { useTrainrTheme } from '@/theme';

export default function WorkoutSessionScreen() {
    const { colors, spacing } = useTrainrTheme();
    const { user } = useAuth();
    const { width: screenWidth } = useWindowDimensions();
    const exerciseCardWidth = screenWidth - spacing.lg * 2;

    const { assignmentId } = useLocalSearchParams<{
        assignmentId: string;
    }>();

    const logId = Array.isArray(assignmentId)
        ? assignmentId[0]
        : assignmentId;

    const [workout, setWorkout] = useState<WorkoutLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadWorkout = useCallback(async () => {
        if (!user?.id || !logId) {
            setError('Unable to identify this workout.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getWorkoutLogById(logId, user.id);
            setWorkout(result);
        } catch (loadError) {
            console.error('[Workout Session] Unable to load workout:', loadError);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'Unable to load your workout.',
            );
        } finally {
            setIsLoading(false);
        }
    }, [logId, user?.id]);

    useEffect(() => {
        void loadWorkout();
    }, [loadWorkout]);

    const updateSet = (
        exerciseIndex: number,
        setIndex: number,
        field: 'actual_reps' | 'weight' | 'weight_unit' | 'completed',
        value: number | string | boolean | null,
    ) => {
        setWorkout((current) => {
            if (!current) return current;

            const exercises = current.exercise_logs.map((exercise, index) => {
                if (index !== exerciseIndex) return exercise;

                const sets = exercise.sets.map((set, index) => {
                    if (index !== setIndex) return set;

                    return {
                        ...set,
                        [field]: value,
                    };
                });

                return {
                    ...exercise,
                    sets,
                    completed: sets.every((item) => item.completed),
                };
            });

            return {
                ...current,
                exercise_logs: exercises,
            };
        });
    };

    const handleSave = async () => {
        if (!workout || !user?.id || workout.completed_at) return;

        setIsSaving(true);

        try {
            const updated = await updateWorkoutLog(
                workout.id,
                user.id,
                workout.exercise_logs,
                workout.notes,
            );

            setWorkout(updated);

            Alert.alert('Workout saved', 'Your workout progress has been saved.');
        } catch (saveError) {
            Alert.alert(
                'Unable to save',
                saveError instanceof Error
                    ? saveError.message
                    : 'Please try again.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleComplete = () => {
        if (!workout || !user?.id || workout.completed_at) return;

        Alert.alert(
            'Finish workout?',
            'Your workout will be marked as completed.',
            [
                { text: 'Continue training', style: 'cancel' },
                {
                    text: 'Finish workout',
                    onPress: () => {
                        void (async () => {
                            setIsSaving(true);

                            try {
                                await updateWorkoutLog(
                                    workout.id,
                                    user.id,
                                    workout.exercise_logs,
                                    workout.notes,
                                );

                                const completed = await completeWorkoutLog(
                                    workout.id,
                                    user.id,
                                );

                                setWorkout(completed);

                                Alert.alert(
                                    'Workout completed',
                                    `Great work! You trained for ${completed.duration_minutes ?? 0} minutes.`,
                                    [
                                        {
                                            text: 'View history',
                                            onPress: () =>
                                                router.replace('/(tabs)/gym-goer/workouts')
                                        },
                                        {
                                            text: 'Back to workouts',
                                            onPress: () =>
                                                router.replace('/(tabs)/gym-goer/workouts'),
                                        },
                                    ],
                                );
                            } catch (completeError) {
                                Alert.alert(
                                    'Unable to complete workout',
                                    completeError instanceof Error
                                        ? completeError.message
                                        : 'Please try again.',
                                );
                            } finally {
                                setIsSaving(false);
                            }
                        })();
                    },
                },
            ],
        );
    };

    const borderColor = colors.border.default;
    const isCompleted = Boolean(workout?.completed_at);

    if (isLoading) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.background.primary,
                }}
            >
                <ActivityIndicator color={colors.brand.red} />
                <AppText variant="bodySmall" color={colors.text.secondary}>
                    Loading workout...
                </AppText>
            </SafeAreaView>
        );
    }

    if (error || !workout) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    padding: spacing.lg,
                    justifyContent: 'center',
                    backgroundColor: colors.background.primary,
                    gap: spacing.md,
                }}
            >
                <AppText variant="h2" color={colors.text.primary}>
                    UNABLE TO LOAD WORKOUT
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                    {error ?? 'Workout not found.'}
                </AppText>

                <Pressable
                    onPress={() => void loadWorkout()}
                    style={{
                        padding: spacing.md,
                        borderRadius: 12,
                        backgroundColor: colors.brand.red,
                        alignItems: 'center',
                    }}
                >
                    <AppText variant="button" color="#FFFFFF">
                        Try again
                    </AppText>
                </Pressable>

                <Pressable
                    onPress={() => router.back()}
                    style={{ alignItems: 'center', padding: spacing.sm }}
                >
                    <AppText variant="button" color={colors.text.secondary}>
                        Go back
                    </AppText>
                </Pressable>
            </SafeAreaView>
        );
    }

    const completedSets = workout.exercise_logs.reduce(
        (total, exercise) =>
            total + exercise.sets.filter((set) => set.completed).length,
        0,
    );

    const totalSets = workout.exercise_logs.reduce(
        (total, exercise) => total + exercise.sets.length,
        0,
    );

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
                    padding: spacing.lg,
                    paddingBottom: spacing.xxl,
                    gap: spacing.xl,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ gap: spacing.sm }}>
                    <Pressable
                        onPress={() => router.back()}
                        style={{ alignSelf: 'flex-start', paddingVertical: spacing.sm }}
                    >
                        <AppText variant="button" color={colors.text.secondary}>
                            ← Back to workouts
                        </AppText>
                    </Pressable>

                    <AppText variant="caption" color={colors.brand.red}>
                        YOUR TRAINING SESSION
                    </AppText>

                    <AppText variant="displayLarge" color={colors.text.primary}>
                        {isCompleted ? 'WORKOUT DONE.' : 'LET’S TRAIN.'}
                    </AppText>

                    <AppText variant="bodySmall" color={colors.text.secondary}>
                        {workout.exercise_logs[0]?.day_name ?? 'Training session'}
                    </AppText>
                </View>

                <Card variant="default" style={{ gap: spacing.md }}>
                    <AppText variant="caption" color={colors.text.tertiary}>
                        SESSION PROGRESS
                    </AppText>

                    <AppText variant="h2" color={colors.text.primary}>
                        {completedSets} / {totalSets} SETS
                    </AppText>

                    <View
                        style={{
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: colors.background.secondary,
                            overflow: 'hidden',
                        }}
                    >
                        <View
                            style={{
                                width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                                height: '100%',
                                backgroundColor: colors.brand.red,
                            }}
                        />
                    </View>

                    <AppText variant="caption" color={colors.text.secondary}>
                        {workout.exercise_logs.length} exercises
                    </AppText>

                    {isCompleted ? (
                        <AppText variant="button" color={colors.brand.red}>
                            COMPLETED · {workout.duration_minutes ?? 0} MINUTES
                        </AppText>
                    ) : null}
                </Card>

                <View style={{ gap: spacing.md }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <AppText variant="h2" color={colors.text.primary}>
                            EXERCISES
                        </AppText>

                        <AppText variant="caption" color={colors.text.tertiary}>
                            {activeExerciseIndex + 1} OF {workout.exercise_logs.length}
                        </AppText>
                    </View>

                    <ScrollView
                        horizontal
                        pagingEnabled
                        snapToInterval={exerciseCardWidth + spacing.md}
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(event) => {
                            const index = Math.round(
                                event.nativeEvent.contentOffset.x /
                                    (exerciseCardWidth + spacing.md),
                            );

                            setActiveExerciseIndex(
                                Math.min(
                                    Math.max(index, 0),
                                    workout.exercise_logs.length - 1,
                                ),
                            );
                        }}
                        contentContainerStyle={{
                            gap: spacing.md,
                        }}
                    >
                        {workout.exercise_logs.map(
                            (exercise: WorkoutExerciseLog, exerciseIndex) => (
                                <Card
                                    key={exercise.plan_exercise_id}
                                    variant="default"
                                    style={{
                                        width: exerciseCardWidth,
                                        gap: spacing.lg,
                                    }}
                                >
                                <View style={{ gap: spacing.xs }}>
                                    <AppText variant="h3" color={colors.text.primary}>
                                        {exercise.exercise_name}
                                    </AppText>

                                    <AppText variant="caption" color={colors.text.tertiary}>
                                        {exercise.target_sets} SETS · {exercise.target_repetitions} REPS
                                    </AppText>

                                    {exercise.rest_seconds !== null ? (
                                        <AppText
                                            variant="caption"
                                            color={colors.text.secondary}
                                        >
                                            Rest: {exercise.rest_seconds} seconds
                                        </AppText>
                                    ) : null}

                                    {exercise.notes ? (
                                        <AppText
                                            variant="bodySmall"
                                            color={colors.text.secondary}
                                        >
                                            {exercise.notes}
                                        </AppText>
                                    ) : null}
                                </View>

                                <View style={{ gap: spacing.sm }}>
                                    {exercise.sets.map((set, setIndex) => (
                                        <View
                                            key={set.set_number}
                                            style={{
                                                padding: spacing.md,
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: set.completed
                                                    ? colors.brand.red
                                                    : borderColor,
                                                backgroundColor: colors.background.primary,
                                                gap: spacing.md,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                }}
                                            >
                                                <AppText
                                                    variant="button"
                                                    color={colors.text.primary}
                                                >
                                                    SET {set.set_number}
                                                </AppText>

                                                <AppText
                                                    variant="caption"
                                                    color={set.completed
                                                        ? colors.brand.red
                                                        : colors.text.tertiary}
                                                >
                                                    {set.completed ? 'COMPLETED' : 'NOT COMPLETED'}
                                                </AppText>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                <View style={{ flex: 1, gap: spacing.xs }}>
                                                    <AppText
                                                        variant="caption"
                                                        color={colors.text.secondary}
                                                    >
                                                        ACTUAL REPS
                                                    </AppText>

                                                    <TextInput
                                                        editable={!isCompleted}
                                                        keyboardType="number-pad"
                                                        value={
                                                            set.actual_reps === null
                                                                ? ''
                                                                : String(set.actual_reps)
                                                        }
                                                        onChangeText={(value) =>
                                                            updateSet(
                                                                exerciseIndex,
                                                                setIndex,
                                                                'actual_reps',
                                                                value.trim() === '' ? null : Number(value),
                                                            )
                                                        }
                                                        placeholder="Reps"
                                                        placeholderTextColor={colors.text.tertiary}
                                                        style={{
                                                            minHeight: 48,
                                                            paddingHorizontal: spacing.md,
                                                            borderRadius: 10,
                                                            borderWidth: 1,
                                                            borderColor,
                                                            color: colors.text.primary,
                                                            backgroundColor: colors.background.secondary,
                                                        }}
                                                    />
                                                </View>

                                                <View style={{ flex: 1, gap: spacing.xs }}>
                                                    <AppText
                                                        variant="caption"
                                                        color={colors.text.secondary}
                                                    >
                                                        WEIGHT
                                                    </AppText>

                                                    <TextInput
                                                        editable={!isCompleted}
                                                        keyboardType="decimal-pad"
                                                        value={
                                                            set.weight === null ? '' : String(set.weight)
                                                        }
                                                        onChangeText={(value) =>
                                                            updateSet(
                                                                exerciseIndex,
                                                                setIndex,
                                                                'weight',
                                                                value.trim() === '' ? null : Number(value),
                                                            )
                                                        }
                                                        placeholder="Weight"
                                                        placeholderTextColor={colors.text.tertiary}
                                                        style={{
                                                            minHeight: 48,
                                                            paddingHorizontal: spacing.md,
                                                            borderRadius: 10,
                                                            borderWidth: 1,
                                                            borderColor,
                                                            color: colors.text.primary,
                                                            backgroundColor: colors.background.secondary,
                                                        }}
                                                    />
                                                </View>
                                            </View>

                                            {!isCompleted ? (
                                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                    {(['kg', 'lb'] as const).map((unit) => (
                                                        <Pressable
                                                            key={unit}
                                                            onPress={() =>
                                                                updateSet(
                                                                    exerciseIndex,
                                                                    setIndex,
                                                                    'weight_unit',
                                                                    unit,
                                                                )
                                                            }
                                                            style={{
                                                                paddingHorizontal: spacing.md,
                                                                paddingVertical: spacing.sm,
                                                                borderRadius: 999,
                                                                borderWidth: 1,
                                                                borderColor:
                                                                    set.weight_unit === unit
                                                                        ? colors.brand.red
                                                                        : borderColor,
                                                                backgroundColor:
                                                                    set.weight_unit === unit
                                                                        ? colors.brand.redLight
                                                                        : colors.background.primary,
                                                            }}
                                                        >
                                                            <AppText
                                                                variant="caption"
                                                                color={
                                                                    set.weight_unit === unit
                                                                        ? colors.brand.red
                                                                        : colors.text.secondary
                                                                }
                                                            >
                                                                {unit.toUpperCase()}
                                                            </AppText>
                                                        </Pressable>
                                                    ))}
                                                </View>
                                            ) : null}

                                            {!isCompleted ? (
                                                <Pressable
                                                    onPress={() =>
                                                        updateSet(
                                                            exerciseIndex,
                                                            setIndex,
                                                            'completed',
                                                            !set.completed,
                                                        )
                                                    }
                                                    style={{
                                                        minHeight: 46,
                                                        borderRadius: 10,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: set.completed
                                                            ? colors.background.secondary
                                                            : colors.brand.red,
                                                    }}
                                                >
                                                    <AppText
                                                        variant="button"
                                                        color={set.completed
                                                            ? colors.text.primary
                                                            : '#FFFFFF'}
                                                    >
                                                        {set.completed ? 'Undo set' : 'Complete set'}
                                                    </AppText>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                                </Card>
                            ),
                        )}
                    </ScrollView>

                    {workout.exercise_logs.length > 1 ? (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: spacing.sm,
                            }}
                        >
                            <AppText
                                variant="caption"
                                color={colors.text.tertiary}
                            >
                                <AppText variant="caption" color={colors.brand.red}>
                                    ←
                                </AppText>
                                {'  '}SWIPE TO EXPLORE EXERCISES{'  '}
                                <AppText variant="caption" color={colors.brand.red}>
                                    →
                                </AppText>
                            </AppText>
                        </View>
                    ) : null}
                </View>

                <View style={{ gap: spacing.sm }}>
                    <AppText variant="caption" color={colors.text.secondary}>
                        SESSION NOTES
                    </AppText>

                    <TextInput
                        editable={!isCompleted}
                        multiline
                        value={workout.notes ?? ''}
                        onChangeText={(value) =>
                            setWorkout((current) =>
                                current ? { ...current, notes: value } : current,
                            )
                        }
                        placeholder="How did your workout feel?"
                        placeholderTextColor={colors.text.tertiary}
                        textAlignVertical="top"
                        style={{
                            minHeight: 110,
                            padding: spacing.md,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor,
                            color: colors.text.primary,
                            backgroundColor: colors.background.secondary,
                        }}
                    />
                </View>

                {!isCompleted ? (
                    <View style={{ gap: spacing.md }}>
                        <Pressable
                            disabled={isSaving}
                            onPress={() => void handleSave()}
                            style={{
                                minHeight: 54,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor,
                                backgroundColor: colors.background.secondary,
                                opacity: isSaving ? 0.6 : 1,
                            }}
                        >
                            <AppText variant="button" color={colors.text.primary}>
                                {isSaving ? 'Saving...' : 'Save workout progress'}
                            </AppText>
                        </Pressable>

                        <Pressable
                            disabled={isSaving}
                            onPress={handleComplete}
                            style={{
                                minHeight: 56,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                                backgroundColor: colors.brand.red,
                                opacity: isSaving ? 0.6 : 1,
                            }}
                        >
                            <AppText variant="button" color="#FFFFFF">
                                {isSaving ? 'Please wait...' : 'Finish workout'}
                            </AppText>
                        </Pressable>
                    </View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}
