
import { supabase } from "@/lib/supabase";
import { getProfileImageUrl } from "@/services/profile-images";

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

export type PublishedTrainerSessionRate = {
  id: string;
  session_type: "one_to_one" | "group_training" | "online_training";
  session_duration_minutes: 30 | 45 | 60 | 90;
  session_rate: number;
  currency: "NGN" | "GBP" | "USD" | "EUR";
  training_format: "online" | "in_person" | "both";
  is_default: boolean;
  sort_order: number;
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

  // Compatibility fields for screens that display one default rate.
  session_rate: number | null;
  currency: string | null;
  session_duration_minutes: number | null;

  // Complete rate list used by the booking flow.
  session_rates: PublishedTrainerSessionRate[];

  availability: TrainerAvailability | null;
  timezone: string | null;
};

type PublishedTrainerResponse = Omit<
  PublishedTrainer,
  | "session_rate"
  | "currency"
  | "session_duration_minutes"
  | "session_rates"
> & {
  session_rates: PublishedTrainerSessionRate[] | null;
};

export async function discoverPublishedTrainers(): Promise<
  PublishedTrainer[]
> {
  const { data, error } = await supabase.rpc(
    "discover_published_trainers_v3",
  );

  if (error) {
    throw new Error(
      `Unable to discover trainers: ${error.message}`,
    );
  }

  const trainers = (data ?? []) as PublishedTrainerResponse[];

  if (trainers.length === 0) {
    return [];
  }

  return Promise.all(
    trainers.map(async (trainer) => {
      const sessionRates = trainer.session_rates ?? [];

      // Only an explicitly marked default rate populates
      // the legacy single-rate compatibility fields.
      const defaultRate =
        sessionRates.find((rate) => rate.is_default) ?? null;

      let avatarUrl: string | null = null;

      try {
        avatarUrl = await getProfileImageUrl(trainer.avatar_url);
      } catch (imageError) {
        console.warn(
          `[Trainer Discovery] Unable to load profile photo for ${trainer.trainer_id}:`,
          imageError,
        );
      }

      return {
        ...trainer,
        avatar_url: avatarUrl,
        session_rates: sessionRates,
        session_rate: defaultRate?.session_rate ?? null,
        currency: defaultRate?.currency ?? null,
        session_duration_minutes:
          defaultRate?.session_duration_minutes ?? null,
      };
    }),
  );
}
