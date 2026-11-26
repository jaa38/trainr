import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Plus, Dumbbell } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import {
  completePersonalWorkout,
  deletePersonalWorkout,
  updatePersonalWorkout,
} from '@/services/personal-workouts';
import { getPersonalWorkoutDetails } from '@/services/personal-workout-exercises';
import {
  createPersonalExercise,
  getPersonalExercises,
} from '@/services/personal-exercises';
import {
  createWorkoutExercise,
  deleteWorkoutExercise,
} from '@/services/personal-workout-exercises';
import { createWorkoutSet, updateWorkoutSet } from '@/services/personal-workout-sets';
import { getExercises, type Exercise } from '@/services/exercises';
import { useTrainrTheme } from '@/theme';
import type {
  PersonalExercise,
  PersonalWorkoutCategory,
  PersonalWorkoutDetails,
} from '@/types/personal-workouts';

type SetDraft = {
  repetitions: string;
  weight: string;
};

const CATEGORIES: { label: string; value: PersonalWorkoutCategory }[] = [
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Flexibility', value: 'flexibility' },
  { label: 'Functional', value: 'functional' },
  { label: 'Custom', value: 'custom' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '—';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0
    ? `${minutes} min ${remainingSeconds > 0 ? `${remainingSeconds} sec` : ''}`.trim()
    : `${remainingSeconds} sec`;
}

export default function PersonalWorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTrainrTheme();

  const [workout, setWorkout] = useState<PersonalWorkoutDetails | null>(null);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [sharedExercises, setSharedExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseCategory, setNewExerciseCategory] =
    useState<PersonalWorkoutCategory>('strength');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState('');
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editSetDraft, setEditSetDraft] = useState<SetDraft>({
    repetitions: "",
    weight: "",
  });
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [editWorkoutName, setEditWorkoutName] = useState('');
  const [editWorkoutType, setEditWorkoutType] =
    useState<PersonalWorkoutCategory>('strength');
  const [editWorkoutDate, setEditWorkoutDate] = useState('');
  const [editWorkoutNotes, setEditWorkoutNotes] = useState('');

  const loadWorkout = useCallback(async () => {
    if (!id) {
      setErrorMessage('Workout ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await getPersonalWorkoutDetails(id);
      setWorkout(result);

      const [personalResult, sharedResult] = await Promise.allSettled([
        getPersonalExercises(),
        getExercises(),
      ]);

      if (personalResult.status === 'fulfilled') {
        setPersonalExercises(personalResult.value);
      } else {
        setExerciseError('Your personal exercise library could not be loaded.');
      }

      if (sharedResult.status === 'fulfilled') {
        setSharedExercises(sharedResult.value);
      } else {
        setExerciseError((current) =>
          current
            ? `${current} The Exercise Library could not be loaded.`
            : 'The Exercise Library could not be loaded.',
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load this workout.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkout();
    }, [loadWorkout]),
  );

  const isCompleted = workout?.status === 'completed';

  function beginWorkoutEdit() {
    if (!workout) return;

    setEditWorkoutName(workout.workout_name);
    setEditWorkoutType(workout.workout_type);
    setEditWorkoutDate(workout.workout_date);
    setEditWorkoutNotes(workout.notes ?? '');
    setIsEditingWorkout(true);
    setErrorMessage(null);
  }

  async function handleSaveWorkout() {
    if (!workout || isSaving) return;

    if (!editWorkoutName.trim()) {
      setErrorMessage('Enter a workout name to continue.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editWorkoutDate.trim())) {
      setErrorMessage('Enter the workout date in YYYY-MM-DD format.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePersonalWorkout(workout.id, {
        workout_name: editWorkoutName.trim(),
        workout_type: editWorkoutType,
        workout_date: editWorkoutDate.trim(),
        notes: editWorkoutNotes.trim() || null,
      });
      setIsEditingWorkout(false);
      await loadWorkout();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update this workout.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDeleteWorkout() {
    if (!workout || isSaving) return;

    Alert.alert(
      'Delete workout?',
      'This will permanently delete this workout, its exercises and logged sets.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSaving(true);
              setErrorMessage(null);
              try {
                await deletePersonalWorkout(workout.id);
                router.back();
              } catch (error) {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : 'Unable to delete this workout.',
                );
              } finally {
                setIsSaving(false);
              }
            })();
          },
        },
      ],
    );
  }

  function confirmRemoveExercise(exerciseId: string, exerciseName: string) {
    if (!workout || isSaving) return;

    Alert.alert(
      'Remove exercise?',
      `Remove ${exerciseName} and its logged sets from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSaving(true);
              setExerciseError(null);
              try {
                await deleteWorkoutExercise(exerciseId);
                await loadWorkout();
              } catch (error) {
                setExerciseError(
                  error instanceof Error
                    ? error.message
                    : 'Unable to remove this exercise.',
                );
              } finally {
                setIsSaving(false);
              }
            })();
          },
        },
      ],
    );
  }

  function getExerciseName(
    personalExerciseId: string | null,
    sharedExerciseId: string | null,
  ) {
    if (personalExerciseId) {
      return (
        personalExercises.find((exercise) => exercise.id === personalExerciseId)?.name ??
        'Personal exercise'
      );
    }

    if (sharedExerciseId) {
      return (
        sharedExercises.find((exercise) => exercise.id === sharedExerciseId)?.name ??
        'Exercise Library item'
      );
    }

    return 'Exercise';
  }

  async function handleAddExercise(
    exercise: PersonalExercise | Exercise,
    source: 'personal' | 'shared',
  ) {
    if (!workout || isSaving) return;

    setIsSaving(true);
    setExerciseError(null);

    try {
      await createWorkoutExercise({
        workout_id: workout.id,
        ...(source === 'shared'
          ? { exercise_id: exercise.id }
          : { personal_exercise_id: exercise.id }),
        exercise_order: workout.exercises.length,
      });

      setShowExercisePicker(false);
      await loadWorkout();
    } catch (error) {
      setExerciseError(
        error instanceof Error ? error.message : 'Unable to add this exercise.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateExercise() {
    if (!workout || isSaving) return;

    if (!newExerciseName.trim()) {
      setExerciseError('Enter an exercise name to continue.');
      return;
    }

    setIsSaving(true);
    setExerciseError(null);

    try {
      const exercise = await createPersonalExercise({
        name: newExerciseName.trim(),
        category: newExerciseCategory,
        muscle_group: newExerciseMuscleGroup.trim() || null,
      });

      await createWorkoutExercise({
        workout_id: workout.id,
        personal_exercise_id: exercise.id,
        exercise_order: workout.exercises.length,
      });

      setNewExerciseName('');
      setNewExerciseMuscleGroup('');
      setNewExerciseCategory('strength');
      setShowCreateExercise(false);
      setShowExercisePicker(false);
      await loadWorkout();
    } catch (error) {
      setExerciseError(
        error instanceof Error ? error.message : 'Unable to create this exercise.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateSetDraft(exerciseId: string, field: keyof SetDraft, value: string) {
    setSetDrafts((current) => ({
      ...current,
      [exerciseId]: {
        repetitions: current[exerciseId]?.repetitions ?? '',
        weight: current[exerciseId]?.weight ?? '',
        [field]: value,
      },
    }));
  }

  function beginSetEdit(set: { id: string; repetitions: number | null; weight: number | null }) {
    setEditingSetId(set.id);
    setEditSetDraft({
      repetitions: set.repetitions == null ? "" : String(set.repetitions),
      weight: set.weight == null ? "" : String(set.weight),
    });
    setExerciseError(null);
  }

  async function handleSaveSetEdit(setId: string) {
    if (isSaving) return;

    const repetitions = editSetDraft.repetitions.trim()
      ? Number(editSetDraft.repetitions)
      : null;
    const weight = editSetDraft.weight.trim()
      ? Number(editSetDraft.weight)
      : null;

    if (
      (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0)) ||
      (weight !== null && (!Number.isFinite(weight) || weight < 0))
    ) {
      setExerciseError("Enter valid non-negative repetitions and weight.");
      return;
    }

    if (repetitions === null && weight === null) {
      setExerciseError("Enter repetitions or weight before saving.");
      return;
    }

    setIsSaving(true);
    setExerciseError(null);

    try {
      await updateWorkoutSet(setId, {
        repetitions,
        weight,
        weight_unit: weight === null ? null : "kg",
      });
      setEditingSetId(null);
      await loadWorkout();
    } catch (error) {
      setExerciseError(
        error instanceof Error ? error.message : "Unable to update this set.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddSet(exerciseId: string, existingSetCount: number) {
    if (isSaving) return;

    const draft = setDrafts[exerciseId] ?? { repetitions: '', weight: '' };
    const repetitions = draft.repetitions.trim() ? Number(draft.repetitions) : null;
    const weight = draft.weight.trim() ? Number(draft.weight) : null;

    if (
      (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0)) ||
      (weight !== null && (!Number.isFinite(weight) || weight < 0))
    ) {
      setExerciseError('Enter valid non-negative repetitions and weight.');
      return;
    }

    if (repetitions === null && weight === null) {
      setExerciseError('Enter repetitions or weight before adding a set.');
      return;
    }

    setIsSaving(true);
    setExerciseError(null);

    try {
      await createWorkoutSet({
        workout_exercise_id: exerciseId,
        set_number: existingSetCount + 1,
        repetitions,
        weight,
        weight_unit: weight === null ? null : 'kg',
      });

      setSetDrafts((current) => ({
        ...current,
        [exerciseId]: { repetitions: '', weight: '' },
      }));

      await loadWorkout();
    } catch (error) {
      setExerciseError(
        error instanceof Error ? error.message : 'Unable to save this set.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCompleteWorkout() {
    if (!workout || isCompleting || isCompleted) return;

    setIsCompleting(true);
    setErrorMessage(null);

    try {
      await completePersonalWorkout(workout.id);
      await loadWorkout();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to complete this workout.',
      );
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand.red} />
      </Screen>
    );
  }

  if (!workout) {
    return (
      <Screen scroll contentContainerStyle={{ paddingTop: spacing.lg }}>
        <Button
          variant="ghost"
          onPress={() => router.back()}
          leftIcon={<ArrowLeft size={18} />}
        >
          Back
        </Button>
        <AppText variant="h2" color={colors.text.primary}>
          Workout unavailable
        </AppText>
        <AppText variant="body" color={colors.text.secondary}>
          {errorMessage ?? 'This workout could not be found.'}
        </AppText>
        <Button variant="outline" onPress={() => void loadWorkout()}>
          Try again
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <View style={{ gap: spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: spacing.sm,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <AppText variant="bodyMedium" color={colors.text.primary}>
            Back
          </AppText>
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red} weight="700">
            PERSONAL WORKOUT
          </AppText>
          <AppText variant="h1" color={colors.text.primary}>
            {workout.workout_name}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: spacing.sm,
            }}
          >
            <Badge
              tone={
                isCompleted
                  ? 'success'
                  : workout.status === 'in_progress'
                    ? 'primary'
                    : 'neutral'
              }
            >
              {workout.status.replace('_', ' ')}
            </Badge>
            <AppText variant="bodySmall" color={colors.text.secondary}>
              {formatDate(workout.workout_date)}
            </AppText>
            <AppText variant="bodySmall" color={colors.text.secondary}>
              {workout.workout_type.charAt(0).toUpperCase() +
                workout.workout_type.slice(1)}
            </AppText>
          </View>
          {workout.notes ? (
            <AppText variant="body" color={colors.text.secondary}>
              {workout.notes}
            </AppText>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                size="small"
                variant="outline"
                disabled={isSaving}
                onPress={beginWorkoutEdit}
              >
                Edit workout
              </Button>
              <Button
                size="small"
                variant="destructive"
                disabled={isSaving}
                onPress={confirmDeleteWorkout}
              >
                Delete workout
              </Button>
            </View>
        </View>

        {isEditingWorkout ? (
          <Card variant="outlined" style={{ gap: spacing.md }}>
            <AppText variant="h3" color={colors.text.primary}>
              Edit workout
            </AppText>
            <Input
              label="Workout name"
              value={editWorkoutName}
              onChangeText={setEditWorkoutName}
              maxLength={120}
            />
            <Input
              label="Workout date (YYYY-MM-DD)"
              value={editWorkoutDate}
              onChangeText={setEditWorkoutDate}
              placeholder="2026-11-26"
              autoCapitalize="none"
            />
            <AppText variant="label" color={colors.text.primary}>
              Workout category
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {CATEGORIES.map((category) => {
                const selected = editWorkoutType === category.value;
                return (
                  <Pressable
                    key={`edit-${category.value}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Edit category ${category.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => setEditWorkoutType(category.value)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand.red : colors.border.default,
                      backgroundColor: selected
                        ? colors.brand.redLight
                        : colors.surface.default,
                    }}
                  >
                    <AppText
                      variant="caption"
                      color={selected ? colors.brand.red : colors.text.secondary}
                    >
                      {category.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <Input
              label="Notes (optional)"
              value={editWorkoutNotes}
              onChangeText={setEditWorkoutNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant="secondary"
                  disabled={isSaving}
                  onPress={() => {
                    setIsEditingWorkout(false);
                    setErrorMessage(null);
                  }}
                >
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  fullWidth
                  loading={isSaving}
                  disabled={isSaving}
                  onPress={() => void handleSaveWorkout()}
                >
                  Save changes
                </Button>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <Dumbbell size={19} color={colors.brand.red} />
            <AppText variant="h2" color={colors.text.primary}>
              {workout.exercises.length}
            </AppText>
            <AppText variant="caption" color={colors.text.secondary}>
              Exercises
            </AppText>
          </Card>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <CheckCircle2 size={19} color={colors.brand.red} />
            <AppText variant="h2" color={colors.text.primary}>
              {workout.exercises.reduce(
                (total, exercise) => total + exercise.sets.length,
                0,
              )}
            </AppText>
            <AppText variant="caption" color={colors.text.secondary}>
              Sets logged
            </AppText>
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="h2" color={colors.text.primary}>
              Exercises
            </AppText>
            <Button
              size="small"
              variant="outline"
              leftIcon={<Plus size={16} color={colors.text.primary} />}
              onPress={() => {
                  setShowExercisePicker((visible) => !visible);
                  setShowCreateExercise(false);
                  setExerciseError(null);
                }}
              >
                Add exercise
              </Button>
          </View>

          {showExercisePicker ? (
            <Card variant="outlined" style={{ gap: spacing.md }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                Choose an exercise
              </AppText>
              {exerciseError ? (
                <AppText variant="bodySmall" color={colors.text.error}>
                  {exerciseError}
                </AppText>
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label" color={colors.text.primary}>
                  EXERCISE LIBRARY
                </AppText>
                {sharedExercises.filter(
                  (exercise) =>
                    !workout.exercises.some((entry) => entry.exercise_id === exercise.id),
                ).length === 0 ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    No additional Exercise Library entries available.
                  </AppText>
                ) : (
                  sharedExercises
                    .filter(
                      (exercise) =>
                        !workout.exercises.some(
                          (entry) => entry.exercise_id === exercise.id,
                        ),
                    )
                    .map((exercise) => (
                      <Pressable
                        key={`shared-${exercise.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${exercise.name} from Exercise Library`}
                        disabled={isSaving}
                        onPress={() => void handleAddExercise(exercise, 'shared')}
                        style={{
                          padding: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: colors.background.secondary,
                        }}
                      >
                        <AppText variant="bodyMedium" color={colors.text.primary}>
                          {exercise.name}
                        </AppText>
                        <AppText variant="caption" color={colors.text.secondary}>
                          {exercise.muscle_group ??
                            exercise.category ??
                            'Exercise Library'}
                        </AppText>
                      </Pressable>
                    ))
                )}
              </View>

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label" color={colors.text.primary}>
                  PERSONAL EXERCISES
                </AppText>
                {personalExercises.filter(
                  (exercise) =>
                    !workout.exercises.some(
                      (entry) => entry.personal_exercise_id === exercise.id,
                    ),
                ).length === 0 ? (
                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    No additional personal exercises available.
                  </AppText>
                ) : (
                  personalExercises
                    .filter(
                      (exercise) =>
                        !workout.exercises.some(
                          (entry) => entry.personal_exercise_id === exercise.id,
                        ),
                    )
                    .map((exercise) => (
                      <Pressable
                        key={`personal-${exercise.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${exercise.name} from personal exercises`}
                        disabled={isSaving}
                        onPress={() => void handleAddExercise(exercise, 'personal')}
                        style={{
                          padding: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: colors.background.secondary,
                        }}
                      >
                        <AppText variant="bodyMedium" color={colors.text.primary}>
                          {exercise.name}
                        </AppText>
                        <AppText variant="caption" color={colors.text.secondary}>
                          {exercise.muscle_group ?? exercise.category}
                        </AppText>
                      </Pressable>
                    ))
                )}
              </View>

              <Button
                fullWidth
                variant="secondary"
                onPress={() => {
                  setShowCreateExercise((visible) => !visible);
                  setExerciseError(null);
                }}
              >
                {showCreateExercise ? 'Cancel new exercise' : 'Create personal exercise'}
              </Button>

              {showCreateExercise ? (
                <View style={{ gap: spacing.sm }}>
                  <Input
                    label="Exercise name"
                    placeholder="e.g. Dumbbell shoulder press"
                    value={newExerciseName}
                    onChangeText={setNewExerciseName}
                    maxLength={120}
                  />
                  <Input
                    label="Muscle group (optional)"
                    placeholder="e.g. Shoulders"
                    value={newExerciseMuscleGroup}
                    onChangeText={setNewExerciseMuscleGroup}
                    maxLength={100}
                  />
                  <AppText variant="label" color={colors.text.primary}>
                    Category
                  </AppText>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
                  >
                    {CATEGORIES.map((category) => {
                      const selected = newExerciseCategory === category.value;
                      return (
                        <Pressable
                          key={category.value}
                          accessibilityRole="radio"
                          accessibilityLabel={category.label}
                          accessibilityState={{ selected }}
                          onPress={() => setNewExerciseCategory(category.value)}
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
                            color={selected ? colors.brand.red : colors.text.secondary}
                          >
                            {category.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Button
                    fullWidth
                    loading={isSaving}
                    disabled={isSaving}
                    onPress={() => void handleCreateExercise()}
                  >
                    Create and add exercise
                  </Button>
                </View>
              ) : null}
            </Card>
          ) : null}

          {workout.exercises.length === 0 ? (
            <Card variant="outlined" style={{ gap: spacing.sm }}>
              <AppText variant="bodyMedium" color={colors.text.primary}>
                No exercises added yet
              </AppText>
              <AppText variant="bodySmall" color={colors.text.secondary}>
                Add an exercise to start recording your sets and progress.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {workout.exercises.map((exercise, index) => (
                <Card key={exercise.id} variant="outlined" style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="caption" color={colors.text.secondary}>
                      EXERCISE {index + 1}
                    </AppText>
                    <AppText variant="h3" color={colors.text.primary}>
                      {getExerciseName(
                        exercise.personal_exercise_id,
                        exercise.exercise_id,
                      )}
                    </AppText>
                    <Button
                      size="small"
                      variant="ghost"
                      disabled={isSaving}
                      onPress={() =>
                        confirmRemoveExercise(
                            exercise.id,
                            getExerciseName(
                              exercise.personal_exercise_id,
                              exercise.exercise_id,
                            ),
                          )
                        }
                      >
                        Remove exercise
                      </Button>
                  </View>

                  {exercise.sets.length > 0 ? (
                    <View style={{ gap: spacing.xs }}>
                      {exercise.sets.map((set) => (
                        <View
                          key={set.id}
                          style={{
                            gap: spacing.xs,
                            paddingVertical: spacing.sm,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border.default,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: spacing.sm,
                            }}
                          >
                            <AppText variant="bodySmall" color={colors.text.secondary}>
                              Set {set.set_number}
                            </AppText>

                            {editingSetId === set.id ? (
                              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                                <Button
                                  size="small"
                                  variant="ghost"
                                  disabled={isSaving}
                                  onPress={() => setEditingSetId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="small"
                                  disabled={isSaving}
                                  onPress={() => void handleSaveSetEdit(set.id)}
                                >
                                  Save
                                </Button>
                              </View>
                            ) : (
                              <Button
                                size="small"
                                variant="ghost"
                                disabled={isSaving || editingSetId !== null}
                                onPress={() => beginSetEdit(set)}
                              >
                                Edit
                              </Button>
                            )}
                          </View>

                          {editingSetId === set.id ? (
                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Repetitions"
                                  keyboardType="number-pad"
                                  value={editSetDraft.repetitions}
                                  onChangeText={(value) =>
                                    setEditSetDraft((current) => ({
                                      ...current,
                                      repetitions: value,
                                    }))
                                  }
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Input
                                  label="Weight (kg)"
                                  keyboardType="decimal-pad"
                                  value={editSetDraft.weight}
                                  onChangeText={(value) =>
                                    setEditSetDraft((current) => ({
                                      ...current,
                                      weight: value,
                                    }))
                                  }
                                />
                              </View>
                            </View>
                          ) : (
                            <AppText variant="bodySmall" color={colors.text.primary}>
                              {set.repetitions != null ? `${set.repetitions} reps` : ''}
                              {set.repetitions != null && set.weight != null ? ' · ' : ''}
                              {set.weight != null ? `${set.weight} ${set.weight_unit}` : ''}
                              {set.repetitions == null && set.weight == null
                                ? 'Recorded'
                                : ''}
                            </AppText>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      No sets logged yet.
                    </AppText>
                  )}

                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label" color={colors.text.primary}>
                      Log next set
                      </AppText>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Repetitions"
                            accessibilityLabel={`Repetitions for ${getExerciseName(exercise.personal_exercise_id, exercise.exercise_id)}`}
                            placeholder="e.g. 10"
                            keyboardType="number-pad"
                            value={setDrafts[exercise.id]?.repetitions ?? ''}
                            onChangeText={(value) =>
                              updateSetDraft(exercise.id, 'repetitions', value)
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Weight (kg)"
                            accessibilityLabel={`Weight in kg for ${getExerciseName(exercise.personal_exercise_id, exercise.exercise_id)}`}
                            placeholder="e.g. 20"
                            keyboardType="decimal-pad"
                            value={setDrafts[exercise.id]?.weight ?? ''}
                            onChangeText={(value) =>
                              updateSetDraft(exercise.id, 'weight', value)
                            }
                          />
                        </View>
                      </View>
                      <Button
                        size="medium"
                        variant="secondary"
                        loading={isSaving}
                        disabled={isSaving}
                        onPress={() =>
                          void handleAddSet(exercise.id, exercise.sets.length)
                        }
                      >
                        Add set
                      </Button>
                    </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {exerciseError && !showExercisePicker ? (
          <AppText variant="bodySmall" color={colors.text.error}>
            {exerciseError}
          </AppText>
        ) : null}

        {errorMessage ? (
          <AppText variant="bodySmall" color={colors.text.error}>
            {errorMessage}
          </AppText>
        ) : null}

        {!isCompleted ? (
          <Button
            fullWidth
            size="large"
            loading={isCompleting}
            disabled={isCompleting}
            onPress={() => void handleCompleteWorkout()}
            leftIcon={<CheckCircle2 size={18} color="#FFFFFF" />}
          >
            Complete workout
          </Button>
        ) : (
          <Card variant="outlined" style={{ gap: spacing.xs }}>
            <Badge tone="success">Completed</Badge>
            <AppText variant="bodySmall" color={colors.text.secondary}>
              This workout is saved. Its exercises and sets are available for review.
            </AppText>
            <AppText variant="bodySmall" color={colors.text.secondary}>
              Duration: {formatDuration(workout.duration_seconds)}
            </AppText>
          </Card>
        )}
      </View>
    </Screen>
  );
}
