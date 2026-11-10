
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AppText } from '@/components/AppText';
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

export default function WorkoutsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const { user, profile } = useAuth();

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
      console.error('[Workouts] Unable to load assigned programmes:', error);

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
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            YOUR TRAINING
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            WORKOUTS.
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Train with purpose. Build consistency. Track your progress.
          </AppText>
        </View>

        {/* Assigned Programmes */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="h2" color={colors.text.primary}>
            MY TRAINING PLAN
          </AppText>

          {isLoadingAssignments ? (
            <View
              style={{
                padding: spacing.lg,
                borderRadius: 18,
                backgroundColor: colors.background.secondary,
                borderWidth: 1,
                borderColor: colors.border.default,
              }}
            >
              <AppText variant="body" color={colors.text.secondary}>
                Loading your training programmes...
              </AppText>
            </View>
          ) : assignmentError ? (
            <View
              accessibilityRole="alert"
              style={{
                padding: spacing.lg,
                borderRadius: 18,
                backgroundColor: colors.background.secondary,
                borderWidth: 1,
                borderColor: colors.brand.red,
                gap: spacing.md,
              }}
            >
              <AppText variant="body" color={colors.text.error}>
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
            </View>
          ) : assignments.length === 0 ? (
            <View
              style={{
                padding: spacing.lg,
                borderRadius: 18,
                backgroundColor: colors.background.secondary,
                borderWidth: 1,
                borderColor: colors.border.default,
                gap: spacing.sm,
              }}
            >
              <AppText variant="h3" color={colors.text.primary}>
                NO ASSIGNED PROGRAMMES
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                Your trainer's personalised workout programmes will appear
                here when assigned to you.
              </AppText>
            </View>
          ) : (
            assignments.map((assignment) => {
              const plan = getPublishedSnapshot(assignment);

              if (!plan) {
                return (
                  <View
                    key={assignment.id}
                    style={{
                      padding: spacing.lg,
                      borderRadius: 18,
                      backgroundColor: colors.background.secondary,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                    }}
                  >
                    <AppText variant="body" color={colors.text.secondary}>
                      Unable to display this programme's published snapshot.
                    </AppText>
                  </View>
                );
              }

              const groupedExercises = plan.exercises.reduce<
                { dayNumber: number; dayName: string; exercises: PublishedExercise[] }[]
              >((days, exercise) => {
                let day = days.find(
                  (item) => item.dayNumber === exercise.day_number,
                );

                if (!day) {
                  day = {
                    dayNumber: exercise.day_number,
                    dayName:
                      exercise.day_name || `Day ${exercise.day_number}`,
                    exercises: [],
                  };

                  days.push(day);
                }

                day.exercises.push(exercise);

                return days;
              }, []);

              groupedExercises.forEach((day) => {
                day.exercises.sort(
                  (a, b) => a.exercise_order - b.exercise_order,
                );
              });

              return (
                <View
                  key={assignment.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: 18,
                    backgroundColor: colors.background.secondary,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    gap: spacing.lg,
                  }}
                >
                  {/* Programme Header */}
                  <View style={{ gap: spacing.sm }}>
                    <View
                      style={{
                        width: 42,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.brand.red,
                      }}
                    />

                    <AppText variant="h3" color={colors.text.primary}>
                      {plan.name}
                    </AppText>

                    <AppText
                      variant="caption"
                      color={colors.text.secondary}
                    >
                      VERSION {assignment.plan_version}
                    </AppText>

                    {plan.description ? (
                      <AppText
                        variant="body"
                        color={colors.text.secondary}
                      >
                        {plan.description}
                      </AppText>
                    ) : null}
                  </View>

                  {/* Programme Metadata */}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing.md,
                    }}
                  >
                    {plan.duration_weeks ? (
                      <AppText
                        variant="caption"
                        color={colors.text.tertiary}
                      >
                        {plan.duration_weeks} weeks
                      </AppText>
                    ) : null}

                    <AppText
                      variant="caption"
                      color={colors.text.tertiary}
                    >
                      {plan.exercises.length} exercises
                    </AppText>

                    <AppText
                      variant="caption"
                      color={colors.brand.red}
                    >
                      ACTIVE
                    </AppText>
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

                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border.default,
                    }}
                  />

                  {/* Training Days */}
                  {groupedExercises.map((day) => (
                    <View
                      key={`${assignment.id}-${day.dayNumber}`}
                      style={{ gap: spacing.md }}
                    >
                      <AppText
                        variant="h3"
                        color={colors.text.primary}
                      >
                        {day.dayName.toUpperCase()}
                      </AppText>

                      {day.exercises.map((item) => {
                        const expanded = expandedExercises.includes(
                          `${assignment.id}-${item.id}`,
                        );

                        const exercise = item.exercise;

                        return (
                          <View
                            key={item.id}
                            style={{
                              padding: spacing.md,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: colors.border.default,
                              gap: spacing.sm,
                            }}
                          >
                            <AppText
                              variant="h3"
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

                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: spacing.md,
                              }}
                            >
                              <AppText
                                variant="bodySmall"
                                color={colors.text.secondary}
                              >
                                {item.sets} sets
                              </AppText>

                              <AppText
                                variant="bodySmall"
                                color={colors.text.secondary}
                              >
                                {item.repetitions} reps
                              </AppText>

                              {item.rest_seconds !== null ? (
                                <AppText
                                  variant="bodySmall"
                                  color={colors.text.secondary}
                                >
                                  {item.rest_seconds}s rest
                                </AppText>
                              ) : null}
                            </View>

                            {expanded ? (
                              <View style={{ gap: spacing.sm }}>
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
                                  <AppText
                                    variant="caption"
                                    color={colors.text.tertiary}
                                  >
                                    Equipment: {exercise.equipment.join(', ')}
                                  </AppText>
                                ) : null}
                              </View>
                            ) : null}

                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ expanded }}
                              onPress={() =>
                                toggleExercise(
                                  `${assignment.id}-${item.id}`,
                                )
                              }
                              style={{
                                alignItems: 'center',
                                padding: spacing.sm,
                                borderRadius: 10,
                                backgroundColor: colors.brand.red,
                              }}
                            >
                              <AppText
                                variant="button"
                                color="#FFFFFF"
                              >
                                {expanded
                                  ? 'Show less'
                                  : 'View exercise'}
                              </AppText>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>

        {/* Explore Workouts */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="h2" color={colors.text.primary}>
            EXPLORE WORKOUTS
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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
                        : colors.border.default,
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
            </View>
          </ScrollView>
        </View>

        {filteredWorkouts.map((workout) => {
          const expanded = selectedWorkout === workout.id;

          return (
            <View
              key={workout.id}
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
                  width: 42,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.brand.red,
                }}
              />

              <AppText variant="h3" color={colors.text.primary}>
                {workout.title}
              </AppText>

              <AppText variant="body" color={colors.text.secondary}>
                {workout.description}
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                }}
              >
                <AppText variant="caption" color={colors.text.tertiary}>
                  {workout.duration}
                </AppText>

                <AppText variant="caption" color={colors.text.tertiary}>
                  {workout.level}
                </AppText>
              </View>

              {expanded ? (
                <AppText
                  variant="bodySmall"
                  color={colors.text.secondary}
                >
                  This is a sample workout, not part of your trainer-assigned
                  programme.
                </AppText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() =>
                  setSelectedWorkout(expanded ? null : workout.id)
                }
                style={{
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 12,
                  backgroundColor: colors.brand.red,
                }}
              >
                <AppText variant="button" color="#FFFFFF">
                  {expanded ? 'Show less' : 'View workout'}
                </AppText>
              </Pressable>
            </View>
          );
        })}

        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{ textAlign: 'center' }}
        >
          SAMPLE WORKOUTS — NOT A PERSONAL PRESCRIPTION
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
