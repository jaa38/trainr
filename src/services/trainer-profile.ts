import { supabase } from '@/lib/supabase';

export type TrainerProfessionalProfile = {
  professional_title: string | null;
  professional_bio: string | null;
  coaching_approach: string | null;
  location: string | null;
  years_experience: number | null;
  training_formats: string[];
};

export type TrainerTrainingFormat = 'Online' | 'In-person' | 'Both';

/**
 * Supported trainer specialities.
 * Keep these values consistent with trainer onboarding and discovery.
 */
export const TRAINER_SPECIALITY_OPTIONS = [
  'Strength training',
  'Weight loss',
  'Muscle building',
  'General fitness',
  'Functional training',
  'Sports performance',
  'Mobility and flexibility',
  'Nutrition coaching',
] as const;

export type TrainerSpeciality = (typeof TRAINER_SPECIALITY_OPTIONS)[number];

/**
 * Verify that the authenticated user owns the trainer profile.
 */
async function assertTrainerOwnership(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user || data.user.id !== userId) {
    throw new Error('You can only manage your own trainer profile.');
  }
}

/**
 * Retrieve a trainer's professional profile.
 */
export async function getTrainerProfessionalProfile(
  userId: string,
): Promise<TrainerProfessionalProfile | null> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select(
      'professional_title, professional_bio, coaching_approach, location, years_experience, training_formats',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Convert stored training formats into the profile form value.
 */
export function getTrainerTrainingFormat(
  formats: string[] | null | undefined,
): TrainerTrainingFormat | '' {
  const values = formats ?? [];

  if (
    values.includes('Both') ||
    (values.includes('Online') && values.includes('In-person'))
  ) {
    return 'Both';
  }

  if (values.includes('Online')) {
    return 'Online';
  }

  if (values.includes('In-person')) {
    return 'In-person';
  }

  return '';
}

/**
 * Convert the selected training format into database values.
 */
export function toTrainerTrainingFormats(format: TrainerTrainingFormat | ''): string[] {
  if (format === 'Both') {
    return ['Online', 'In-person'];
  }

  return format ? [format] : [];
}

/**
 * Update a trainer's professional profile.
 */
export async function updateTrainerProfessionalProfile(
  userId: string,
  values: {
    professional_title: string;
    professional_bio: string;
    coaching_approach: string;
    location: string;
    years_experience: number | null;
    training_formats: string[];
  },
): Promise<void> {
  const { error } = await supabase.from('trainer_profiles').upsert(
    {
      user_id: userId,
      professional_title: values.professional_title,
      professional_bio: values.professional_bio,
      coaching_approach: values.coaching_approach,
      location: values.location,
      years_experience: values.years_experience,
      training_formats: values.training_formats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}

/**
 * Retrieve the authenticated trainer's saved specialities.
 */
export async function getTrainerSpecialities(userId: string): Promise<string[]> {
  await assertTrainerOwnership(userId);

  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('specialities')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.specialities ?? [];
}

/**
 * Validate and save a trainer's selected specialities.
 */
export async function updateTrainerSpecialities(
  userId: string,
  specialities: string[],
): Promise<void> {
  await assertTrainerOwnership(userId);

  const uniqueSpecialities = Array.from(new Set(specialities));

  if (uniqueSpecialities.length === 0) {
    throw new Error('Select at least one speciality.');
  }

  const invalidSpecialities = uniqueSpecialities.filter(
    (speciality) => !TRAINER_SPECIALITY_OPTIONS.includes(speciality as TrainerSpeciality),
  );

  if (invalidSpecialities.length > 0) {
    throw new Error('One or more selected specialities are not supported.');
  }

  const { error } = await supabase.from('trainer_profiles').upsert(
    {
      user_id: userId,
      specialities: uniqueSpecialities,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}
