import { supabase } from '@/lib/supabase';

import type {
  CreateFitnessGoalInput,
  FitnessGoal,
  FitnessGoalStatus,
  FitnessGoalType,
  UpdateFitnessGoalInput,
} from '@/types/personal-workouts';

// =========================================================
// CONFIGURATION
// =========================================================

const FITNESS_GOAL_COLUMNS = `
  id,
  user_id,
  goal_type,
  goal_name,
  description,
  target_value,
  measurement_unit,
  start_date,
  target_date,
  goal_status,
  created_at,
  updated_at
`;

const VALID_GOAL_TYPES: FitnessGoalType[] = [
  'workout_frequency',
  'strength_target',
  'cardio_target',
  'workout_duration',
  'body_weight',
  'custom',
];

const VALID_GOAL_STATUSES: FitnessGoalStatus[] = [
  'active',
  'paused',
  'completed',
  'archived',
];

// =========================================================
// VALIDATION
// =========================================================

function validateId(value: string) {
  if (!value?.trim()) {
    throw new Error('A valid fitness goal ID is required.');
  }
}

function validateGoalType(value: string) {
  if (!VALID_GOAL_TYPES.includes(value as FitnessGoalType)) {
    throw new Error('Please select a valid fitness goal type.');
  }
}

function validateGoalName(value: string) {
  if (!value?.trim()) {
    throw new Error('Please provide a fitness goal name.');
  }
}

function validateTargetValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Goal target must be a positive number.');
  }
}

function validateGoalStatus(value: string) {
  if (!VALID_GOAL_STATUSES.includes(value as FitnessGoalStatus)) {
    throw new Error('Please select a valid fitness goal status.');
  }
}

function validateDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Please provide a valid ${field}.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Please provide a valid ${field}.`);
  }
}

function validateGoalDates(startDate?: string, targetDate?: string | null) {
  if (startDate) {
    validateDate(startDate, 'goal start date');
  }

  if (targetDate) {
    validateDate(targetDate, 'goal target date');
  }

  if (startDate && targetDate && targetDate < startDate) {
    throw new Error('Goal target date cannot be before its start date.');
  }
}

function validateDescription(value: string | null | undefined) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error('Please provide a valid goal description.');
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
    console.error('[Fitness Goals] Unable to verify user:', error);

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

// =========================================================
// RETRIEVE GOALS
// =========================================================

export type FitnessGoalHistoryOptions = {
  status?: FitnessGoalStatus;
};

/**
 * Retrieves the authenticated user's measurable fitness goals.
 * Results are ordered by start date and creation date, newest first.
 */
export async function getFitnessGoals(
  options: FitnessGoalHistoryOptions = {},
): Promise<FitnessGoal[]> {
  if (options.status) {
    validateGoalStatus(options.status);
  }

  const user = await getAuthenticatedUser();

  let query = supabase
    .from('fitness_goals')
    .select(FITNESS_GOAL_COLUMNS)
    .eq('user_id', user.id);

  if (options.status) {
    query = query.eq('goal_status', options.status);
  }

  const { data, error } = await query
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Fitness Goals] Unable to load goals:', error);

    throw new Error('Unable to load your fitness goals. Please try again.');
  }

  return (data ?? []) as unknown as FitnessGoal[];
}

// =========================================================
// RETRIEVE SINGLE GOAL
// =========================================================

/**
 * Retrieves one measurable fitness goal belonging to the authenticated user.
 */
export async function getFitnessGoalById(goalId: string): Promise<FitnessGoal> {
  validateId(goalId);

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_goals')
    .select(FITNESS_GOAL_COLUMNS)
    .eq('id', goalId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Fitness Goals] Unable to load goal:', error);

    throw new Error('Unable to load your fitness goal. Please try again.');
  }

  if (!data) {
    throw new Error('Fitness goal not found.');
  }

  return data as unknown as FitnessGoal;
}

// =========================================================
// CREATE
// =========================================================

/**
 * Creates a measurable fitness goal for the authenticated user.
 * The database supplies the default start date and active status.
 */
export async function createFitnessGoal(
  input: CreateFitnessGoalInput,
): Promise<FitnessGoal> {
  validateGoalType(input.goal_type);
  validateGoalName(input.goal_name);
  validateTargetValue(input.target_value);
  validateDescription(input.description);
  validateGoalDates(input.start_date, input.target_date);

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_goals')
    .insert({
      user_id: user.id,
      goal_type: input.goal_type,
      goal_name: input.goal_name.trim(),
      description: input.description?.trim() || null,
      target_value: input.target_value,
      measurement_unit: input.measurement_unit?.trim() || null,
      ...(input.start_date ? { start_date: input.start_date } : {}),
      ...(input.target_date !== undefined ? { target_date: input.target_date } : {}),
    })
    .select(FITNESS_GOAL_COLUMNS)
    .single();

  if (error) {
    console.error('[Fitness Goals] Unable to create goal:', error);

    throw new Error('Unable to create your fitness goal. Please try again.');
  }

  return data as unknown as FitnessGoal;
}

// =========================================================
// UPDATE
// =========================================================

/**
 * Updates a measurable fitness goal belonging to the authenticated user.
 * Ownership cannot be changed through this operation.
 */
export async function updateFitnessGoal(
  goalId: string,
  input: UpdateFitnessGoalInput,
): Promise<FitnessGoal> {
  validateId(goalId);

  const updates: Record<string, unknown> = {};

  if (input.goal_type !== undefined) {
    validateGoalType(input.goal_type);
    updates.goal_type = input.goal_type;
  }

  if (input.goal_name !== undefined) {
    validateGoalName(input.goal_name);
    updates.goal_name = input.goal_name.trim();
  }

  if (input.description !== undefined) {
    validateDescription(input.description);
    updates.description = input.description?.trim() || null;
  }

  if (input.target_value !== undefined) {
    validateTargetValue(input.target_value);
    updates.target_value = input.target_value;
  }

  if (input.measurement_unit !== undefined) {
    updates.measurement_unit = input.measurement_unit?.trim() || null;
  }

  if (input.start_date !== undefined) {
    validateDate(input.start_date, 'goal start date');
    updates.start_date = input.start_date;
  }

  if (input.target_date !== undefined) {
    if (input.target_date !== null) {
      validateDate(input.target_date, 'goal target date');
    }

    updates.target_date = input.target_date;
  }

  if (input.goal_status !== undefined) {
    validateGoalStatus(input.goal_status);
    updates.goal_status = input.goal_status;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Please provide at least one field to update.');
  }

  const user = await getAuthenticatedUser();

  if (input.start_date !== undefined || input.target_date !== undefined) {
    let existingDates: {
      start_date: string;
      target_date: string | null;
    } | null = null;

    if (input.start_date === undefined || input.target_date === undefined) {
      const { data: existingGoal, error: lookupError } = await supabase
        .from('fitness_goals')
        .select('start_date, target_date')
        .eq('id', goalId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (lookupError) {
        console.error('[Fitness Goals] Unable to validate goal dates:', lookupError);

        throw new Error('Unable to validate your fitness goal dates. Please try again.');
      }

      if (!existingGoal) {
        throw new Error('Fitness goal not found.');
      }

      existingDates = existingGoal as {
        start_date: string;
        target_date: string | null;
      };
    }

    const effectiveStartDate = input.start_date ?? existingDates?.start_date;

    const effectiveTargetDate =
      input.target_date !== undefined ? input.target_date : existingDates?.target_date;

    if (effectiveStartDate && effectiveTargetDate) {
      validateGoalDates(effectiveStartDate, effectiveTargetDate);
    }
  }

  const { data, error } = await supabase
    .from('fitness_goals')
    .update(updates)
    .eq('id', goalId)
    .eq('user_id', user.id)
    .select(FITNESS_GOAL_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Fitness Goals] Unable to update goal:', error);

    throw new Error('Unable to update your fitness goal. Please try again.');
  }

  if (!data) {
    throw new Error('Fitness goal not found.');
  }

  return data as unknown as FitnessGoal;
}

// =========================================================
// COMPLETE
// =========================================================

/**
 * Marks an authenticated user's fitness goal as completed.
 */
export async function completeFitnessGoal(goalId: string): Promise<FitnessGoal> {
  return updateFitnessGoal(goalId, {
    goal_status: 'completed',
  });
}

// =========================================================
// DELETE
// =========================================================

/**
 * Deletes a measurable fitness goal belonging to the authenticated user.
 */
export async function deleteFitnessGoal(goalId: string): Promise<void> {
  validateId(goalId);

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[Fitness Goals] Unable to delete goal:', error);

    throw new Error('Unable to delete your fitness goal. Please try again.');
  }

  if (!data) {
    throw new Error('Fitness goal not found.');
  }
}
