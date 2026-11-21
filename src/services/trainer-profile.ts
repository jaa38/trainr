import { supabase } from '@/lib/supabase';

export type TrainerProfessionalProfile = {
  professional_bio: string | null;
  coaching_approach: string | null;
  location: string | null;
  years_experience: number | null;
};

export async function getTrainerProfessionalProfile(
  userId: string,
): Promise<TrainerProfessionalProfile | null> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('professional_bio, coaching_approach, location, years_experience')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTrainerProfessionalProfile(
  userId: string,
  values: {
    professional_bio: string;
    coaching_approach: string;
    location: string;
    years_experience: number | null;
  },
): Promise<void> {
  const { error } = await supabase.from('trainer_profiles').upsert(
    {
      user_id: userId,
      professional_bio: values.professional_bio,
      coaching_approach: values.coaching_approach,
      location: values.location,
      years_experience: values.years_experience,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}
