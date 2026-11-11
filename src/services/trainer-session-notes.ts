import { supabase } from '@/lib/supabase';

export type TrainerSessionNote = {
  id: string;
  booking_id: string;
  trainer_id: string;
  gym_goer_id: string;
  session_summary: string;
  observations: string | null;
  recommendations: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTrainerSessionNoteInput = {
  bookingId: string;
  gymGoerId: string;
  sessionSummary: string;
  observations?: string | null;
  recommendations?: string | null;
};

export type UpdateTrainerSessionNoteInput = {
  sessionSummary: string;
  observations?: string | null;
  recommendations?: string | null;
};

const SESSION_NOTE_COLUMNS = `
  id,
  booking_id,
  trainer_id,
  gym_goer_id,
  session_summary,
  observations,
  recommendations,
  created_at,
  updated_at
`;

async function getAuthenticatedTrainer() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Trainer Session Notes] Unable to verify user:', error);
    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

function validateSessionSummary(value: string) {
  if (!value?.trim()) {
    throw new Error('Session summary cannot be empty.');
  }
}

/**
 * Retrieves session notes for a client.
 * RLS restricts access to the authenticated trainer's own notes.
 */
export async function getTrainerSessionNotes(
  gymGoerId: string,
): Promise<TrainerSessionNote[]> {
  if (!gymGoerId?.trim()) {
    throw new Error('A valid client is required.');
  }

  const trainer = await getAuthenticatedTrainer();

  const { data, error } = await supabase
    .from('trainer_session_notes')
    .select(SESSION_NOTE_COLUMNS)
    .eq('trainer_id', trainer.id)
    .eq('gym_goer_id', gymGoerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Trainer Session Notes] Unable to load notes:', error);
    throw new Error('Unable to load session notes. Please try again.');
  }

  return (data ?? []) as unknown as TrainerSessionNote[];
}

/**
 * Retrieves session notes for one booking.
 */
export async function getTrainerSessionNote(
  bookingId: string,
): Promise<TrainerSessionNote | null> {
  if (!bookingId?.trim()) {
    throw new Error('A valid booking ID is required.');
  }

  const trainer = await getAuthenticatedTrainer();

  const { data, error } = await supabase
    .from('trainer_session_notes')
    .select(SESSION_NOTE_COLUMNS)
    .eq('booking_id', bookingId)
    .eq('trainer_id', trainer.id)
    .maybeSingle();

  if (error) {
    console.error('[Trainer Session Notes] Unable to load note:', error);
    throw new Error('Unable to load session notes. Please try again.');
  }

  return data as unknown as TrainerSessionNote | null;
}

/**
 * Creates notes only for a completed booking owned by the trainer.
 * The database independently enforces the same ownership and status rules.
 */
export async function createTrainerSessionNote(
  input: CreateTrainerSessionNoteInput,
): Promise<TrainerSessionNote> {
  if (!input.bookingId?.trim()) {
    throw new Error('A valid booking ID is required.');
  }

  if (!input.gymGoerId?.trim()) {
    throw new Error('A valid client is required.');
  }

  validateSessionSummary(input.sessionSummary);

  const trainer = await getAuthenticatedTrainer();

  const { data: booking, error: bookingError } = await supabase
    .from('trainer_bookings')
    .select('id, trainer_id, gym_goer_id, status')
    .eq('id', input.bookingId)
    .eq('trainer_id', trainer.id)
    .eq('gym_goer_id', input.gymGoerId)
    .maybeSingle();

  if (bookingError) {
    console.error(
      '[Trainer Session Notes] Unable to verify booking:',
      bookingError,
    );
    throw new Error('Unable to verify this session. Please try again.');
  }

  if (!booking) {
    throw new Error('Session not found or you are not authorised to access it.');
  }

  if (booking.status !== 'completed') {
    throw new Error('Session notes can only be created for completed sessions.');
  }

  const { data, error } = await supabase
    .from('trainer_session_notes')
    .insert({
      booking_id: booking.id,
      trainer_id: trainer.id,
      gym_goer_id: input.gymGoerId,
      session_summary: input.sessionSummary.trim(),
      observations: input.observations?.trim() || null,
      recommendations: input.recommendations?.trim() || null,
    })
    .select(SESSION_NOTE_COLUMNS)
    .single();

  if (error) {
    console.error('[Trainer Session Notes] Unable to create note:', error);
    throw new Error('Unable to save session notes. Please try again.');
  }

  return data as unknown as TrainerSessionNote;
}

/**
 * Updates notes written by the authenticated trainer.
 * Ownership fields cannot be changed through this operation.
 */
export async function updateTrainerSessionNote(
  noteId: string,
  input: UpdateTrainerSessionNoteInput,
): Promise<TrainerSessionNote> {
  if (!noteId?.trim()) {
    throw new Error('A valid session note ID is required.');
  }

  validateSessionSummary(input.sessionSummary);

  const trainer = await getAuthenticatedTrainer();

  const { data, error } = await supabase
    .from('trainer_session_notes')
    .update({
      session_summary: input.sessionSummary.trim(),
      observations: input.observations?.trim() || null,
      recommendations: input.recommendations?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .eq('trainer_id', trainer.id)
    .select(SESSION_NOTE_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[Trainer Session Notes] Unable to update note:', error);
    throw new Error('Unable to update session notes. Please try again.');
  }

  if (!data) {
    throw new Error('Session note not found or you are not authorised to edit it.');
  }

  return data as unknown as TrainerSessionNote;
}
