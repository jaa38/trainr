import { supabase } from '@/lib/supabase';
import type { GymGoerDetailsFormValues } from '@/schemas/gym-goer-onboarding';

export type GymGoerPersonalInformation = {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  avatar_url: string | null;
};

/**
 * Load the authenticated gym-goer's personal information.
 */
export async function getGymGoerPersonalInformation(
  userId: string,
): Promise<GymGoerPersonalInformation> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, date_of_birth, phone, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Update personal information without modifying account or onboarding state.
 */
export async function updateGymGoerPersonalInformation(
  userId: string,
  values: GymGoerDetailsFormValues,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      date_of_birth: values.dateOfBirth,
      phone: values.phone.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}
