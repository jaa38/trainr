import { supabase } from '@/lib/supabase';

import type {
  PersonalRecord,
  PersonalRecordType,
  PersonalWorkoutCategory,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const DEFAULT_RECORD_LIMIT = 50;
const MAX_RECORD_LIMIT = 100;

const VALID_RECORD_TYPES: PersonalRecordType[] = [
  'max_weight',
  'max_repetitions',
  'max_distance',
  'fastest_time',
];

const VALID_CATEGORIES: PersonalWorkoutCategory[] = [
  'strength',
  'cardio',
  'bodyweight',
  'flexibility',
  'functional',
  'custom',
];

export type PersonalRecordOptions = {
  record_type?: PersonalRecordType;
  exercise_category?: PersonalWorkoutCategory;
  exerciseId?: string;
  exerciseSource?: 'shared' | 'personal';
  limit?: number;
  offset?: number;
};

// =========================================================
// VALIDATION
// =========================================================

function validateId(value: string, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validateRecordType(value: string) {
  if (!VALID_RECORD_TYPES.includes(value as PersonalRecordType)) {
    throw new Error('Please select a valid personal record type.');
  }
}

function validateCategory(value: string) {
  if (!VALID_CATEGORIES.includes(value as PersonalWorkoutCategory)) {
    throw new Error('Please select a valid exercise category.');
  }
}

function validatePagination(limit: number, offset: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RECORD_LIMIT) {
    throw new Error(`Personal record limit must be between 1 and ${MAX_RECORD_LIMIT}.`);
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Personal record offset must be a non-negative whole number.');
  }
}

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Personal Records] Unable to verify user:', error);

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

// =========================================================
// RETRIEVE PERSONAL RECORDS
// =========================================================

/**
 * Retrieves personal records belonging to the authenticated user.
 *
 * Records are calculated by the database personal_records view.
 * This service does not recalculate or modify record values.
 */
export async function getPersonalRecords(
  options: PersonalRecordOptions = {},
): Promise<PersonalRecord[]> {
  const limit = options.limit ?? DEFAULT_RECORD_LIMIT;
  const offset = options.offset ?? 0;

  validatePagination(limit, offset);

  if (options.record_type !== undefined) {
    validateRecordType(options.record_type);
  }

  if (options.exercise_category !== undefined) {
    validateCategory(options.exercise_category);
  }

  if (options.exerciseId !== undefined) {
    validateId(options.exerciseId, 'Exercise ID');

    if (options.exerciseSource !== 'shared' && options.exerciseSource !== 'personal') {
      throw new Error('Please select a valid exercise source.');
    }
  } else if (options.exerciseSource !== undefined) {
    throw new Error('An exercise ID is required when specifying its source.');
  }

  const user = await getAuthenticatedUser();

  let query = supabase.from('personal_records').select('*').eq('user_id', user.id);

  if (options.record_type) {
    query = query.eq('record_type', options.record_type);
  }

  if (options.exercise_category) {
    query = query.eq('exercise_category', options.exercise_category);
  }

  if (options.exerciseId) {
    const column =
      options.exerciseSource === 'personal' ? 'personal_exercise_id' : 'exercise_id';

    query = query.eq(column, options.exerciseId);
  }

  const { data, error } = await query
    .order('achieved_at', { ascending: false })
    .order('record_type', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Personal Records] Unable to load records:', error);

    throw new Error('Unable to load your personal records. Please try again.');
  }

  return (data ?? []) as unknown as PersonalRecord[];
}

// =========================================================
// RETRIEVE SINGLE PERSONAL RECORD
// =========================================================

/**
 * Retrieves one personal record belonging to the authenticated user.
 */
export async function getPersonalRecordById(recordId: string): Promise<PersonalRecord> {
  validateId(recordId, 'Personal record ID');

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('id', recordId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Personal Records] Unable to retrieve record:', error);

    throw new Error('Unable to load this personal record. Please try again.');
  }

  if (!data) {
    throw new Error('Personal record not found.');
  }

  return data as unknown as PersonalRecord;
}

// =========================================================
// RETRIEVE RECORDS BY EXERCISE
// =========================================================

/**
 * Retrieves records for a shared or personal exercise.
 */
export async function getPersonalRecordsByExercise(
  exerciseId: string,
  source: 'shared' | 'personal',
): Promise<PersonalRecord[]> {
  validateId(exerciseId, 'Exercise ID');

  if (source !== 'shared' && source !== 'personal') {
    throw new Error('Please select a valid exercise source.');
  }

  return getPersonalRecords({
    exerciseId,
    exerciseSource: source,
  });
}
