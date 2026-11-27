import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { createFitnessGoal } from '@/services/fitness-goals';
import { getExercises, type Exercise } from '@/services/exercises';
import { getPersonalExercises } from '@/services/personal-exercises';
import { useTrainrTheme } from '@/theme';
import type {
  CreateFitnessGoalInput,
  FitnessGoalType,
  PersonalExercise,
} from '@/types/personal-workouts';

type ExerciseSource = 'shared' | 'personal';

const GOAL_TYPES: { label: string; value: FitnessGoalType; description: string }[] = [
  { label: 'Workout frequency', value: 'workout_frequency', description: 'Reach a weekly workout target.' },
  { label: 'Strength', value: 'strength_target', description: 'Improve performance on an exercise.' },
  { label: 'Cardio', value: 'cardio_target', description: 'Reach a distance target.' },
  { label: 'Workout duration', value: 'workout_duration', description: 'Build weekly training time.' },
  { label: 'Body weight', value: 'body_weight', description: 'Track a body-weight target.' },
  { label: 'Custom', value: 'custom', description: 'Track a goal with your own progress.' },
];

const UNITS: Partial<Record<FitnessGoalType, string[]>> = {
  workout_frequency: ['workouts/week'],
  strength_target: ['kg', 'lb'],
  cardio_target: ['km', 'mi'],
  workout_duration: ['minutes'],
  body_weight: ['kg', 'lb'],
};

function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTrainrTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? colors.brand.red : colors.border.default,
        backgroundColor: selected ? colors.brand.redLight : colors.surface.default,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <AppText
        variant="bodySmall"
        color={selected ? colors.brand.red : colors.text.secondary}
        weight={selected ? '700' : '500'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function NewFitnessGoalScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [goalType, setGoalType] = useState<FitnessGoalType>('workout_frequency');
  const [goalName, setGoalName] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [unit, setUnit] = useState('workouts/week');
  const [startDate, setStartDate] = useState(today());
  const [targetDate, setTargetDate] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [exerciseSource, setExerciseSource] = useState<ExerciseSource>('shared');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [sharedExercises, setSharedExercises] = useState<Exercise[]>([]);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadExercises() {
      setIsLoadingExercises(true);
      try {
        const [shared, personal] = await Promise.all([
          getExercises(),
          getPersonalExercises(),
        ]);
        if (active) {
          setSharedExercises(shared);
          setPersonalExercises(personal);
        }
      } catch {
        if (active) {
          setErrorMessage('Unable to load exercises. You can retry by reopening this form.');
        }
      } finally {
        if (active) setIsLoadingExercises(false);
      }
    }

    void loadExercises();
    return () => {
      active = false;
    };
  }, []);

  const availableUnits = UNITS[goalType] ?? [];
  const exerciseGoals = goalType === 'strength_target' || goalType === 'cardio_target';

  const exercises = useMemo(
    () => exerciseSource === 'shared' ? sharedExercises : personalExercises,
    [exerciseSource, sharedExercises, personalExercises],
  );

  function handleGoalTypeChange(value: FitnessGoalType) {
    setGoalType(value);
    setSelectedExerciseId(null);
    setCurrentValue('');
    setCustomUnit('');

    const nextUnits = UNITS[value] ?? [];
    setUnit(nextUnits[0] ?? '');
  }

  async function handleSave() {
    if (isSaving) return;

    const target = Number(targetValue);
    const current = currentValue.trim() ? Number(currentValue) : null;

    if (!goalName.trim()) {
      setErrorMessage('Enter a name for this goal.');
      return;
    }

    if (!targetValue.trim() || !Number.isFinite(target) || target <= 0) {
      setErrorMessage('Enter a target greater than zero.');
      return;
    }

    if (goalType === 'custom' && current !== null && (!Number.isFinite(current) || current < 0)) {
      setErrorMessage('Current progress must be zero or greater.');
      return;
    }

    if (!isValidDate(startDate)) {
      setErrorMessage('Enter a valid start date in YYYY-MM-DD format.');
      return;
    }

    if (targetDate.trim() && !isValidDate(targetDate)) {
      setErrorMessage('Enter a valid target date in YYYY-MM-DD format.');
      return;
    }

    if (targetDate.trim() && targetDate < startDate) {
      setErrorMessage('Target date cannot be before the start date.');
      return;
    }

    if (exerciseGoals && !selectedExerciseId) {
      setErrorMessage('Select an exercise to track for this goal.');
      return;
    }

    if (goalType === 'custom' && !customUnit.trim()) {
      setErrorMessage('Enter a unit for your custom goal (for example, pages or kilometres).');
      return;
    }

    const input: CreateFitnessGoalInput = {
      goal_type: goalType,
      goal_name: goalName.trim(),
      description: description.trim() || null,
      target_value: target,
      measurement_unit: goalType === 'custom' ? customUnit.trim() : unit,
      start_date: startDate,
      target_date: targetDate.trim() || null,
      ...(goalType === 'custom' ? { current_value: current } : {}),
      ...(exerciseGoals && exerciseSource === 'shared'
        ? { exercise_id: selectedExerciseId }
        : {}),
      ...(exerciseGoals && exerciseSource === 'personal'
        ? { personal_exercise_id: selectedExerciseId }
        : {}),
    };

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createFitnessGoal(input);
      router.replace('/(tabs)/personal-workout/goals');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create your goal. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
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
            paddingVertical: spacing.xs,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <AppText variant="bodyMedium" color={colors.text.primary}>Back</AppText>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.brand.red} weight="700">
            FITNESS GOALS
          </AppText>
          <AppText variant="h1" color={colors.text.primary}>Create a goal</AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Choose a target that gives your training a clear direction.
          </AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" color={colors.text.primary}>Goal type</AppText>
          <View style={{ gap: spacing.sm }}>
            {GOAL_TYPES.map((item) => {
              const selected = goalType === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => handleGoalTypeChange(item.value)}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? colors.brand.red : colors.border.default,
                    backgroundColor: selected ? colors.brand.redLight : colors.surface.default,
                    borderRadius: 12,
                    padding: spacing.md,
                    gap: 3,
                  }}
                >
                  <AppText
                    variant="bodyMedium"
                    color={selected ? colors.brand.red : colors.text.primary}
                    weight="700"
                  >
                    {item.label}
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary}>
                    {item.description}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Input
            label="Goal name"
            placeholder="e.g. Complete four workouts each week"
            value={goalName}
            onChangeText={setGoalName}
            maxLength={120}
            returnKeyType="next"
          />

          <Input
            label="Description (optional)"
            placeholder="Add details about what you want to achieve."
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            numberOfLines={3}
          />

          <Input
            label="Target value"
            placeholder="Enter your target"
            value={targetValue}
            onChangeText={setTargetValue}
            keyboardType="decimal-pad"
          />

          {availableUnits.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" color={colors.text.primary}>Measurement unit</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {availableUnits.map((item) => (
                  <Choice key={item} label={item} selected={unit === item} onPress={() => setUnit(item)} />
                ))}
              </View>
            </View>
          ) : null}

          {goalType === 'custom' ? (
            <>
              <Input
                label="Unit"
                placeholder="e.g. pages, kilometres, sessions"
                value={customUnit}
                onChangeText={setCustomUnit}
                maxLength={30}
              />
              <Input
                label="Current progress (optional)"
                placeholder="0"
                value={currentValue}
                onChangeText={setCurrentValue}
                keyboardType="decimal-pad"
              />
              <AppText variant="caption" color={colors.text.secondary}>
                You can update this value as you make progress.
              </AppText>
            </>
          ) : null}

          {exerciseGoals ? (
            <View style={{ gap: spacing.md }}>
              <AppText variant="label" color={colors.text.primary}>Exercise to track</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Choice label="Shared exercises" selected={exerciseSource === 'shared'} onPress={() => {
                  setExerciseSource('shared');
                  setSelectedExerciseId(null);
                }} />
                <Choice label="My exercises" selected={exerciseSource === 'personal'} onPress={() => {
                  setExerciseSource('personal');
                  setSelectedExerciseId(null);
                }} />
              </View>

              {isLoadingExercises ? (
                <AppText variant="caption" color={colors.text.secondary}>Loading exercises…</AppText>
              ) : exercises.length === 0 ? (
                <AppText variant="caption" color={colors.text.secondary}>
                  No exercises available in this list.
                </AppText>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {exercises.map((exercise) => (
                    <Choice
                      key={exercise.id}
                      label={exercise.name}
                      selected={selectedExerciseId === exercise.id}
                      onPress={() => setSelectedExerciseId(exercise.id)}
                    />
                  ))}
                </View>
              )}
              <AppText variant="caption" color={colors.text.secondary}>
                Select the exercise whose performance should count towards this goal.
              </AppText>
            </View>
          ) : null}

          <Input
            label="Start date"
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
            helperText="Use the format YYYY-MM-DD."
            autoCapitalize="none"
          />

          <Input
            label="Target date (optional)"
            placeholder="YYYY-MM-DD"
            value={targetDate}
            onChangeText={setTargetDate}
            helperText="Leave blank if there is no deadline."
            autoCapitalize="none"
          />
        </View>

        {errorMessage ? (
          <AppText variant="bodySmall" color={colors.text.error}>{errorMessage}</AppText>
        ) : null}

        <Button
          fullWidth
          size="large"
          loading={isSaving}
          disabled={isSaving}
          onPress={() => void handleSave()}
        >
          Create goal
        </Button>
      </View>
    </Screen>
  );
}
