import { getFitnessGoalById, getFitnessGoals } from '@/services/fitness-goals';
import { getFitnessProgress } from '@/services/fitness-progress';
import { getExercisePerformanceHistory } from '@/services/exercise-performance-history';
import { getPersonalWorkoutHistory } from '@/services/personal-workouts';

import type {
  FitnessGoal,
  PersonalWorkout,
  WorkoutSet,
} from '@/types/personal-workouts';
import type { FitnessProgress } from '@/services/fitness-progress';
import type {
  ExercisePerformanceHistoryItem,
  ExercisePerformanceSession,
} from '@/services/exercise-performance-history';

// =========================================================
// TYPES
// =========================================================

export type FitnessGoalProgress = {
  goalId: string;
  goalName: string;
  goalType: FitnessGoal['goal_type'];
  currentValue: number | null;
  targetValue: number;
  unit: string | null;
  progressPercentage: number | null;
  isAvailable: boolean;
};

export type GoalProgressData = {
  workouts: PersonalWorkout[];
  measurements: FitnessProgress[];
  exerciseHistory: ExercisePerformanceHistoryItem[];
};

type ExerciseMetric = 'weight' | 'distance';

// =========================================================
// CONSTANTS
// =========================================================

const HISTORY_PAGE_SIZE = 100;
const KG_PER_LB = 0.45359237;
const KM_PER_MI = 1.609344;

// =========================================================
// DATE HELPERS
// =========================================================

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;

  start.setDate(start.getDate() - daysSinceMonday);

  return localDateKey(start);
}

function isValidTimestamp(value: string | null): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function isCompletedWorkout(workout: PersonalWorkout): boolean {
  return (
    workout.status === 'completed' &&
    isValidTimestamp(workout.completed_at)
  );
}

// =========================================================
// UNIT CONVERSION
// =========================================================

function convertWeight(value: number, from: string, to: string): number | null {
  if (from === to && (from === 'kg' || from === 'lb')) {
    return value;
  }

  if (from === 'kg' && to === 'lb') {
    return value / KG_PER_LB;
  }

  if (from === 'lb' && to === 'kg') {
    return value * KG_PER_LB;
  }

  return null;
}

function convertDistance(
  value: number,
  from: string,
  to: string,
): number | null {
  if (from === to && (from === 'km' || from === 'mi')) {
    return value;
  }

  if (from === 'km' && to === 'mi') {
    return value / KM_PER_MI;
  }

  if (from === 'mi' && to === 'km') {
    return value * KM_PER_MI;
  }

  return null;
}

function getProgressPercentage(current: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (current / target) * 100));
}

function unavailableProgress(goal: FitnessGoal): FitnessGoalProgress {
  return {
    goalId: goal.id,
    goalName: goal.goal_name,
    goalType: goal.goal_type,
    currentValue: null,
    targetValue: goal.target_value,
    unit: goal.measurement_unit,
    progressPercentage: null,
    isAvailable: false,
  };
}

function createProgress(
  goal: FitnessGoal,
  currentValue: number,
  targetValue = goal.target_value,
  unit = goal.measurement_unit,
): FitnessGoalProgress {
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return unavailableProgress(goal);
  }

  return {
    goalId: goal.id,
    goalName: goal.goal_name,
    goalType: goal.goal_type,
    currentValue,
    targetValue,
    unit,
    progressPercentage: getProgressPercentage(currentValue, targetValue),
    isAvailable: true,
  };
}

// =========================================================
// WORKOUT CALCULATIONS
// =========================================================

function getCurrentWeekWorkouts(
  goal: FitnessGoal,
  workouts: PersonalWorkout[],
  referenceDate: Date,
): PersonalWorkout[] {
  const today = localDateKey(referenceDate);
  const weekStart = getWeekStart(referenceDate);
  const effectiveStart = goal.start_date > weekStart
    ? goal.start_date
    : weekStart;

  return workouts.filter(
    (workout) =>
      isCompletedWorkout(workout) &&
      workout.workout_date >= effectiveStart &&
      workout.workout_date <= today,
  );
}

function calculateWorkoutFrequency(
  goal: FitnessGoal,
  data: GoalProgressData,
  referenceDate: Date,
): FitnessGoalProgress {
  const workouts = getCurrentWeekWorkouts(goal, data.workouts, referenceDate);

  return createProgress(
    goal,
    workouts.length,
    goal.target_value,
    'workouts/week',
  );
}

function calculateWorkoutDuration(
  goal: FitnessGoal,
  data: GoalProgressData,
  referenceDate: Date,
): FitnessGoalProgress {
  const workouts = getCurrentWeekWorkouts(goal, data.workouts, referenceDate);

  const durations = workouts
    .map((workout) => workout.duration_seconds)
    .filter(
      (duration): duration is number =>
        typeof duration === 'number' &&
        Number.isFinite(duration) &&
        duration >= 0,
    );

  if (durations.length === 0) {
    return unavailableProgress(goal);
  }

  const totalMinutes =
    durations.reduce((total, duration) => total + duration, 0) / 60;

  const unit = goal.measurement_unit?.toLowerCase();

  const targetMinutes =
    unit === 'hours' || unit === 'hour' || unit === 'h'
      ? goal.target_value * 60
      : unit === 'seconds' || unit === 'second' || unit === 's'
        ? goal.target_value / 60
        : goal.target_value;

  return createProgress(goal, totalMinutes, targetMinutes, 'minutes/week');
}

// =========================================================
// EXERCISE CALCULATIONS
// =========================================================

function getExerciseSessions(
  goal: FitnessGoal,
  history: ExercisePerformanceHistoryItem[],
  referenceDate: Date,
): ExercisePerformanceSession[] {
  const source = goal.exercise_id ? 'shared' : 'personal';
  const exerciseId = goal.exercise_id ?? goal.personal_exercise_id;

  if (!exerciseId) {
    return [];
  }

  const exercise = history.find(
    (item) =>
      item.exerciseId === exerciseId &&
      item.exerciseSource === source,
  );

  if (!exercise) {
    return [];
  }

  const today = localDateKey(referenceDate);

  return exercise.sessions.filter(
    (session) =>
      session.workoutDate >= goal.start_date &&
      session.workoutDate <= today &&
      isValidTimestamp(session.completedAt),
  );
}

function getExerciseTargetUnit(
  goal: FitnessGoal,
  sessions: ExercisePerformanceSession[],
  metric: ExerciseMetric,
): string | null {
  if (goal.measurement_unit) {
    return goal.measurement_unit.toLowerCase();
  }

  for (const session of sessions) {
    for (const set of session.sets) {
      const unit = metric === 'weight'
        ? set.weight_unit
        : set.distance_unit;

      if (unit) {
        return unit;
      }
    }
  }

  return null;
}

function getSetMetric(
  set: WorkoutSet,
  metric: ExerciseMetric,
  targetUnit: string,
): number | null {
  if (metric === 'weight') {
    if (
      typeof set.weight !== 'number' ||
      !Number.isFinite(set.weight) ||
      !set.weight_unit
    ) {
      return null;
    }

    return convertWeight(set.weight, set.weight_unit, targetUnit);
  }

  if (
    typeof set.distance !== 'number' ||
    !Number.isFinite(set.distance) ||
    !set.distance_unit
  ) {
    return null;
  }

  return convertDistance(set.distance, set.distance_unit, targetUnit);
}

function calculateExerciseTarget(
  goal: FitnessGoal,
  data: GoalProgressData,
  referenceDate: Date,
  metric: ExerciseMetric,
): FitnessGoalProgress {
  const sessions = getExerciseSessions(
    goal,
    data.exerciseHistory,
    referenceDate,
  );

  if (sessions.length === 0) {
    return unavailableProgress(goal);
  }

  const unit = getExerciseTargetUnit(goal, sessions, metric);

  if (
    !unit ||
    (metric === 'weight' && unit !== 'kg' && unit !== 'lb') ||
    (metric === 'distance' && unit !== 'km' && unit !== 'mi')
  ) {
    return unavailableProgress(goal);
  }

  const values = sessions
    .flatMap((session) => session.sets)
    .map((set) => getSetMetric(set, metric, unit))
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value) && value >= 0,
    );

  if (values.length === 0) {
    return unavailableProgress(goal);
  }

  return createProgress(goal, Math.max(...values), goal.target_value, unit);
}

// =========================================================
// BODY-WEIGHT CALCULATION
// =========================================================

function calculateBodyWeightProgress(
  goal: FitnessGoal,
  measurements: FitnessProgress[],
  referenceDate: Date,
): FitnessGoalProgress {
  const today = localDateKey(referenceDate);

  const weightRecords = measurements
    .filter(
      (measurement) =>
        measurement.metric_type === 'body_weight' &&
        Number.isFinite(measurement.value) &&
        measurement.value > 0 &&
        isValidTimestamp(measurement.recorded_at) &&
        measurement.recorded_at.slice(0, 10) <= today,
    )
    .sort(
      (a, b) =>
        Date.parse(b.recorded_at) - Date.parse(a.recorded_at),
    );

  const baseline = weightRecords.find(
    (measurement) =>
      measurement.recorded_at.slice(0, 10) <= goal.start_date,
  );

  const current = weightRecords.find(
    (measurement) =>
      measurement.recorded_at.slice(0, 10) >= goal.start_date,
  );

  if (!baseline || !current) {
    return unavailableProgress(goal);
  }

  const targetUnit = goal.measurement_unit?.toLowerCase() ?? baseline.unit;

  if (targetUnit !== 'kg' && targetUnit !== 'lb') {
    return unavailableProgress(goal);
  }

  const baselineValue = convertWeight(
    baseline.value,
    baseline.unit,
    targetUnit,
  );

  const currentValue = convertWeight(
    current.value,
    current.unit,
    targetUnit,
  );

  if (baselineValue === null || currentValue === null) {
    return unavailableProgress(goal);
  }

  const requiredChange = goal.target_value - baselineValue;

  // If the baseline already equals the target, only an exact match is complete.
  if (Math.abs(requiredChange) < 0.000001) {
    return createProgress(
      goal,
      Math.abs(currentValue - goal.target_value) < 0.000001 ? 100 : 0,
      100,
      '%',
    );
  }

  // Measures movement from the baseline towards the target.
  const percentage =
    ((currentValue - baselineValue) / requiredChange) * 100;

  return {
    goalId: goal.id,
    goalName: goal.goal_name,
    goalType: goal.goal_type,
    currentValue,
    targetValue: goal.target_value,
    unit: targetUnit,
    progressPercentage: Math.min(100, Math.max(0, percentage)),
    isAvailable: true,
  };
}

// =========================================================
// PURE CALCULATION
// =========================================================

export function calculateFitnessGoalProgress(
  goal: FitnessGoal,
  data: GoalProgressData,
  referenceDate: Date = new Date(),
): FitnessGoalProgress {
  switch (goal.goal_type) {
    case 'workout_frequency':
      return calculateWorkoutFrequency(goal, data, referenceDate);

    case 'workout_duration':
      return calculateWorkoutDuration(goal, data, referenceDate);

    case 'strength_target':
      return calculateExerciseTarget(
        goal,
        data,
        referenceDate,
        'weight',
      );

    case 'cardio_target':
      return calculateExerciseTarget(
        goal,
        data,
        referenceDate,
        'distance',
      );

    case 'body_weight':
      return calculateBodyWeightProgress(
        goal,
        data.measurements,
        referenceDate,
      );

    case 'custom':
      return goal.current_value === null
        ? unavailableProgress(goal)
        : createProgress(goal, goal.current_value);

    default:
      return unavailableProgress(goal);
  }
}

// =========================================================
// DATA RETRIEVAL
// =========================================================

async function getAllCompletedWorkouts(): Promise<PersonalWorkout[]> {
  const workouts: PersonalWorkout[] = [];
  let offset = 0;

  while (true) {
    const page = await getPersonalWorkoutHistory({
      status: 'completed',
      limit: HISTORY_PAGE_SIZE,
      offset,
    });

    workouts.push(...page);

    if (page.length < HISTORY_PAGE_SIZE) {
      break;
    }

    offset += page.length;
  }

  return workouts.filter(isCompletedWorkout);
}

async function getGoalProgressData(
  goals: FitnessGoal[],
): Promise<GoalProgressData> {
  const needsWorkouts = goals.some(
    (goal) =>
      goal.goal_type === 'workout_frequency' ||
      goal.goal_type === 'workout_duration',
  );

  const needsExerciseHistory = goals.some(
    (goal) =>
      goal.goal_type === 'strength_target' ||
      goal.goal_type === 'cardio_target',
  );

  const needsMeasurements = goals.some(
    (goal) => goal.goal_type === 'body_weight',
  );

  const [workouts, exerciseHistory, measurements] = await Promise.all([
    needsWorkouts ? getAllCompletedWorkouts() : Promise.resolve([]),
    needsExerciseHistory
      ? getExercisePerformanceHistory()
      : Promise.resolve([]),
    needsMeasurements ? getFitnessProgress() : Promise.resolve([]),
  ]);

  return {
    workouts,
    exerciseHistory,
    measurements,
  };
}

// =========================================================
// PUBLIC API
// =========================================================

/**
 * Calculates progress for one measurable fitness goal.
 * Data is fetched fresh on each call.
 */
export async function getFitnessGoalProgress(
  goalId: string,
  referenceDate: Date = new Date(),
): Promise<FitnessGoalProgress> {
  const goal = await getFitnessGoalById(goalId);
  const data = await getGoalProgressData([goal]);

  return calculateFitnessGoalProgress(goal, data, referenceDate);
}

/**
 * Calculates progress for all of the authenticated user's goals.
 * Workout, exercise and measurement data are loaded once per request.
 */
export async function getFitnessGoalsProgress(
  referenceDate: Date = new Date(),
): Promise<FitnessGoalProgress[]> {
  const goals = await getFitnessGoals();

  if (goals.length === 0) {
    return [];
  }

  const data = await getGoalProgressData(goals);

  return goals.map((goal) =>
    calculateFitnessGoalProgress(goal, data, referenceDate),
  );
}
