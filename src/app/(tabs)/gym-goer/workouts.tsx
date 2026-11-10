
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useAuth } from '@/providers/AuthProvider';
import {
  getClientWorkoutAssignments,
  type WorkoutAssignment,
} from '@/services/workout-assignments';
import { useTrainrTheme } from '@/theme';

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

const sampleWorkouts = [
  {
    id: '1',
    title: 'Upper Body Strength',
    category: 'Strength',
    description: 'Chest, back, shoulders and arms.',
    duration: '45 min',
    level: 'Intermediate',
  },
  {
    id: '2',
    title: 'Full Body Conditioning',
    category: 'Cardio',
    description: 'Build stamina and improve endurance.',
    duration: '30 min',
    level: 'Beginner',
  },
  {
    id: '3',
    title: 'Mobility & Recovery',
    category: 'Mobility',
    description: 'Improve movement and flexibility.',
    duration: '20 min',
    level: 'All levels',
  },
] as const;

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

  useFocusEffect(
    useCallback(() => {
      void loadAssignments();
    }, [loadAssignments]),
  );

  const filteredWorkouts = sampleWorkouts.filter(
    (workout) =>
      selectedCategory === 'All' ||
      workout.category === selectedCategory,
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
                  {/* Programme Information */}
                  <View style={{ gap: spacing.md }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText
                          variant="h4"
                          color={colors.text.primary}
                        >
                          {plan.name}
                        </AppText>

                        <AppText
                          variant="caption"
                          color={colors.text.tertiary}
                        >
                          VERSION {assignment.plan_version}
                        </AppText>
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
                        variant="bodySmall"
                        color={colors.text.secondary}
                      >
                        {plan.description}
                      </AppText>
                    ) : null}

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
                            color={colors.text.secondary}
                          >
                            {item}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    {plan.objectives ? (
                      <View style={{ gap: spacing.xs }}>
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
                  </View>

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
                                  gap: spacing.sm,
                                }}
                              >
                                {/* Exercise Name */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: spacing.sm,
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      backgroundColor:
                                        colors.background.secondary,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <AppText
                                      variant="caption"
                                      color={colors.text.tertiary}
                                    >
                                      {index + 1}
                                    </AppText>
                                  </View>

                                  <View
                                    style={{
                                      flex: 1,
                                      gap: 4,
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

                                {/* Sets, Reps and Rest */}
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
                                        paddingHorizontal: spacing.sm,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        backgroundColor:
                                          colors.background.secondary,
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
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: spacing.sm,
                                    borderRadius: 10,
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
              Discover additional training ideas.
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
                    color={
                      selected
                        ? '#FFFFFF'
                        : colors.text.secondary
                    }
                  >
                    {category}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Sample Workout Cards */}
          {filteredWorkouts.map((workout) => {
            const expanded = selectedWorkout === workout.id;

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

                <AppText
                  variant="h3"
                  color={colors.text.primary}
                >
                  {workout.title}
                </AppText>

                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                >
                  {workout.description}
                </AppText>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                  }}
                >
                  <AppText
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    {workout.duration}
                  </AppText>

                  <AppText
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    {workout.level}
                  </AppText>
                </View>

                {expanded ? (
                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                  >
                    This is a sample workout, not part of your
                    trainer-assigned programme.
                  </AppText>
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
                  <AppText
                    variant="button"
                    color={colors.text.primary}
                  >
                    {expanded ? 'Show less' : 'View workout'}
                  </AppText>
                </Pressable>
              </Card>
            );
          })}

          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{ textAlign: 'center' }}
          >
            SAMPLE WORKOUTS — NOT A PERSONAL PRESCRIPTION
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
