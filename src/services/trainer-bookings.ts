import { supabase } from '@/lib/supabase';

export type TrainerBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'completed';

export type TrainerBookingTransitionStatus =
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'completed';

/**
 * Updates a trainer's booking status.
 *
 * The trainer ID and expected current status are included in the
 * update query to prevent modifying another trainer's booking or
 * overwriting a booking that has already changed.
 *
 * Database triggers remain responsible for enforcing valid transitions.
 *
 * @returns The updated booking ID, or null if no row matched.
 */
export async function updateTrainerBookingStatus(
  bookingId: string,
  trainerId: string,
  currentStatus: TrainerBookingStatus,
  nextStatus: TrainerBookingTransitionStatus,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('trainer_bookings')
    .update({ status: nextStatus })
    .eq('id', bookingId)
    .eq('trainer_id', trainerId)
    .eq('status', currentStatus)
    .select('id');

  if (error) {
    throw error;
  }

  return data?.[0]?.id ?? null;
}
