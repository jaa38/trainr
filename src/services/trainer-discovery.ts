import { supabase } from '@/lib/supabase';
import { getProfileImageUrl } from '@/services/profile-images';

export type PublishedTrainer = {
  trainer_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  professional_bio: string | null;
  qualifications: string[] | null;
  specialities: string[] | null;
  years_experience: number | null;
  location: string | null;
  coaching_approach: string | null;
  certifications: string[] | null;
  session_rate: number | null;
  currency: string | null;
  session_duration_minutes: number | null;
};

export async function discoverPublishedTrainers(): Promise<PublishedTrainer[]> {
  const { data, error } = await supabase.rpc('discover_published_trainers');

  if (error) {
    throw new Error(`Unable to discover trainers: ${error.message}`);
  }

  const trainers = (data ?? []) as PublishedTrainer[];

  return Promise.all(
    trainers.map(async (trainer) => {
      try {
        return {
          ...trainer,
          avatar_url: await getProfileImageUrl(trainer.avatar_url),
        };
      } catch (imageError) {
        console.warn(
          `[Trainer Discovery] Unable to load profile photo for ${trainer.trainer_id}:`,
          imageError,
        );

        // A missing photo should not prevent a trainer from appearing.
        return {
          ...trainer,
          avatar_url: null,
        };
      }
    }),
  );
}
