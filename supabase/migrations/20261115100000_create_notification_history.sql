BEGIN;

-- ============================================================
-- 1. USER-FACING NOTIFICATION HISTORY
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  outbox_id UUID UNIQUE
    REFERENCES public.notification_outbox(id)
    ON DELETE SET NULL,

  user_id UUID NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'booking_requested',
      'booking_confirmed',
      'booking_declined',
      'booking_cancelled',
      'booking_reschedule_requested',
      'payment_succeeded',
      'payment_failed',
      'session_reminder',
      'session_completed',
      'workout_assigned',
      'trainer_feedback_created',
      'post_session_followup'
    )
  ),

  title TEXT NOT NULL,
  body TEXT NOT NULL,

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT notifications_read_state_check
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR
      (is_read = TRUE AND read_at IS NOT NULL)
    )
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX notifications_entity_idx
  ON public.notifications (entity_type, entity_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own notification read status"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- 4. TABLE PRIVILEGES
-- ============================================================

REVOKE ALL ON TABLE public.notifications
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.notifications
  TO authenticated;

GRANT UPDATE (is_read, read_at)
  ON TABLE public.notifications
  TO authenticated;

GRANT ALL ON TABLE public.notifications
  TO service_role;

COMMIT;
