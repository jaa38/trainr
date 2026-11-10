
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useAuth } from '@/providers/AuthProvider';
import {
  getClientWorkoutAssignments,
  type WorkoutAssignment,
} from '@/services/workout-assignments';
import { useTrainrTheme } from '@/theme';

import {
  getExploreWorkoutPlans,
  type ExploreWorkoutPlan,
} from '@/services/explore-workouts';

type WorkoutCategory = 'All' | 'Strength' | 'Cardio' | 'Mobility';

type PublishedExercise = {
  id: string;
  exercise_id: string;
  day_number: number;
  day_name: string | null;
  exercise_order: number;
  sets: number;
  repetitions: string;
  rest_seconds: number | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    muscle_group: string | null;
    category: string | null;
    equipment: string[] | null;
    instructions: string | null;
    image_url: string | null;
    video_url: string | null;
  };
};

type PublishedPlanSnapshot = {
  workout_plan_id: string;
  trainer_id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  duration_weeks: number | null;
  version: number;
  published_at: string;
  exercises: PublishedExercise[];
};

type TrainingDay = {
  dayNumber: number;
  dayName: string;
  exercises: PublishedExercise[];
};

const categories: WorkoutCategory[] = [
  'All',
  'Strength',
  'Cardio',
  'Mobility',
];

function getPublishedSnapshot(
  assignment: WorkoutAssignment,
): PublishedPlanSnapshot | null {
  const snapshot = assignment.plan_snapshot;

  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    typeof snapshot.name !== 'string' ||
    !Array.isArray(snapshot.exercises)
  ) {
    return null;
  }

  return snapshot as unknown as PublishedPlanSnapshot;
}

function groupExercisesByDay(
  exercises: PublishedExercise[],
): TrainingDay[] {
  const days = exercises.reduce<TrainingDay[]>((result, exercise) => {
    let day = result.find(
      (item) => item.dayNumber === exercise.day_number,
    );

    if (!day) {
      day = {
        dayNumber: exercise.day_number,
        dayName: exercise.day_name || `Day ${exercise.day_number}`,
        exercises: [],
      };

      result.push(day);
    }

    day.exercises.push(exercise);

    return result;
  }, []);

  days.forEach((day) => {
    day.exercises.sort(
      (a, b) => a.exercise_order - b.exercise_order,
    );
  });

  return days.sort((a, b) => a.dayNumber - b.dayNumber);
}

export default function WorkoutsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, profile } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const dayCardWidth = screenWidth - spacing.lg * 2;

  const [selectedCategory, setSelectedCategory] =
    useState<WorkoutCategory>('All');

  const [selectedWorkout, setSelectedWorkout] =
    useState<string | null>(null);

  const [assignments, setAssignments] =
    useState<WorkoutAssignment[]>([]);

  const [isLoadingAssignments, setIsLoadingAssignments] =
    useState(true);

  const [assignmentError, setAssignmentError] =
    useState<string | null>(null);

  const [exploreWorkouts, setExploreWorkouts] =
    useState<ExploreWorkoutPlan[]>([]);

  const [isLoadingExploreWorkouts, setIsLoadingExploreWorkouts] =
    useState(true);

  const [exploreWorkoutsError, setExploreWorkoutsError] =
    useState<string | null>(null);

  const filteredExploreWorkouts = exploreWorkouts.filter(
    (workout) => {
      if (selectedCategory === 'All') {
        return true;
      }

      return workout.exercises.some(
        (item) =>
          item.exercise.category?.toLowerCase() ===
          selectedCategory.toLowerCase(),
      );
    },
  );

  const [expandedExercises, setExpandedExercises] =
    useState<string[]>([]);

  const loadAssignments = useCallback(async () => {
    if (!user?.id || profile?.role !== 'gym_goer') {
      setAssignments([]);
      setIsLoadingAssignments(false);
      return;
    }

    setIsLoadingAssignments(true);
    setAssignmentError(null);

    try {
      const result = await getClientWorkoutAssignments(user.id);

      setAssignments(
        result.filter((assignment) => assignment.status === 'active'),
      );
    } catch (error) {
      console.error(
        '[Workouts] Unable to load assigned programmes:',
        error,
      );

      setAssignmentError(
        error instanceof Error
          ? error.message
          : 'Unable to load your training programmes.',
      );
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [user?.id, profile?.role]);

  const loadExploreWorkouts = useCallback(async () => {
    if (!user?.id || profile?.role !== 'gym_goer') {
      setExploreWorkouts([]);
      setIsLoadingExploreWorkouts(false);
      return;
    }

    setIsLoadingExploreWorkouts(true);
    setExploreWorkoutsError(null);

    try {
      const result = await getExploreWorkoutPlans();
      setExploreWorkouts(result);
    } catch (error) {
      console.error(
        '[Workouts] Unable to load Explore Workouts:',
        error,
      );

      setExploreWorkoutsError(
        error instanceof Error
          ? error.message
          : 'Unable to load published workouts.',
      );
    } finally {
      setIsLoadingExploreWorkouts(false);
    }
  }, [user?.id, profile?.role]);

  useFocusEffect(
    useCallback(() => {
      void loadAssignments();
      void loadExploreWorkouts();
    }, [loadAssignments, loadExploreWorkouts]),
  );

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  };

  const borderColor = colors.border.default;

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
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 150,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* Page Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.brand.red}>
            YOUR TRAINING
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            WORKOUTS.
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            Train with purpose. Build consistency. Track your progress.
          </AppText>
        </View>

        {/* My Training Plan */}
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="h2" color={colors.text.primary}>
              MY TRAINING PLAN
            </AppText>

            {assignments.length > 0 && !isLoadingAssignments ? (
              <AppText variant="caption" color={colors.text.tertiary}>
                {assignments.length} ACTIVE
              </AppText>
            ) : null}
          </View>

          {/* Loading State */}
          {isLoadingAssignments ? (
            <Card variant="outlined">
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Loading your training programmes...
              </AppText>
            </Card>
          ) : assignmentError ? (
            <Card
              variant="outlined"
              style={{
                borderColor: colors.brand.red,
                gap: spacing.md,
              }}
            >
              <AppText variant="bodySmall" color={colors.text.error}>
                {assignmentError}
              </AppText>

              <Pressable
                accessibilityRole="button"
                onPress={() => void loadAssignments()}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 10,
                  backgroundColor: colors.brand.red,
                }}
              >
                <AppText variant="button" color="#FFFFFF">
                  Try again
                </AppText>
              </Pressable>
            </Card>
          ) : assignments.length === 0 ? (
            <Card variant="outlined" style={{ gap: spacing.sm }}>
              <AppText variant="h3" color={colors.text.primary}>
                NO ASSIGNED PROGRAMMES
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                Your trainer's personalised workout programmes will appear
                here when assigned to you.
              </AppText>
            </Card>
          ) : (
            assignments.map((assignment) => {
              const plan = getPublishedSnapshot(assignment);

              if (!plan) {
                return (
                  <Card key={assignment.id} variant="outlined">
                    <AppText
                      variant="bodySmall"
                      color={colors.text.secondary}
                    >
                      Unable to display this programme's published snapshot.
                    </AppText>
                  </Card>
                );
              }

              const trainingDays = groupExercisesByDay(plan.exercises);

              return (
                <View
                  key={assignment.id}
                  style={{ gap: spacing.md }}
                >
                  {/* Programme Summary */}
                  <Card
                    variant="default"
                    style={{
                      gap: spacing.lg,
                    }}
                  >
                    {/* Programme Name and Status */}
                    <View style={{ gap: spacing.md }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: spacing.md,
                        }}
                      >
                        <View style={{ flex: 1, gap: spacing.sm }}>
                          <View
                            style={{
                              width: 36,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: colors.brand.red,
                            }}
                          />

                          <AppText
                            variant="h3"
                            color={colors.text.primary}
                          >
                            {plan.name}
                          </AppText>

                          <View
                            style={{
                              alignSelf: 'flex-start',
                              paddingHorizontal: spacing.sm,
                              paddingVertical: spacing.xs,
                              borderRadius: 8,
                              backgroundColor: colors.background.secondary,
                              borderWidth: 1,
                              borderColor,
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={colors.text.tertiary}
                            >
                              VERSION {assignment.plan_version}
                            </AppText>
                          </View>
                        </View>

                        <View
                          style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                            borderRadius: 999,
                            backgroundColor: colors.brand.redLight,
                          }}
                        >
                          <AppText
                            variant="caption"
                            color={colors.brand.red}
                          >
                            ACTIVE
                          </AppText>
                        </View>
                      </View>

                      {plan.description ? (
                        <AppText
                          variant="body"
                          color={colors.text.secondary}
                        >
                          {plan.description}
                        </AppText>
                      ) : null}
                    </View>

                    {/* Programme Statistics */}
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                      }}
                    >
                      {[
                        ...(plan.duration_weeks
                          ? [`${plan.duration_weeks} weeks`]
                          : []),
                        `${plan.exercises.length} exercises`,
                        `${trainingDays.length} training days`,
                      ].map((item) => (
                        <View
                          key={item}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            borderRadius: 10,
                            backgroundColor: colors.background.primary,
                            borderWidth: 1,
                            borderColor,
                          }}
                        >
                          <AppText
                            variant="caption"
                            color={colors.text.secondary}
                          >
                            {item}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    {plan.objectives ? (
                      <View
                        style={{
                          paddingTop: spacing.md,
                          borderTopWidth: 1,
                          borderTopColor: borderColor,
                          gap: spacing.sm,
                        }}
                      >
                        <AppText
                          variant="caption"
                          color={colors.text.primary}
                        >
                          TRAINING OBJECTIVES
                        </AppText>

                        <AppText
                          variant="bodySmall"
                          color={colors.text.secondary}
                        >
                          {plan.objectives}
                        </AppText>
                      </View>
                    ) : null}
                  </Card>

                  {/* Your Programme Heading */}
                  <AppText
                    variant="h2"
                    color={colors.text.primary}
                  >
                    YOUR PROGRAMME
                  </AppText>

                  {/* Swipeable Training Days */}
                  <ScrollView
                    horizontal
                    pagingEnabled
                    snapToInterval={dayCardWidth + spacing.md}
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      gap: spacing.md,
                    }}
                  >
                    {trainingDays.map((day) => (
                      <Card
                        key={`${assignment.id}-${day.dayNumber}`}
                        variant="default"
                        style={{
                          width: dayCardWidth,
                          gap: spacing.lg,
                        }}
                      >
                        {/* Day Header */}
                        <View style={{ gap: spacing.xs }}>
                          <View
                            style={{
                              width: 36,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: colors.brand.red,
                            }}
                          />

                          <AppText
                            variant="h2"
                            color={colors.text.primary}
                          >
                            {day.dayName.toUpperCase()}
                          </AppText>

                          <AppText
                            variant="caption"
                            color={colors.text.tertiary}
                          >
                            {day.exercises.length} EXERCISES
                          </AppText>
                        </View>

                        {/* Day Exercises */}
                        <View style={{ gap: spacing.md }}>
                          {day.exercises.map((item, index) => {
                            const exerciseKey =
                              `${assignment.id}-${item.id}`;

                            const expanded =
                              expandedExercises.includes(exerciseKey);

                            const exercise = item.exercise;

                            return (
                              <Card
                                key={item.id}
                                variant="outlined"
                                style={{
                                  backgroundColor:
                                    colors.background.primary,
                                  gap: spacing.md,
                                }}
                              >
                                {/* Exercise Header */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.md,
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 12,
                                      backgroundColor: colors.brand.redLight,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <AppText
                                      variant="button"
                                      color={colors.brand.red}
                                    >
                                      {String(index + 1).padStart(2, '0')}
                                    </AppText>
                                  </View>

                                  <View
                                    style={{
                                      flex: 1,
                                      gap: spacing.xs,
                                    }}
                                  >
                                    <AppText
                                      variant="h4"
                                      color={colors.text.primary}
                                    >
                                      {exercise.name}
                                    </AppText>

                                    {exercise.muscle_group ? (
                                      <AppText
                                        variant="caption"
                                        color={colors.text.tertiary}
                                      >
                                        {exercise.muscle_group}
                                      </AppText>
                                    ) : null}
                                  </View>
                                </View>

                                {/* Exercise Prescription */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: spacing.sm,
                                  }}
                                >
                                  {[
                                    `${item.sets} sets`,
                                    `${item.repetitions} reps`,
                                    ...(item.rest_seconds !== null
                                      ? [`${item.rest_seconds}s rest`]
                                      : []),
                                  ].map((detail) => (
                                    <View
                                      key={detail}
                                      style={{
                                        paddingHorizontal: spacing.md,
                                        paddingVertical: spacing.sm,
                                        borderRadius: 10,
                                        backgroundColor:
                                          colors.background.secondary,
                                        borderWidth: 1,
                                        borderColor,
                                      }}
                                    >
                                      <AppText
                                        variant="caption"
                                        color={colors.text.secondary}
                                      >
                                        {detail}
                                      </AppText>
                                    </View>
                                  ))}
                                </View>

                                {/* Expanded Details */}
                                {expanded ? (
                                  <View
                                    style={{
                                      paddingTop: spacing.sm,
                                      borderTopWidth: 1,
                                      borderTopColor: borderColor,
                                      gap: spacing.md,
                                    }}
                                  >
                                    {exercise.description ? (
                                      <AppText
                                        variant="bodySmall"
                                        color={colors.text.secondary}
                                      >
                                        {exercise.description}
                                      </AppText>
                                    ) : null}

                                    {exercise.instructions ? (
                                      <View style={{ gap: spacing.xs }}>
                                        <AppText
                                          variant="caption"
                                          color={colors.text.primary}
                                        >
                                          INSTRUCTIONS
                                        </AppText>

                                        <AppText
                                          variant="bodySmall"
                                          color={colors.text.secondary}
                                        >
                                          {exercise.instructions}
                                        </AppText>
                                      </View>
                                    ) : null}

                                    {item.notes ? (
                                      <View style={{ gap: spacing.xs }}>
                                        <AppText
                                          variant="caption"
                                          color={colors.text.primary}
                                        >
                                          TRAINER NOTES
                                        </AppText>

                                        <AppText
                                          variant="bodySmall"
                                          color={colors.text.secondary}
                                        >
                                          {item.notes}
                                        </AppText>
                                      </View>
                                    ) : null}

                                    {exercise.equipment?.length ? (
                                      <View style={{ gap: spacing.xs }}>
                                        <AppText
                                          variant="caption"
                                          color={colors.text.primary}
                                        >
                                          EQUIPMENT
                                        </AppText>

                                        <AppText
                                          variant="bodySmall"
                                          color={colors.text.secondary}
                                        >
                                          {exercise.equipment.join(', ')}
                                        </AppText>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}

                                {/* View Exercise */}
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityState={{ expanded }}
                                  onPress={() =>
                                    toggleExercise(exerciseKey)
                                  }
                                  style={{
                                    minHeight: 48,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: spacing.md,
                                    borderRadius: 12,
                                    backgroundColor: expanded
                                      ? colors.background.secondary
                                      : colors.brand.red,
                                    borderWidth: expanded ? 1 : 0,
                                    borderColor,
                                  }}
                                >
                                  <AppText
                                    variant="button"
                                    color={
                                      expanded
                                        ? colors.text.primary
                                        : '#FFFFFF'
                                    }
                                  >
                                    {expanded
                                      ? 'Show less'
                                      : 'View exercise'}
                                  </AppText>
                                </Pressable>
                              </Card>
                            );
                          })}
                        </View>

                        {/* Day Footer */}
                        <AppText
                          variant="caption"
                          color={colors.text.tertiary}
                        >
                          DAY {day.dayNumber} OF {trainingDays.length}
                        </AppText>
                      </Card>
                    ))}
                  </ScrollView>

                  {/* Swipe Guidance */}
                  {trainingDays.length > 1 ? (
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
                        <AppText
                          variant="caption"
                          color={colors.brand.red}
                        >
                          ←
                        </AppText>
                        {'  '}SWIPE TO EXPLORE TRAINING DAYS{'  '}
                        <AppText
                          variant="caption"
                          color={colors.brand.red}
                        >
                          →
                        </AppText>
                      </AppText>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Explore Workouts */}
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h2" color={colors.text.primary}>
              EXPLORE WORKOUTS
            </AppText>

            <AppText
              variant="bodySmall"
              color={colors.text.tertiary}
            >
              Discover published training programmes from trainers.
            </AppText>
          </View>

          {/* Category Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {categories.map((category) => {
              const selected = selectedCategory === category;

              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedCategory(category)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.brand.red
                      : borderColor,
                    backgroundColor: selected
                      ? colors.brand.red
                      : colors.background.primary,
                  }}
                >
                  <AppText
                    variant="button"
                    color={selected ? '#FFFFFF' : colors.text.secondary}
                  >
                    {category}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Loading State */}
          {isLoadingExploreWorkouts ? (
            <Card variant="default" style={{ gap: spacing.sm }}>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Loading published programmes...
              </AppText>
            </Card>
          ) : exploreWorkoutsError ? (
            /* Error State */
            <Card variant="default" style={{ gap: spacing.md }}>
              <AppText variant="h3" color={colors.text.primary}>
                Unable to load workouts
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                {exploreWorkoutsError}
              </AppText>

              <Pressable
                accessibilityRole="button"
                onPress={() => void loadExploreWorkouts()}
                style={{
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 10,
                  backgroundColor: colors.brand.red,
                }}
              >
                <AppText variant="button" color="#FFFFFF">
                  Try again
                </AppText>
              </Pressable>
            </Card>
          ) : filteredExploreWorkouts.length === 0 ? (
            /* Empty State */
            <Card variant="default" style={{ gap: spacing.sm }}>
              <AppText variant="h3" color={colors.text.primary}>
                {exploreWorkouts.length === 0
                  ? 'No published programmes yet'
                  : 'No programmes in this category'}
              </AppText>

              <AppText variant="bodySmall" color={colors.text.secondary}>
                {exploreWorkouts.length === 0
                  ? 'Published workout programmes will appear here when trainers make them available.'
                  : 'Try selecting another category to explore more programmes.'}
              </AppText>
            </Card>
          ) : (
            /* Published Workout Cards */
            filteredExploreWorkouts.map((workout) => {
              const expanded = selectedWorkout === workout.id;

              const trainingDayCount = new Set(
                workout.exercises.map((item) => item.day_number),
              ).size;

              return (
                <Card
                  key={workout.id}
                  variant="default"
                  style={{ gap: spacing.md }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.brand.red,
                    }}
                  />

                  <AppText variant="h3" color={colors.text.primary}>
                    {workout.name}
                  </AppText>

                  {workout.description ? (
                    <AppText
                      variant="bodySmall"
                      color={colors.text.secondary}
                    >
                      {workout.description}
                    </AppText>
                  ) : null}

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing.md,
                    }}
                  >
                    <AppText variant="caption" color={colors.text.tertiary}>
                      {workout.duration_weeks
                        ? `${workout.duration_weeks} weeks`
                        : 'Duration not specified'}
                    </AppText>

                    <AppText variant="caption" color={colors.text.tertiary}>
                      {trainingDayCount} training days
                    </AppText>

                    <AppText variant="caption" color={colors.text.tertiary}>
                      {workout.exercises.length} exercises
                    </AppText>
                  </View>

                  {expanded ? (
                    <View style={{ gap: spacing.md }}>
                      {workout.objectives ? (
                        <View style={{ gap: spacing.xs }}>
                          <AppText
                            variant="button"
                            color={colors.text.primary}
                          >
                            PROGRAMME OBJECTIVES
                          </AppText>

                          <AppText
                            variant="bodySmall"
                            color={colors.text.secondary}
                          >
                            {workout.objectives}
                          </AppText>
                        </View>
                      ) : null}

                      <View style={{ gap: spacing.md }}>
                        <AppText
                          variant="button"
                          color={colors.text.primary}
                        >
                          EXERCISE BREAKDOWN
                        </AppText>

                        {workout.exercises.map((item, index) => {
                          const previousExercise =
                            workout.exercises[index - 1];

                          const isNewDay =
                            index === 0 ||
                            previousExercise?.day_number !== item.day_number;

                          return (
                            <View key={item.id} style={{ gap: spacing.sm }}>
                              {isNewDay ? (
                                <AppText
                                  variant="button"
                                  color={colors.brand.red}
                                >
                                  {item.day_name || `DAY ${item.day_number}`}
                                </AppText>
                              ) : null}

                              <View
                                style={{
                                  padding: spacing.md,
                                  borderRadius: 10,
                                  backgroundColor: colors.background.primary,
                                  borderWidth: 1,
                                  borderColor,
                                  gap: spacing.xs,
                                }}
                              >
                                <AppText
                                  variant="body"
                                  color={colors.text.primary}
                                >
                                  {item.exercise.name}
                                </AppText>

                                <AppText
                                  variant="caption"
                                  color={colors.text.secondary}
                                >
                                  {item.sets} sets · {item.repetitions} reps
                                  {item.rest_seconds !== null
                                    ? ` · ${item.rest_seconds}s rest`
                                    : ''}
                                </AppText>

                                {item.notes ? (
                                  <AppText
                                    variant="caption"
                                    color={colors.text.tertiary}
                                  >
                                    {item.notes}
                                  </AppText>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() =>
                      setSelectedWorkout(
                        expanded ? null : workout.id,
                      )
                    }
                    style={{
                      alignItems: 'center',
                      padding: spacing.md,
                      borderRadius: 10,
                      backgroundColor: colors.background.primary,
                      borderWidth: 1,
                      borderColor,
                    }}
                  >
                    <AppText variant="button" color={colors.text.primary}>
                      {expanded ? 'Show less' : 'View programme'}
                    </AppText>
                  </Pressable>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
