
import { supabase } from '@/lib/supabase';

export type TrainerFeedback = {
  id: string;
  trainer_id: string;
  gym_goer_id: string;
  assigned_workout_plan_id: string | null;
  workout_log_id: string | null;
  feedback: string;
  recommendations: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTrainerFeedbackInput = {
  gymGoerId: string;
  assignedWorkoutPlanId?: string | null;
  workoutLogId?: string | null;
  feedback: string;
  recommendations?: string | null;
};

export type UpdateTrainerFeedbackInput = {
  feedback: string;
  recommendations?: string | null;
};

const FEEDBACK_COLUMNS = `
  id,
  trainer_id,
  gym_goer_id,
  assigned_workout_plan_id,
  workout_log_id,
  feedback,
  recommendations,
  created_at,
  updated_at
`;

async function getAuthenticatedTrainer() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Trainer Feedback] Unable to verify user:', error);
    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

function validateFeedback(
  feedback: string,
  assignedWorkoutPlanId?: string | null,
  workoutLogId?: string | null,
) {
  if (!feedback?.trim()) {
    throw new Error('Feedback cannot be empty.');
  }

  if (!assignedWorkoutPlanId?.trim() && !workoutLogId?.trim()) {
    throw new Error('Feedback must reference a workout or programme.');
  }
}

/**
 * Retrieves feedback for a client.
 * Database RLS determines whether the authenticated user
 * can access the requested feedback.
 */
export async function getTrainerFeedback(
  gymGoerId: string,
): Promise<TrainerFeedback[]> {
  if (!gymGoerId?.trim()) {
    throw new Error('A valid client is required.');
  }

  await getAuthenticatedTrainer();

  const { data, error } = await supabase
    .from('trainer_feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('gym_goer_id', gymGoerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Trainer Feedback] Unable to load feedback:', error);
    throw new Error('Unable to load client feedback. Please try again.');
  }

  return (data ?? []) as unknown as TrainerFeedback[];
}

/**
 * Creates feedback for a client.
 * Trainer and referenced-record ownership are enforced by RLS.
 */
export async function createTrainerFeedback(
  input: CreateTrainerFeedbackInput,
): Promise<TrainerFeedback> {
  validateFeedback(
    input.feedback,
    input.assignedWorkoutPlanId,
    input.workoutLogId,
  );

  if (!input.gymGoerId?.trim()) {
    throw new Error('A valid client is required.');
  }

  const trainer = await getAuthenticatedTrainer();

  const { data, error } = await supabase
    .from('trainer_feedback')
    .insert({
      trainer_id: trainer.id,
      gym_goer_id: input.gymGoerId,
      assigned_workout_plan_id: input.assignedWorkoutPlanId?.trim() || null,
      workout_log_id: input.workoutLogId?.trim() || null,
      feedback: input.feedback.trim(),
      recommendations: input.recommendations?.trim() || null,
    })
    .select(FEEDBACK_COLUMNS)
    .single();

  if (error) {
    console.error('[Trainer Feedback] Unable to create feedback:', error);
    throw new Error('Unable to save feedback. Please try again.');
  }

  return data as unknown as TrainerFeedback;
}

/**
 * Updates feedback written by the authenticated trainer.
 * Ownership and editable columns are enforced by database permissions and RLS.
 */
export async function updateTrainerFeedback(
  feedbackId: string,
  input: UpdateTrainerFeedbackInput,
): Promise<TrainerFeedback> {
  if (!feedbackId?.trim()) {
    throw new Error('A valid feedback ID is required.');
  }

  if (!input.feedback?.trim()) {
    throw new Error('Feedback cannot be empty.');
  }

  const trainer = await getAuthenticatedTrainer();

  const updates: {
    feedback: string;
    recommendations?: string | null;
    updated_at: string;
  } = {
    feedback: input.feedback.trim(),
    updated_at: new Date().toISOString(),
  };

  if (input.recommendations !== undefined) {
    updates.recommendations = input.recommendations?.trim() || null;
  }

  const { data, error } = await supabase
    .from('trainer_feedback')
    .update(updates)
    .eq('id', feedbackId)
    .eq('trainer_id', trainer.id)
    .select(FEEDBACK_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Trainer Feedback] Unable to update feedback:', error);
    throw new Error('Unable to update feedback. Please try again.');
  }

  if (!data) {
    throw new Error('Feedback not found or you are not authorised to edit it.');
  }

  return data as unknown as TrainerFeedback;
}
