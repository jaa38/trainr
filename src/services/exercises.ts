
import { supabase } from '@/lib/supabase';

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string | null;
  category: string | null;
  equipment: string[];
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExerciseInput = {
  name: string;
  description?: string | null;
  muscle_group?: string | null;
  category?: string | null;
  equipment?: string[];
  instructions?: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

const EXERCISE_COLUMNS =
  'id, name, description, muscle_group, category, equipment, instructions, image_url, video_url, created_by, created_at, updated_at';

function normaliseExerciseInput(input: ExerciseInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error('Exercise name is required.');
  }

  return {
    name,
    description: input.description?.trim() || null,
    muscle_group: input.muscle_group?.trim() || null,
    category: input.category?.trim() || null,
    equipment: (input.equipment ?? [])
      .map((item) => item.trim())
      .filter(Boolean),
    instructions: input.instructions?.trim() || null,
    image_url: input.image_url?.trim() || null,
    video_url: input.video_url?.trim() || null,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      '[Exercise Library] Unable to verify user:',
      error,
    );

    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user.id;
}

function handleExerciseError(
  action: string,
  error: { message: string },
): never {
  console.error(
    `[Exercise Library] Unable to ${action}:`,
    error,
  );

  throw new Error(
    `Unable to ${action}: ${error.message}`,
  );
}

/**
 * Retrieves exercises visible to the signed-in trainer.
 *
 * Supabase RLS determines whether shared and privately created
 * exercises are accessible.
 */
export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_COLUMNS)
    .order('name', { ascending: true });

  if (error) {
    handleExerciseError('load exercises', error);
  }

  return (data ?? []) as Exercise[];
}

/**
 * Creates a private exercise through the trainer-authorised RPC.
 */
export async function createExercise(
  input: ExerciseInput,
): Promise<Exercise> {
  await getAuthenticatedUserId();

  const exercise = normaliseExerciseInput(input);

  const { data, error } = await supabase.rpc(
    'create_trainer_exercise',
    {
      p_name: exercise.name,
      p_description: exercise.description,
      p_muscle_group: exercise.muscle_group,
      p_category: exercise.category,
      p_equipment: exercise.equipment,
      p_instructions: exercise.instructions,
      p_image_url: exercise.image_url,
      p_video_url: exercise.video_url,
    },
  );

  if (error) {
    handleExerciseError('create exercise', error);
  }

  if (!data) {
    throw new Error(
      'The exercise was not created. Please try again.',
    );
  }

  return data as Exercise;
}

/**
 * Updates a trainer-owned private exercise through the authorised RPC.
 */
export async function updateExercise(
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise> {
  if (!exerciseId?.trim()) {
    throw new Error('An exercise ID is required.');
  }

  const userId = await getAuthenticatedUserId();
  const exercise = normaliseExerciseInput(input);

  const { data, error } = await supabase.rpc(
    'update_trainer_exercise',
    {
      p_exercise_id: exerciseId,
      p_name: exercise.name,
      p_description: exercise.description,
      p_muscle_group: exercise.muscle_group,
      p_category: exercise.category,
      p_equipment: exercise.equipment,
      p_instructions: exercise.instructions,
      p_image_url: exercise.image_url,
      p_video_url: exercise.video_url,
    },
  );

  if (error) {
    handleExerciseError('update exercise', error);
  }

  if (!data) {
    throw new Error(
      'The exercise could not be updated. It may have been removed or you may not have permission.',
    );
  }

  const updatedExercise = data as Exercise;

  // Additional client-side ownership verification.
  // The database RPC must enforce this independently.
  if (updatedExercise.created_by !== userId) {
    throw new Error(
      'You do not have permission to update this exercise.',
    );
  }

  return updatedExercise;
}

/**
 * Deletes a trainer-owned private exercise through the authorised RPC.
 */
export async function deleteExercise(
  exerciseId: string,
): Promise<void> {
  if (!exerciseId?.trim()) {
    throw new Error('An exercise ID is required.');
  }

  await getAuthenticatedUserId();

  const { error } = await supabase.rpc(
    'delete_trainer_exercise',
    {
      p_exercise_id: exerciseId,
    },
  );

  if (error) {
    handleExerciseError('delete exercise', error);
  }
}
