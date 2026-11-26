import { getPersonalWorkoutHistory } from '@/services/personal-workouts';

import type { PersonalWorkout } from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const WORKOUT_STATISTICS_PAGE_SIZE = 100;

// =========================================================
// TYPES
// =========================================================

export type PersonalWorkoutStatistics = {
  completedWorkoutCount: number;
  recordedDurationSeconds: number | null;
  averageDurationSeconds: number | null;
  workoutsWithRecordedDuration: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  activeDaysThisWeek: number;
  activeDaysThisMonth: number;
};

// =========================================================
// DATE HELPERS
// =========================================================

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getWeekStart(referenceDate: Date): string {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  // Monday is the first day of the week.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  return formatLocalDate(start);
}

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// =========================================================
// STATISTICS CALCULATION
// =========================================================

/**
 * Calculates personal workout statistics from completed workouts.
 *
 * Date-only workout_date values are interpreted using calendar dates.
 * Missing durations are excluded from duration totals and averages.
 * Consistency is measured as distinct active workout days.
 */
export function calculatePersonalWorkoutStatistics(
  workouts: PersonalWorkout[],
  referenceDate: Date = new Date(),
): PersonalWorkoutStatistics {
  const validCompletedWorkouts = workouts.filter(
    (workout) =>
      workout.status === 'completed' &&
      Boolean(workout.completed_at) &&
      Number.isFinite(Date.parse(workout.completed_at as string)),
  );

  const weekStart = getWeekStart(referenceDate);
  const today = formatLocalDate(referenceDate);
  const monthPrefix = today.slice(0, 7);

  const workoutsThisWeek = validCompletedWorkouts.filter(
    (workout) =>
      isValidDateKey(workout.workout_date) &&
      workout.workout_date >= weekStart &&
      workout.workout_date <= today,
  );

  const workoutsThisMonth = validCompletedWorkouts.filter(
    (workout) =>
      isValidDateKey(workout.workout_date) &&
      workout.workout_date.startsWith(monthPrefix) &&
      workout.workout_date <= today,
  );

  const recordedDurations = validCompletedWorkouts
    .map((workout) => workout.duration_seconds)
    .filter(
      (duration): duration is number =>
        typeof duration === 'number' &&
        Number.isFinite(duration) &&
        duration >= 0,
    );

  const recordedDurationSeconds =
    recordedDurations.length > 0
      ? recordedDurations.reduce((total, duration) => total + duration, 0)
      : null;

  const averageDurationSeconds =
    recordedDurationSeconds !== null
      ? Math.round(recordedDurationSeconds / recordedDurations.length)
      : null;

  const activeDaysThisWeek = new Set(
    workoutsThisWeek.map((workout) => workout.workout_date),
  ).size;

  const activeDaysThisMonth = new Set(
    workoutsThisMonth.map((workout) => workout.workout_date),
  ).size;

  return {
    completedWorkoutCount: validCompletedWorkouts.length,
    recordedDurationSeconds,
    averageDurationSeconds,
    workoutsWithRecordedDuration: recordedDurations.length,
    workoutsThisWeek: workoutsThisWeek.length,
    workoutsThisMonth: workoutsThisMonth.length,
    activeDaysThisWeek,
    activeDaysThisMonth,
  };
}

// =========================================================
// RETRIEVE COMPLETE PERSONAL WORKOUT HISTORY
// =========================================================

/**
 * Retrieves every completed personal workout in pages.
 *
 * getPersonalWorkoutHistory scopes each request to the authenticated user.
 * Pagination prevents dashboard statistics from being limited to the
 * latest 100 records.
 */
export async function getPersonalWorkoutStatistics(): Promise<PersonalWorkoutStatistics> {
  const workouts: PersonalWorkout[] = [];
  let offset = 0;

  while (true) {
    const page = await getPersonalWorkoutHistory({
      status: 'completed',
      limit: WORKOUT_STATISTICS_PAGE_SIZE,
      offset,
    });

    workouts.push(...page);
    offset += page.length;

    if (page.length < WORKOUT_STATISTICS_PAGE_SIZE) {
      break;
    }
  }

  return calculatePersonalWorkoutStatistics(workouts);
}
