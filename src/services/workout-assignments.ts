
import { supabase } from '@/lib/supabase';

export type WorkoutAssignmentStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'revoked';


export type WorkoutAssignment = {
  id: string;
  workout_plan_id: string;
  trainer_id: string;
  gym_goer_id: string;
  booking_id: string;
  payment_id: string;
  plan_version: number;
  plan_snapshot: Record<string, unknown>;
  snapshot_history: Record<string, unknown>;
  status: string;
  assigned_at: string;
  last_updated_at: string;
  completed_at: string | null;
};


export type AssignWorkoutPlanInput = {
  workoutPlanId: string;
  gymGoerId: string;
  bookingId: string;
  paymentId: string;
};

export type AssignWorkoutPlanResult = {
  assignment_id: string;
  gym_goer_id: string;
  booking_id: string;
  payment_id: string;
  plan_version: number;
  assignment_status: string;
};

/**
 * Retrieves workout programme assignments for one client.
 * Access is restricted by the database RLS policies.
 */
export async function getClientWorkoutAssignments(
  gymGoerId: string,
): Promise<WorkoutAssignment[]> {
  if (!gymGoerId) {
    throw new Error('A client ID is required.');
  }

  const { data, error } = await supabase
    .from('assigned_workout_plans')
    .select('*')
    .eq('gym_goer_id', gymGoerId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error('[Workout Assignments] Unable to load assignments:', error);
    throw new Error(`Unable to load client programmes: ${error.message}`);
  }

  return (data ?? []) as WorkoutAssignment[];
}

/**
 * Assigns a published workout programme to one client
 * using a specific eligible booking and successful payment.
 *
 * The backend RPC performs the authoritative eligibility checks.
 */
export async function assignWorkoutPlan(
  input: AssignWorkoutPlanInput,
): Promise<AssignWorkoutPlanResult> {
  if (!input.workoutPlanId) {
    throw new Error('A workout programme is required.');
  }

  if (!input.gymGoerId) {
    throw new Error('A client is required.');
  }

  if (!input.bookingId) {
    throw new Error('A booking is required.');
  }

  if (!input.paymentId) {
    throw new Error('A successful payment is required.');
  }

  const { data, error } = await supabase.rpc('assign_workout_plan', {
    p_workout_plan_id: input.workoutPlanId,
    p_gym_goer_id: input.gymGoerId,
    p_booking_id: input.bookingId,
    p_payment_id: input.paymentId,
  });

  if (error) {
    console.error('[Workout Assignments] Unable to assign programme:', error);
    throw new Error(`Unable to assign workout programme: ${error.message}`);
  }

const result = Array.isArray(data) ? data[0] : data;

  if (!result?.assignment_id) {
    throw new Error('The assignment was not created successfully.');
  }

  return result as AssignWorkoutPlanResult;
}
