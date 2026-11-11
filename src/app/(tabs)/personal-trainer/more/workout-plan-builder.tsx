
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTrainrTheme } from '@/theme';

import {
  getExercises,
  type Exercise,
} from '@/services/exercises';

import {
  addWorkoutPlanExercise,
  getWorkoutPlan,
  publishWorkoutPlan,
  removeWorkoutPlanExercise,
  startWorkoutPlanRevision,
  updateWorkoutPlan,
  updateWorkoutPlanExercise,
  type WorkoutPlan,
  type WorkoutPlanExercise,
} from '@/services/workout-plans';

type ExerciseForm = {
  exercise_id: string;
  day_number: string;
  day_name: string;
  sets: string;
  repetitions: string;
  rest_seconds: string;
  notes: string;
};

const EMPTY_EXERCISE_FORM: ExerciseForm = {
  exercise_id: '',
  day_number: '1',
  day_name: 'Day 1',
  sets: '3',
  repetitions: '12',
  rest_seconds: '60',
  notes: '',
};

export default function WorkoutPlanBuilderScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { colors, spacing } = useTrainrTheme();

  const { width: windowWidth } = useWindowDimensions();
  const trainingDayPageWidth = windowWidth - spacing.lg * 2;

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const trainingDaysRef = useRef<ScrollView>(null);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [exerciseVisible, setExerciseVisible] = useState(false);
  const [editingExercise, setEditingExercise] =
    useState<WorkoutPlanExercise | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [duration, setDuration] = useState('');

  const [exerciseForm, setExerciseForm] =
    useState<ExerciseForm>(EMPTY_EXERCISE_FORM);

  const [selectedDay, setSelectedDay] = useState(1);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const isEditable = plan?.status === 'draft';

  const loadData = useCallback(async () => {
    if (!planId) {
      setError('Workout plan ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [planResult, exerciseResult] = await Promise.all([
        getWorkoutPlan(planId),
        getExercises(),
      ]);

      setPlan(planResult);
      setExercises(exerciseResult);

      setName(planResult.name);
      setDescription(planResult.description ?? '');
      setObjectives(planResult.objectives ?? '');
      setDuration(
        planResult.duration_weeks?.toString() ?? '',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load workout plan.',
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const planExercises = useMemo(
    () => plan?.workout_plan_exercises ?? [],
    [plan],
  );

  const groupedExercises = useMemo(() => {
    const groups = new Map<number, WorkoutPlanExercise[]>();

    planExercises.forEach((item) => {
      const existing = groups.get(item.day_number) ?? [];
      existing.push(item);
      groups.set(item.day_number, existing);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, items]) => ({
        day,
        name: items[0]?.day_name || `Day ${day}`,
        exercises: items.sort(
          (a, b) => a.exercise_order - b.exercise_order,
        ),
      }));
  }, [planExercises]);

  useEffect(() => {
    const lastIndex = Math.max(0, groupedExercises.length - 1);
    const safeIndex = Math.min(activeDayIndex, lastIndex);

    if (safeIndex !== activeDayIndex) {
      setActiveDayIndex(safeIndex);
    }

    trainingDaysRef.current?.scrollTo({
      x: safeIndex * trainingDayPageWidth,
      animated: false,
    });
  }, [
    groupedExercises.length,
    activeDayIndex,
    trainingDayPageWidth,
  ]);

  const filteredExercises = exercises.filter((exercise) => {
    const query = exerciseSearch.trim().toLowerCase();

    if (!query) return true;

    return (
      exercise.name.toLowerCase().includes(query) ||
      exercise.muscle_group?.toLowerCase().includes(query) ||
      exercise.category?.toLowerCase().includes(query)
    );
  });

  const updateExerciseField = (
    field: keyof ExerciseForm,
    value: string,
  ) => {
    setExerciseForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openAddExercise = (dayNumber = 1, dayName = 'Day 1') => {
    setEditingExercise(null);
    setExerciseForm({
      ...EMPTY_EXERCISE_FORM,
      day_number: dayNumber.toString(),
      day_name: dayName,
    });
    setExerciseSearch('');
    setExerciseVisible(true);
  };

  const openEditExercise = (item: WorkoutPlanExercise) => {
    setEditingExercise(item);
    setExerciseForm({
      exercise_id: item.exercise_id,
      day_number: item.day_number.toString(),
      day_name: item.day_name ?? `Day ${item.day_number}`,
      sets: item.sets.toString(),
      repetitions: item.repetitions,
      rest_seconds: item.rest_seconds?.toString() ?? '',
      notes: item.notes ?? '',
    });
    setExerciseVisible(true);
  };

  const saveDetails = async () => {
    if (!plan) return;

    if (!name.trim()) {
      setError('Workout plan name is required.');
      return;
    }

    const parsedDuration = duration.trim()
      ? Number(duration)
      : null;

    if (
      parsedDuration !== null &&
      (!Number.isInteger(parsedDuration) || parsedDuration < 1)
    ) {
      setError('Duration must be a positive whole number.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateWorkoutPlan(plan.id, {
        name,
        description,
        objectives,
        duration_weeks: parsedDuration,
      });

      setDetailsVisible(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update workout plan.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveExercise = async () => {
    if (!plan) return;

    const dayNumber = Number(exerciseForm.day_number);
    const sets = Number(exerciseForm.sets);
    const rest = exerciseForm.rest_seconds.trim()
      ? Number(exerciseForm.rest_seconds)
      : null;

    if (
      !Number.isInteger(dayNumber) ||
      dayNumber < 1 ||
      !Number.isInteger(sets) ||
      sets < 1 ||
      !exerciseForm.repetitions.trim() ||
      (rest !== null &&
        (!Number.isInteger(rest) || rest < 0))
    ) {
      setError('Please check the exercise configuration.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingExercise) {
        await updateWorkoutPlanExercise(editingExercise.id, {
          day_number: dayNumber,
          day_name: exerciseForm.day_name,
          exercise_order: editingExercise.exercise_order,
          sets,
          repetitions: exerciseForm.repetitions,
          rest_seconds: rest,
          notes: exerciseForm.notes,
        });
      } else {
        if (!exerciseForm.exercise_id) {
          setError('Select an exercise first.');
          setSaving(false);
          return;
        }

        const exerciseOrder =
          Math.max(
            0,
            ...planExercises
              .filter((item) => item.day_number === dayNumber)
              .map((item) => item.exercise_order),
          ) + 1;

        await addWorkoutPlanExercise(plan.id, {
          exercise_id: exerciseForm.exercise_id,
          day_number: dayNumber,
          day_name: exerciseForm.day_name,
          exercise_order: exerciseOrder,
          sets,
          repetitions: exerciseForm.repetitions,
          rest_seconds: rest,
          notes: exerciseForm.notes,
        });
      }

      setExerciseVisible(false);
      setEditingExercise(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save exercise.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = (item: WorkoutPlanExercise) => {
    Alert.alert(
      'Remove exercise',
      `Are you sure you want to remove ${item.exercise?.name ?? 'this exercise'} from your workout plan?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSaving(true);
              setError(null);

              try {
                await removeWorkoutPlanExercise(item.id);
                await loadData();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Unable to remove exercise.',
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const startRevision = async () => {
    if (!plan) return;

    setSaving(true);
    setError(null);

    try {
      const revisedPlan = await startWorkoutPlanRevision(plan.id);
      setPlan(revisedPlan);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start a new revision.',
      );
    } finally {
      setSaving(false);
    }
  };

  const publishProgramme = () => {
    if (!plan) return;

    if (planExercises.length === 0) {
      setError('Add at least one exercise before publishing.');
      return;
    }

    Alert.alert(
      'Publish programme',
      'Are you sure you want to publish this programme? This will create a published version. Existing client assignments will not be updated.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Publish',
          onPress: () => {
            void (async () => {
              setSaving(true);
              setError(null);

              try {
                await publishWorkoutPlan(plan.id, 'none', []);
                await loadData();

                Alert.alert(
                  'Programme published',
                  'Your workout programme has been published successfully.',
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Unable to publish programme.',
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const renderField = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    multiline = false,
    keyboardType?: 'default' | 'numeric',
  ) => (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color={colors.text.primary}>
        {label}
      </AppText>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 90 : 52,
          borderWidth: 1,
          borderColor: colors.border.default,
          borderRadius: 12,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text.primary,
          backgroundColor: colors.background.secondary,
          fontSize: 14,
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.brand.red} size="large" />
        <AppText
          variant="body"
          color={colors.text.secondary}
        >
          Loading workout plan...
        </AppText>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          padding: spacing.lg,
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <AppText variant="h2" color={colors.text.primary}>
          Unable to open workout plan
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          {error ?? 'The requested workout plan could not be found.'}
        </AppText>

        <Button onPress={() => router.back()} variant="outline">
          Go back
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.huge + spacing.huge + spacing.lg,
          gap: spacing.xl,
        }}
      >
        {/* Header */}
        <View style={{ gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start' }}
          >
            <AppText variant="body" color={colors.text.secondary}>
              ← Workout Plans
            </AppText>
          </Pressable>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="caption" color={colors.brand.red}>
                WORKOUT BUILDER
              </AppText>

              <AppText variant="displayLarge" color={colors.text.primary}>
                {plan.name}
              </AppText>
            </View>

            <Badge tone={plan.status === 'published' ? 'success' : 'warning'}>
              {plan.status.toUpperCase()}
            </Badge>
          </View>

          <AppText variant="body" color={colors.text.secondary}>
            Version {plan.version} · {plan.duration_weeks ?? 'No'} weeks
          </AppText>
        </View>

        {error ? (
          <Card variant="outlined">
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          </Card>
        ) : null}

        {/* Programme details */}
        <Card variant="outlined" style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              PROGRAMME DETAILS
            </AppText>

            {isEditable ? (
              <Button
                size="small"
                variant="outline"
                onPress={() => setDetailsVisible(true)}
              >
                Edit
              </Button>
            ) : null}
          </View>

          <AppText variant="body" color={colors.text.secondary}>
            {plan.description || 'No programme description yet.'}
          </AppText>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" color={colors.text.tertiary}>
              TRAINING OBJECTIVES
            </AppText>

            <AppText variant="body" color={colors.text.primary}>
              {plan.objectives || 'No objectives added yet.'}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="bodySmall" color={colors.text.secondary}>
              {planExercises.length} exercises
            </AppText>

            <AppText variant="bodySmall" color={colors.text.secondary}>
              {groupedExercises.length} training days
            </AppText>
          </View>
        </Card>

        {/* Training schedule */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              TRAINING SCHEDULE
            </AppText>

            {isEditable ? (
              <Button
                size="small"
                onPress={() => {
                  const nextDay =
                    Math.max(
                      0,
                      ...groupedExercises.map((item) => item.day),
                    ) + 1;

                  openAddExercise(nextDay, `Day ${nextDay}`);
                }}
              >
                + Add day
              </Button>
            ) : null}
          </View>

          {groupedExercises.length === 0 ? (
            <Card variant="outlined">
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: spacing.xl,
                  gap: spacing.md,
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  No exercises yet
                </AppText>

                <AppText
                  variant="body"
                  color={colors.text.secondary}
                  align="center"
                >
                  Start building your programme by adding exercises
                  from your Exercise Library.
                </AppText>

                {isEditable ? (
                  <Button onPress={() => openAddExercise()}>
                    Add first exercise
                  </Button>
                ) : null}
              </View>
            </Card>
          ) : (
            <>
              <ScrollView
                ref={trainingDaysRef}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                style={{ width: trainingDayPageWidth }}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x /
                    trainingDayPageWidth,
                  );

                  setActiveDayIndex(
                    Math.max(
                      0,
                      Math.min(index, groupedExercises.length - 1),
                    ),
                  );
                }}
              >
                {groupedExercises.map((group) => (
                  <View
                    key={group.day}
                    style={{ width: trainingDayPageWidth }}
                  >
                    <Card
                      variant="outlined"
                      style={{ gap: spacing.md }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ gap: spacing.xs, flex: 1 }}>
                          <AppText
                            variant="h3"
                            color={colors.text.primary}
                          >
                            {group.name}
                          </AppText>

                          <AppText
                            variant="caption"
                            color={colors.text.secondary}
                          >
                            {group.exercises.length} exercises
                          </AppText>
                        </View>

                        {isEditable ? (
                          <Button
                            size="small"
                            variant="outline"
                            onPress={() =>
                              openAddExercise(group.day, group.name)
                            }
                          >
                            + Exercise
                          </Button>
                        ) : null}
                      </View>

                      {group.exercises.map((item, index) => (
                        <View
                          key={item.id}
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
                              gap: spacing.sm,
                            }}
                          >
                            <View style={{ flex: 1, gap: spacing.xs }}>
                              <AppText
                                variant="body"
                                color={colors.text.primary}
                              >
                                {index + 1}. {item.exercise?.name ?? 'Exercise'}
                              </AppText>

                              <AppText
                                variant="caption"
                                color={colors.text.secondary}
                              >
                                {item.sets} sets × {item.repetitions}
                                {item.rest_seconds !== null
                                  ? ` · ${item.rest_seconds}s rest`
                                  : ''}
                              </AppText>
                            </View>

                            {isEditable ? (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  gap: spacing.sm,
                                }}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Edit exercise"
                                  onPress={() => openEditExercise(item)}
                                >
                                  <AppText color={colors.brand.red}>
                                    Edit
                                  </AppText>
                                </Pressable>

                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Remove exercise"
                                  onPress={() => void deleteExercise(item)}
                                >
                                  <AppText color={colors.error}>
                                    ×
                                  </AppText>
                                </Pressable>
                              </View>
                            ) : null}
                          </View>

                          {item.notes ? (
                            <AppText
                              variant="caption"
                              color={colors.text.secondary}
                            >
                              {item.notes}
                            </AppText>
                          ) : null}
                        </View>
                      ))}
                    </Card>
                  </View>
                ))}
              </ScrollView>

              {/* Training day pagination */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText
                  variant="caption"
                  color={colors.text.secondary}
                >
                  Day {activeDayIndex + 1} of {groupedExercises.length}
                </AppText>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  {groupedExercises.map((group, index) => (
                    <Pressable
                      key={group.day}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to ${group.name}`}
                      accessibilityState={{
                        selected: activeDayIndex === index,
                      }}
                      onPress={() => {
                        trainingDaysRef.current?.scrollTo({
                          x: index * trainingDayPageWidth,
                          animated: true,
                        });

                        setActiveDayIndex(index);
                      }}
                      style={{
                        width: activeDayIndex === index ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          activeDayIndex === index
                            ? colors.brand.red
                            : colors.border.default,
                      }}
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Revision for published plans */}
        {!isEditable ? (
          <Card variant="outlined" style={{ gap: spacing.md }}>
            <AppText variant="h3" color={colors.text.primary}>
              PUBLISHED PROGRAMME
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Published programmes are preserved. Start a new draft
              revision before making changes.
            </AppText>

            <Button
              fullWidth
              loading={saving}
              onPress={() => void startRevision()}
            >
              Create new draft revision
            </Button>
          </Card>
        ) : null}

        {/* Draft actions */}
        {isEditable ? (
          <View style={{ gap: spacing.md }}>
            <Button
              fullWidth
              loading={saving}
              disabled={saving || planExercises.length === 0}
              onPress={publishProgramme}
            >
              Publish Programme
            </Button>

            <Button
              fullWidth
              variant="outline"
              disabled={saving}
              onPress={() => void loadData()}
            >
              Refresh programme
            </Button>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              align="center"
            >
              Changes are saved as you edit the draft.
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      {/* Programme details sheet */}
      <BottomSheet
        visible={detailsVisible}
        onClose={() => {
          if (!saving) setDetailsVisible(false);
        }}
        title="Edit programme details"
        subtitle="Update the information for this workout plan."
        footer={
          <Button
            fullWidth
            loading={saving}
            onPress={() => void saveDetails()}
          >
            Save details
          </Button>
        }
      >
        <View style={{ gap: spacing.lg }}>
          {renderField('PLAN NAME', name, setName, 'Plan name')}

          {renderField(
            'DESCRIPTION',
            description,
            setDescription,
            'Programme description',
            true,
          )}

          {renderField(
            'OBJECTIVES',
            objectives,
            setObjectives,
            'Training objectives',
            true,
          )}

          {renderField(
            'DURATION (WEEKS)',
            duration,
            setDuration,
            '4',
            false,
            'numeric',
          )}
        </View>
      </BottomSheet>

      {/* Exercise selection and configuration */}
      <BottomSheet
        visible={exerciseVisible}
        onClose={() => {
          if (!saving) setExerciseVisible(false);
        }}
        title={editingExercise ? 'Edit exercise' : 'Add exercise'}
        subtitle="Select a movement and configure its training details."
        scrollable
        footer={
          <Button
            fullWidth
            loading={saving}
            onPress={() => void saveExercise()}
          >
            {editingExercise ? 'Save exercise' : 'Add to programme'}
          </Button>
        }
      >
        <View style={{ gap: spacing.lg }}>
          {!editingExercise ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" color={colors.text.primary}>
                SELECT EXERCISE
              </AppText>

              <TextInput
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                placeholder="Search exercises..."
                placeholderTextColor={colors.text.tertiary}
                style={{
                  minHeight: 50,
                  paddingHorizontal: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  color: colors.text.primary,
                  backgroundColor: colors.background.secondary,
                }}
              />

              <View style={{ gap: spacing.sm }}>
                {filteredExercises.map((exercise) => {
                  const selected =
                    exerciseForm.exercise_id === exercise.id;

                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() =>
                        updateExerciseField('exercise_id', exercise.id)
                      }
                      style={{
                        padding: spacing.md,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.brand.red
                          : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.redLight
                          : colors.background.secondary,
                        gap: spacing.xs,
                      }}
                    >
                      <AppText
                        variant="body"
                        color={
                          selected
                            ? colors.brand.red
                            : colors.text.primary
                        }
                      >
                        {exercise.name}
                      </AppText>

                      <AppText
                        variant="caption"
                        color={colors.text.secondary}
                      >
                        {exercise.muscle_group || 'Uncategorised'}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              {filteredExercises.length === 0 ? (
                <AppText variant="body" color={colors.text.secondary}>
                  No matching exercises found.
                </AppText>
              ) : null}
            </View>
          ) : (
            <Card variant="outlined">
              <AppText variant="body" color={colors.text.primary}>
                {editingExercise.exercise?.name ?? 'Selected exercise'}
              </AppText>
            </Card>
          )}

          {renderField(
            'TRAINING DAY NUMBER',
            exerciseForm.day_number,
            (value) => updateExerciseField('day_number', value),
            '1',
            false,
            'numeric',
          )}

          {renderField(
            'DAY NAME',
            exerciseForm.day_name,
            (value) => updateExerciseField('day_name', value),
            'Day 1',
          )}

          {renderField(
            'SETS',
            exerciseForm.sets,
            (value) => updateExerciseField('sets', value),
            '3',
            false,
            'numeric',
          )}

          {renderField(
            'REPETITIONS',
            exerciseForm.repetitions,
            (value) => updateExerciseField('repetitions', value),
            '12 or 8-12',
          )}

          {renderField(
            'REST (SECONDS)',
            exerciseForm.rest_seconds,
            (value) => updateExerciseField('rest_seconds', value),
            '60',
            false,
            'numeric',
          )}

          {renderField(
            'EXERCISE NOTES',
            exerciseForm.notes,
            (value) => updateExerciseField('notes', value),
            'Instructions or coaching notes...',
            true,
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
