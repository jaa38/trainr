import { supabase } from '@/lib/supabase';

import type {
  CreatePersonalExerciseInput,
  PersonalExercise,
  PersonalWorkoutCategory,
  UpdatePersonalExerciseInput,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const PERSONAL_EXERCISE_COLUMNS = `
  id,
  user_id,
  name,
  description,
  category,
  muscle_group,
  equipment,
  instructions,
  archived_at,
  created_at,
  updated_at
`;

const VALID_CATEGORIES: PersonalWorkoutCategory[] = [
  'strength',
  'cardio',
  'bodyweight',
  'flexibility',
  'functional',
  'custom',
];

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Personal Exercises] Unable to verify user:', error);

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user.id;
}

// =========================================================
// VALIDATION
// =========================================================

function validateId(value: string) {
  if (!value?.trim()) {
    throw new Error('An exercise ID is required.');
  }
}

function validateName(value: string) {
  if (!value?.trim()) {
    throw new Error('Exercise name is required.');
  }

  if (value.trim().length > 120) {
    throw new Error('Exercise name must be 120 characters or fewer.');
  }
}

function validateCategory(value: string) {
  if (!VALID_CATEGORIES.includes(value as PersonalWorkoutCategory)) {
    throw new Error('Please select a valid exercise category.');
  }
}

function validateEquipment(value: string[] | undefined) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new Error('Exercise equipment must be a list.');
  }

  if (value.some((item) => typeof item !== 'string')) {
    throw new Error('Exercise equipment must contain valid text values.');
  }
}

function normaliseOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return value.trim() || null;
}

function normaliseCreateInput(input: CreatePersonalExerciseInput) {
  validateName(input.name);
  validateCategory(input.category);
  validateEquipment(input.equipment);

  return {
    name: input.name.trim(),
    description: normaliseOptionalText(input.description) ?? null,
    category: input.category,
    muscle_group: normaliseOptionalText(input.muscle_group) ?? null,
    equipment: (input.equipment ?? []).map((item) => item.trim()).filter(Boolean),
    instructions: normaliseOptionalText(input.instructions) ?? null,
  };
}

function normaliseUpdateInput(input: UpdatePersonalExerciseInput) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    validateName(input.name);
    payload.name = input.name.trim();
  }

  if (input.category !== undefined) {
    validateCategory(input.category);
    payload.category = input.category;
  }

  if (input.description !== undefined) {
    payload.description = normaliseOptionalText(input.description);
  }

  if (input.muscle_group !== undefined) {
    payload.muscle_group = normaliseOptionalText(input.muscle_group);
  }

  if (input.equipment !== undefined) {
    validateEquipment(input.equipment);

    payload.equipment = input.equipment.map((item) => item.trim()).filter(Boolean);
  }

  if (input.instructions !== undefined) {
    payload.instructions = normaliseOptionalText(input.instructions);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Please provide at least one field to update.');
  }

  return payload;
}

// =========================================================
// ERROR HANDLING
// =========================================================

function handlePersonalExerciseError(action: string, error: { message: string }): never {
  console.error(`[Personal Exercises] Unable to ${action}:`, error);

  throw new Error(`Unable to ${action}. Please try again.`);
}

// =========================================================
// RETRIEVE EXERCISES
// =========================================================

export type PersonalExerciseHistoryOptions = {
  includeArchived?: boolean;
};

/**
 * Retrieves personal exercises belonging to the authenticated user.
 * Archived exercises are excluded by default.
 */
export async function getPersonalExercises(
  options: PersonalExerciseHistoryOptions = {},
): Promise<PersonalExercise[]> {
  const userId = await getAuthenticatedUserId();

  let query = supabase
    .from('personal_exercises')
    .select(PERSONAL_EXERCISE_COLUMNS)
    .eq('user_id', userId);

  if (!options.includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query.order('name', {
    ascending: true,
  });

  if (error) {
    handlePersonalExerciseError('load personal exercises', error);
  }

  return (data ?? []) as PersonalExercise[];
}

/**
 * Retrieves a personal exercise by ID.
 * Archived exercises can also be retrieved for restoration.
 */
export async function getPersonalExerciseById(
  exerciseId: string,
): Promise<PersonalExercise> {
  validateId(exerciseId);

  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('personal_exercises')
    .select(PERSONAL_EXERCISE_COLUMNS)
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    handlePersonalExerciseError('load personal exercise', error);
  }

  if (!data) {
    throw new Error('Personal exercise not found.');
  }

  return data as PersonalExercise;
}

// =========================================================
// CREATE
// =========================================================

/**
 * Creates a personal exercise for the authenticated user.
 */
export async function createPersonalExercise(
  input: CreatePersonalExerciseInput,
): Promise<PersonalExercise> {
  const userId = await getAuthenticatedUserId();
  const exercise = normaliseCreateInput(input);

  const { data, error } = await supabase
    .from('personal_exercises')
    .insert({
      ...exercise,
      user_id: userId,
    })
    .select(PERSONAL_EXERCISE_COLUMNS)
    .single();

  if (error) {
    handlePersonalExerciseError('create personal exercise', error);
  }

  if (!data) {
    throw new Error('The personal exercise was not created. Please try again.');
  }

  return data as PersonalExercise;
}

// =========================================================
// UPDATE
// =========================================================

/**
 * Updates an active personal exercise owned by the authenticated user.
 */
export async function updatePersonalExercise(
  exerciseId: string,
  input: UpdatePersonalExerciseInput,
): Promise<PersonalExercise> {
  validateId(exerciseId);

  const userId = await getAuthenticatedUserId();
  const payload = normaliseUpdateInput(input);

  const { data, error } = await supabase
    .from('personal_exercises')
    .update(payload)
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .select(PERSONAL_EXERCISE_COLUMNS)
    .maybeSingle();

  if (error) {
    handlePersonalExerciseError('update personal exercise', error);
  }

  if (!data) {
    throw new Error('Personal exercise not found or it is no longer active.');
  }

  return data as PersonalExercise;
}

// =========================================================
// ARCHIVE
// =========================================================

/**
 * Archives a personal exercise without deleting its history.
 */
export async function archivePersonalExercise(
  exerciseId: string,
): Promise<PersonalExercise> {
  validateId(exerciseId);

  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('personal_exercises')
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .select(PERSONAL_EXERCISE_COLUMNS)
    .maybeSingle();

  if (error) {
    handlePersonalExerciseError('archive personal exercise', error);
  }

  if (!data) {
    throw new Error('Personal exercise not found or it has already been archived.');
  }

  return data as PersonalExercise;
}

// =========================================================
// RESTORE
// =========================================================

/**
 * Restores an archived personal exercise.
 */
export async function restorePersonalExercise(
  exerciseId: string,
): Promise<PersonalExercise> {
  validateId(exerciseId);

  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('personal_exercises')
    .update({
      archived_at: null,
    })
    .eq('id', exerciseId)
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .select(PERSONAL_EXERCISE_COLUMNS)
    .maybeSingle();

  if (error) {
    handlePersonalExerciseError('restore personal exercise', error);
  }

  if (!data) {
    throw new Error('Archived personal exercise not found.');
  }

  return data as PersonalExercise;
}
