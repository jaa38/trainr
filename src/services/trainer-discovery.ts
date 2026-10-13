import { supabase } from '@/lib/supabase';

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

  return (data ?? []) as PublishedTrainer[];
}
