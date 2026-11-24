import { supabase } from "@/lib/supabase";

import type {
  TrainerSessionCurrency,
  TrainerSessionDuration,
  TrainerSessionRateFormValues,
  TrainerSessionStatus,
  TrainerSessionType,
  TrainerTrainingFormat,
} from "@/schemas/trainer-session-rates";

const TABLE_NAME = "trainer_session_rates";

export type TrainerSessionRate = {
  id: string;
  trainer_id: string;
  session_type: TrainerSessionType | null;
  session_duration_minutes: TrainerSessionDuration;
  session_rate: number;
  currency: TrainerSessionCurrency;
  training_format: TrainerTrainingFormat | null;
  status: TrainerSessionStatus;
  is_default: boolean;
  requires_confirmation: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function toInsertDatabaseValues(values: TrainerSessionRateFormValues) {
  return {
    session_type: values.sessionType,
    session_duration_minutes: values.sessionDurationMinutes,
    session_rate: values.sessionRate,
    currency: values.currency,
    training_format: values.trainingFormat,
    status: values.status,
    sort_order: 0,
  };
}

function toUpdateDatabaseValues(values: TrainerSessionRateFormValues) {
  return {
    session_type: values.sessionType,
    session_duration_minutes: values.sessionDurationMinutes,
    session_rate: values.sessionRate,
    currency: values.currency,
    training_format: values.trainingFormat,
    status: values.status,
    requires_confirmation: false,
  };
}

/**
 * Retrieve all session rates belonging to a trainer.
 *
 * Legacy records are included so the trainer can confirm
 * their missing session type and training format.
 */
export async function getTrainerSessionRates(
  trainerId: string,
): Promise<TrainerSessionRate[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("trainer_id", trainerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as TrainerSessionRate[];
}

/**
 * Create a new session rate.
 *
 * New rates are confirmed because all required fields
 * are supplied through the validated form.
 */
export async function createTrainerSessionRate(
  trainerId: string,
  values: TrainerSessionRateFormValues,
  makeDefault = false,
): Promise<TrainerSessionRate> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      trainer_id: trainerId,
      ...toInsertDatabaseValues(values),
    })
    .select("*")
    .single();

  if (error) throw error;

  let createdRate = data as TrainerSessionRate;

  if (makeDefault) {
    await setTrainerSessionRateDefault(trainerId, createdRate.id);

    createdRate = await getTrainerSessionRateById(trainerId, createdRate.id);
  }

  return createdRate;
}

/**
 * Update an existing session rate.
 *
 * This also confirms legacy records by supplying the
 * previously missing session type and training format.
 */
export async function updateTrainerSessionRate(
  trainerId: string,
  rateId: string,
  values: TrainerSessionRateFormValues,
): Promise<TrainerSessionRate> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toUpdateDatabaseValues(values))
    .eq("id", rateId)
    .eq("trainer_id", trainerId)
    .select("*")
    .single();

  if (error) throw error;

  return data as TrainerSessionRate;
}

/**
 * Delete a session rate.
 *
 * The database trigger synchronises the legacy pricing
 * table if the deleted record was the active default.
 */
export async function deleteTrainerSessionRate(
  trainerId: string,
  rateId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("id", rateId)
    .eq("trainer_id", trainerId);

  if (error) throw error;
}

/**
 * Set a confirmed, active session rate as the default.
 *
 * Uses the database RPC rather than directly updating
 * is_default, preserving the database ownership checks.
 */
export async function setTrainerSessionRateDefault(
  trainerId: string,
  rateId: string,
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user || userData.user.id !== trainerId) {
    throw new Error("You can only manage your own session rates.");
  }

  const { error } = await supabase.rpc("set_trainer_session_rate_default", {
    p_rate_id: rateId,
  });

  if (error) throw error;
}

/**
 * Retrieve one session rate after a mutation.
 */
export async function getTrainerSessionRateById(
  trainerId: string,
  rateId: string,
): Promise<TrainerSessionRate> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", rateId)
    .eq("trainer_id", trainerId)
    .single();

  if (error) throw error;

  return data as TrainerSessionRate;
}
