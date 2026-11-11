BEGIN;

CREATE TABLE IF NOT EXISTS public.trainer_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE
    REFERENCES public.trainer_bookings(id) ON DELETE RESTRICT,
  trainer_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  gym_goer_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  session_summary TEXT NOT NULL
    CHECK (char_length(trim(session_summary)) > 0),
  observations TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_session_notes_trainer_client
  ON public.trainer_session_notes (trainer_id, gym_goer_id, created_at DESC);

ALTER TABLE public.trainer_session_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trainer_session_notes FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.trainer_session_notes TO authenticated;

GRANT UPDATE (
  session_summary,
  observations,
  recommendations,
  updated_at
)
ON TABLE public.trainer_session_notes
TO authenticated;

DROP POLICY IF EXISTS "Trainers read their own session notes"
  ON public.trainer_session_notes;

DROP POLICY IF EXISTS "Trainers create notes for completed sessions"
  ON public.trainer_session_notes;

DROP POLICY IF EXISTS "Trainers update their own session notes"
  ON public.trainer_session_notes;

CREATE POLICY "Trainers read their own session notes"
ON public.trainer_session_notes
FOR SELECT
TO authenticated
USING (
  trainer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )
  AND EXISTS (
    SELECT 1
    FROM public.trainer_bookings AS booking
    WHERE booking.id = trainer_session_notes.booking_id
      AND booking.trainer_id = (SELECT auth.uid())
      AND booking.gym_goer_id = trainer_session_notes.gym_goer_id
  )
);

CREATE POLICY "Trainers create notes for completed sessions"
ON public.trainer_session_notes
FOR INSERT
TO authenticated
WITH CHECK (
  trainer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )
  AND EXISTS (
    SELECT 1
    FROM public.trainer_bookings AS booking
    WHERE booking.id = trainer_session_notes.booking_id
      AND booking.trainer_id = (SELECT auth.uid())
      AND booking.gym_goer_id = trainer_session_notes.gym_goer_id
      AND booking.status = 'completed'
  )
);

CREATE POLICY "Trainers update their own session notes"
ON public.trainer_session_notes
FOR UPDATE
TO authenticated
USING (
  trainer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )
  AND EXISTS (
    SELECT 1
    FROM public.trainer_bookings AS booking
    WHERE booking.id = trainer_session_notes.booking_id
      AND booking.trainer_id = (SELECT auth.uid())
      AND booking.gym_goer_id = trainer_session_notes.gym_goer_id
      AND booking.status = 'completed'
  )
)
WITH CHECK (
  trainer_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )
  AND EXISTS (
    SELECT 1
    FROM public.trainer_bookings AS booking
    WHERE booking.id = trainer_session_notes.booking_id
      AND booking.trainer_id = (SELECT auth.uid())
      AND booking.gym_goer_id = trainer_session_notes.gym_goer_id
      AND booking.status = 'completed'
  )
);

COMMIT;
