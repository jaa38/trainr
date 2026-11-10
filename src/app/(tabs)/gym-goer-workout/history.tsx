
import { router, useFocusEffect } from 'expo-router';
import {
    ArrowLeft,
    ArrowRight,
    Clock,
    Dumbbell,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useAuth } from '@/providers/AuthProvider';
import {
    clearWorkoutHistory,
    getWorkoutHistory,
    type WorkoutLog,
} from '@/services/workout-logs';
import { useTrainrTheme } from '@/theme';

function formatWorkoutDate(date: string) {
    return new Date(date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function WorkoutHistoryScreen() {
    const { colors, spacing } = useTrainrTheme();
    const { user } = useAuth();

    const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClearing, setIsClearing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load workout history
    const loadHistory = useCallback(async () => {
        if (!user?.id) {
            setErrorMessage('Please sign in to view your workout history.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const result = await getWorkoutHistory(user.id);
            setWorkouts(result);
        } catch (error) {
            console.error(
                '[Workout History] Unable to load history:',
                error,
            );

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to load your workout history.',
            );
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    // Refresh history whenever the screen regains focus
    useFocusEffect(
        useCallback(() => {
            void loadHistory();
        }, [loadHistory]),
    );

    // Clear all workout history
    const handleClearHistory = () => {
        if (!user?.id || isClearing || workouts.length === 0) {
            return;
        }

        Alert.alert(
            'Clear workout history?',
            'This will permanently delete all your workout logs, including completed and unfinished workouts. Your assigned programmes and payments will not be affected.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Clear History',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            setIsClearing(true);
                            setErrorMessage(null);

                            try {
                                await clearWorkoutHistory(user.id);
                                setWorkouts([]);

                                Alert.alert(
                                    'History cleared',
                                    'Your workout history is now empty.',
                                );
                            } catch (error) {
                                console.error(
                                    '[Workout History] Failed to clear history:',
                                    error,
                                );

                                setErrorMessage(
                                    error instanceof Error
                                        ? error.message
                                        : 'Unable to clear workout history.',
                                );
                            } finally {
                                setIsClearing(false);
                            }
                        })();
                    },
                },
            ],
        );
    };

    // Open workout session
    const openWorkout = (workout: WorkoutLog) => {
        router.push({
            pathname:
                '/(tabs)/gym-goer-workout/session/[assignmentId]',
            params: {
                assignmentId: workout.id,
            },
        });
    };

    // Workout filters
    const completedWorkouts = workouts.filter(
        (workout) => workout.completed_at !== null,
    );

    const inProgressWorkouts = workouts.filter(
        (workout) => workout.completed_at === null,
    );

    // Workout statistics
    const totalExercises = (workout: WorkoutLog) =>
        workout.exercise_logs.length;

    const totalSets = (workout: WorkoutLog) =>
        workout.exercise_logs.reduce(
            (total, exercise) => total + exercise.sets.length,
            0,
        );

    const borderColor = colors.border.default;

    // Workout history card
    const renderWorkoutCard = (workout: WorkoutLog) => {
        const isCompleted = workout.completed_at !== null;

        const workoutName =
            workout.exercise_logs[0]?.day_name ?? 'Workout session';

        return (
            <Pressable
                key={workout.id}
                accessibilityRole="button"
                accessibilityLabel={
                    `${isCompleted ? 'View' : 'Resume'} ${workoutName} workout`
                }
                onPress={() => openWorkout(workout)}
            >
                <Card
                    variant="outlined"
                    style={{
                        gap: spacing.md,
                        padding: spacing.lg,
                    }}
                >
                    {/* Workout Header */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: spacing.sm,
                            }}
                        >
                            <View
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    backgroundColor: colors.background.secondary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Dumbbell
                                    size={20}
                                    color={colors.brand.red}
                                />
                            </View>

                            <View style={{ gap: 2 }}>
                                <AppText
                                    variant="h3"
                                    color={colors.text.primary}
                                >
                                    {workoutName}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    color={colors.text.tertiary}
                                >
                                    {formatWorkoutDate(workout.started_at)}
                                </AppText>
                            </View>
                        </View>

                        {/* Workout Status */}
                        <View
                            style={{
                                paddingHorizontal: spacing.sm,
                                paddingVertical: spacing.xs,
                                borderRadius: 999,
                                backgroundColor: isCompleted
                                    ? colors.brand.redLight
                                    : colors.background.secondary,
                            }}
                        >
                            <AppText
                                variant="caption"
                                color={
                                    isCompleted
                                        ? colors.brand.red
                                        : colors.text.secondary
                                }
                            >
                                {isCompleted
                                    ? 'COMPLETED'
                                    : 'IN PROGRESS'}
                            </AppText>
                        </View>
                    </View>

                    {/* Workout Statistics */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.lg,
                            flexWrap: 'wrap',
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: spacing.xs,
                            }}
                        >
                            <Dumbbell
                                size={15}
                                color={colors.text.tertiary}
                            />

                            <AppText
                                variant="caption"
                                color={colors.text.secondary}
                            >
                                {totalExercises(workout)} exercises
                            </AppText>
                        </View>

                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: spacing.xs,
                            }}
                        >
                            <Clock
                                size={15}
                                color={colors.text.tertiary}
                            />

                            <AppText
                                variant="caption"
                                color={colors.text.secondary}
                            >
                                {workout.duration_minutes !== null
                                    ? `${workout.duration_minutes} min`
                                    : 'Duration unavailable'}
                            </AppText>
                        </View>

                        <AppText
                            variant="caption"
                            color={colors.text.secondary}
                        >
                            {totalSets(workout)} sets
                        </AppText>
                    </View>

                    {/* Workout Action */}
                    <View
                        style={{
                            borderTopWidth: 1,
                            borderTopColor: borderColor,
                            paddingTop: spacing.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <AppText
                            variant="button"
                            color={colors.brand.red}
                        >
                            {isCompleted
                                ? 'View Workout'
                                : 'Resume Workout'}
                        </AppText>

                        <ArrowRight
                            size={18}
                            color={colors.brand.red}
                        />
                    </View>
                </Card>
            </Pressable>
        );
    };

    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{
                flex: 1,
                backgroundColor: colors.background.primary,
            }}
        >
            {/* Scrollable Workout History Content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: spacing.xl,
                    gap: spacing.xl,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={{ gap: spacing.md }}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        onPress={() => router.back()}
                        style={{
                            alignSelf: 'flex-start',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingVertical: spacing.xs,
                        }}
                    >
                        <ArrowLeft
                            size={20}
                            color={colors.text.primary}
                        />

                        <AppText
                            variant="bodySmall"
                            color={colors.text.secondary}
                        >
                            Back
                        </AppText>
                    </Pressable>

                    <View style={{ gap: spacing.xs }}>
                        <AppText
                            variant="caption"
                            color={colors.brand.red}
                        >
                            YOUR TRAINING
                        </AppText>

                        <AppText
                            variant="displayLarge"
                            color={colors.text.primary}
                        >
                            HISTORY.
                        </AppText>

                        <AppText
                            variant="body"
                            color={colors.text.secondary}
                        >
                            Review your workouts and track your training journey.
                        </AppText>
                    </View>
                </View>

                {/* Workout Summary */}
                {!isLoading && !errorMessage ? (
                    <View
                        style={{
                            flexDirection: 'row',
                            gap: spacing.md,
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Card
                                variant="outlined"
                                style={{
                                    padding: spacing.md,
                                    gap: spacing.xs,
                                }}
                            >
                                <AppText
                                    variant="displayLarge"
                                    color={colors.text.primary}
                                >
                                    {workouts.length}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    color={colors.text.secondary}
                                >
                                    TOTAL WORKOUTS
                                </AppText>
                            </Card>
                        </View>

                        <View style={{ flex: 1 }}>
                            <Card
                                variant="outlined"
                                style={{
                                    padding: spacing.md,
                                    gap: spacing.xs,
                                }}
                            >
                                <AppText
                                    variant="displayLarge"
                                    color={colors.text.primary}
                                >
                                    {completedWorkouts.length}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    color={colors.text.secondary}
                                >
                                    COMPLETED
                                </AppText>
                            </Card>
                        </View>
                    </View>
                ) : null}

                {/* Loading State */}
                {isLoading ? (
                    <Card
                        variant="outlined"
                        style={{ gap: spacing.sm }}
                    >
                        <AppText
                            variant="body"
                            color={colors.text.secondary}
                        >
                            Loading your workout history...
                        </AppText>
                    </Card>
                ) : errorMessage ? (
                    /* Error State */
                    <Card
                        variant="outlined"
                        style={{ gap: spacing.md }}
                    >
                        <AppText
                            variant="body"
                            color={colors.text.error}
                        >
                            {errorMessage}
                        </AppText>

                        <Pressable
                            accessibilityRole="button"
                            onPress={() => void loadHistory()}
                            style={{
                                alignSelf: 'flex-start',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.sm,
                                borderRadius: 10,
                                backgroundColor: colors.brand.red,
                            }}
                        >
                            <AppText
                                variant="button"
                                color="#FFFFFF"
                            >
                                Try again
                            </AppText>
                        </Pressable>
                    </Card>
                ) : workouts.length === 0 ? (
                    /* Empty State */
                    <Card
                        variant="outlined"
                        style={{
                            alignItems: 'center',
                            padding: spacing.xl,
                            gap: spacing.md,
                        }}
                    >
                        <Dumbbell
                            size={36}
                            color={colors.text.tertiary}
                        />

                        <AppText
                            variant="h3"
                            color={colors.text.primary}
                        >
                            NO WORKOUTS YET
                        </AppText>

                        <AppText
                            variant="bodySmall"
                            color={colors.text.secondary}
                        >
                            Your workout sessions will appear here once you start
                            training.
                        </AppText>
                    </Card>
                ) : (
                    <>
                        {/* In Progress Workouts */}
                        {inProgressWorkouts.length > 0 ? (
                            <View style={{ gap: spacing.md }}>
                                <View style={{ gap: spacing.xs }}>
                                    <AppText
                                        variant="h2"
                                        color={colors.text.primary}
                                    >
                                        IN PROGRESS
                                    </AppText>

                                    <AppText
                                        variant="bodySmall"
                                        color={colors.text.secondary}
                                    >
                                        Pick up where you left off.
                                    </AppText>
                                </View>

                                {inProgressWorkouts.map(renderWorkoutCard)}
                            </View>
                        ) : null}

                        {/* Completed Workouts */}
                        {completedWorkouts.length > 0 ? (
                            <View style={{ gap: spacing.md }}>
                                <View style={{ gap: spacing.xs }}>
                                    <AppText
                                        variant="h2"
                                        color={colors.text.primary}
                                    >
                                        COMPLETED WORKOUTS
                                    </AppText>

                                    <AppText
                                        variant="bodySmall"
                                        color={colors.text.secondary}
                                    >
                                        Your previous training sessions.
                                    </AppText>
                                </View>

                                {completedWorkouts.map(renderWorkoutCard)}
                            </View>
                        ) : null}
                    </>
                )}
            </ScrollView>

            {/* Fixed Bottom Footer */}
            {workouts.length > 0 && !isLoading && !errorMessage ? (
                <View
                    style={{
                        paddingHorizontal: spacing.lg,
                        paddingTop: spacing.md,
                        paddingBottom: spacing.md,
                        backgroundColor: colors.background.primary,
                        borderTopWidth: 1,
                        borderTopColor: colors.border.default,
                    }}
                >
                    <Button
                        variant='primary'
                        size="large"
                        fullWidth
                        loading={isClearing}
                        disabled={isClearing}
                        accessibilityLabel="Clear all workout history"
                        onPress={handleClearHistory}
                        style={{
                            minHeight: 56,
                            borderWidth: 1,
                            borderColor: colors.brand.red,
                            borderRadius: 12,
                        }}
                    >
                        Clear Workout History
                    </Button>
                </View>
            ) : null}
        </SafeAreaView>
    );
}
