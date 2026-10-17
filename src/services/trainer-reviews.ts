import { supabase } from '@/lib/supabase';

export type TrainerProfileExtras = {
  training_formats: string[];
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  average_rating: number;
  review_count: number;
};

export type TrainerReview = {
  id: string;
  booking_id: string;
  trainer_id: string;
  gym_goer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

export type ReviewableBooking = {
  id: string;
  trainer_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: 'completed';
};

export type SubmitTrainerReviewInput = {
  bookingId: string;
  trainerId: string;
  rating: number;
  reviewText?: string;
};

export async function getTrainerProfileExtras(
  trainerId: string,
): Promise<TrainerProfileExtras | null> {
  const { data, error } = await supabase.rpc('get_trainer_profile_extras', {
    p_trainer_id: trainerId,
  });

  if (error) {
    console.error('[Trainer Reviews] Unable to load profile extras:', error);
    throw error;
  }

  const row = data?.[0];

  if (!row) {
    return null;
  }

  return {
    training_formats: row.training_formats ?? [],
    verification_status: row.verification_status,
    average_rating: Number(row.average_rating ?? 0),
    review_count: Number(row.review_count ?? 0),
  };
}

export async function getTrainerReviews(trainerId: string): Promise<TrainerReview[]> {
  const { data, error } = await supabase
    .from('trainer_reviews')
    .select('id, booking_id, trainer_id, gym_goer_id, rating, review_text, created_at')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Trainer Reviews] Unable to load reviews:', error);
    throw error;
  }

  return (data ?? []) as TrainerReview[];
}

/**
 * Returns completed bookings belonging to the signed-in gym-goer
 * that do not already have a review.
 *
 * Supabase RLS must allow the user to read their own bookings and reviews.
 */
export async function getReviewableBookings(
  trainerId?: string,
): Promise<ReviewableBooking[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[Trainer Reviews] Unable to verify user:', authError);
    throw authError;
  }

  if (!user) {
    throw new Error('Please sign in to review a trainer.');
  }

  let bookingsQuery = supabase
    .from('trainer_bookings')
    .select('id, trainer_id, scheduled_start, scheduled_end, status')
    .eq('gym_goer_id', user.id)
    .eq('status', 'completed')
    .order('scheduled_start', { ascending: false });

  if (trainerId) {
    bookingsQuery = bookingsQuery.eq('trainer_id', trainerId);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    console.error('[Trainer Reviews] Unable to load completed bookings:', bookingsError);
    throw bookingsError;
  }

  if (!bookings?.length) {
    return [];
  }

  const bookingIds = bookings.map((booking) => booking.id);

  const { data: existingReviews, error: reviewsError } = await supabase
    .from('trainer_reviews')
    .select('booking_id')
    .eq('gym_goer_id', user.id)
    .in('booking_id', bookingIds);

  if (reviewsError) {
    console.error('[Trainer Reviews] Unable to check existing reviews:', reviewsError);
    throw reviewsError;
  }

  const reviewedBookingIds = new Set(
    (existingReviews ?? []).map((review) => review.booking_id),
  );

  return bookings.filter(
    (booking) => !reviewedBookingIds.has(booking.id),
  ) as ReviewableBooking[];
}

/**
 * Submits a review for a completed booking.
 *
 * The database RLS policy is authoritative: client-side validation
 * cannot bypass the completed-booking requirement.
 */
export async function submitTrainerReview({
  bookingId,
  trainerId,
  rating,
  reviewText,
}: SubmitTrainerReviewInput): Promise<TrainerReview> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[Trainer Reviews] Unable to verify user:', authError);
    throw authError;
  }

  if (!user) {
    throw new Error('Please sign in before submitting a review.');
  }

  if (!bookingId || !trainerId) {
    throw new Error('A booking and trainer are required.');
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating between 1 and 5 stars.');
  }

  const trimmedReview = reviewText?.trim() ?? '';

  if (trimmedReview.length > 2000) {
    throw new Error('Your review must be 2,000 characters or fewer.');
  }

  const { data, error } = await supabase
    .from('trainer_reviews')
    .insert({
      booking_id: bookingId,
      trainer_id: trainerId,
      gym_goer_id: user.id,
      rating,
      review_text: trimmedReview || null,
    })
    .select('id, booking_id, trainer_id, gym_goer_id, rating, review_text, created_at')
    .single();

  if (error) {
    console.error('[Trainer Reviews] Unable to submit review:', error);

    if (error.code === '23505') {
      throw new Error('You have already reviewed this booking.');
    }

    if (error.code === '42501') {
      throw new Error('You can only review a completed booking that belongs to you.');
    }

    throw error;
  }

  return data as TrainerReview;
}
