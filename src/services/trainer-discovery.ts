import { supabase } from '@/lib/supabase';
import { getProfileImageUrl } from '@/services/profile-images';

export type TrainerAvailability = {
  days?: string[];
  schedule?: Record<
    string,
    | {
        start: string;
        end: string;
      }
    | undefined
  >;
};

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
  availability?: TrainerAvailability | null;
  timezone?: string | null;
};

type TrainerAvailabilityRow = {
  user_id: string;
  availability: TrainerAvailability | null;
  timezone: string | null;
};

export async function discoverPublishedTrainers(): Promise<PublishedTrainer[]> {
  const { data, error } = await supabase.rpc('discover_published_trainers');

  if (error) {
    throw new Error(`Unable to discover trainers: ${error.message}`);
  }

  const trainers = (data ?? []) as PublishedTrainer[];

  if (trainers.length === 0) {
    return [];
  }

  const trainerIds = trainers.map((trainer) => trainer.trainer_id);

  const { data: availabilityRows, error: availabilityError } = await supabase
    .from('trainer_profiles')
    .select('user_id, availability, timezone')
    .in('user_id', trainerIds);

  if (availabilityError) {
    throw new Error(`Unable to load trainer availability: ${availabilityError.message}`);
  }

  const availabilityByTrainerId = new Map(
    ((availabilityRows ?? []) as TrainerAvailabilityRow[]).map((row) => [
      row.user_id,
      {
        availability: row.availability,
        timezone: row.timezone,
      },
    ]),
  );

  const trainersWithAvailability = trainers.map((trainer) => {
    const trainerAvailability = availabilityByTrainerId.get(trainer.trainer_id);

    return {
      ...trainer,
      availability: trainerAvailability?.availability ?? null,
      timezone: trainerAvailability?.timezone ?? null,
    };
  });

  return Promise.all(
    trainersWithAvailability.map(async (trainer) => {
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
