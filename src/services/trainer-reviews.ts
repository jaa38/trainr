import { supabase } from '@/lib/supabase';

export type TrainerProfileExtras = {
  training_formats: string[];
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  average_rating: number;
  review_count: number;
};

export type TrainerReview = {
  id: string;
  trainer_id: string;
  gym_goer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

export async function getTrainerProfileExtras(
  trainerId: string,
): Promise<TrainerProfileExtras | null> {
  const { data, error } = await supabase.rpc('get_trainer_profile_extras', {
    p_trainer_id: trainerId,
  });

  if (error) {
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
    .select('id, trainer_id, gym_goer_id, rating, review_text, created_at')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
