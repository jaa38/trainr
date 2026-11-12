BEGIN;

-- =========================================================
-- 1. DEVICE PUSH TOKENS
-- =========================================================

CREATE TABLE public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  expo_push_token TEXT NOT NULL UNIQUE,

  platform TEXT NOT NULL
    CHECK (platform IN ('ios', 'android')),

  device_id TEXT,
  device_name TEXT,
  timezone TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,

  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_push_tokens_token_not_empty
    CHECK (char_length(trim(expo_push_token)) > 0)
);

CREATE INDEX idx_device_push_tokens_user_active
  ON public.device_push_tokens (user_id, is_active);

CREATE INDEX idx_device_push_tokens_active
  ON public.device_push_tokens (is_active)
  WHERE is_active = true;


-- =========================================================
-- 2. NOTIFICATION PREFERENCES
-- =========================================================

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  booking_updates BOOLEAN NOT NULL DEFAULT true,
  session_reminders BOOLEAN NOT NULL DEFAULT true,
  workout_updates BOOLEAN NOT NULL DEFAULT true,
  feedback_updates BOOLEAN NOT NULL DEFAULT true,
  post_session_followups BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================
-- 3. NOTIFICATION OUTBOX
-- =========================================================

CREATE TABLE public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'booking_requested',
        'booking_confirmed',
        'booking_declined',
        'booking_cancelled',
        'booking_reschedule_requested',
        'session_reminder',
        'session_completed',
        'workout_assigned',
        'trainer_feedback_created',
        'post_session_followup'
      )
    ),

  recipient_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL
    CHECK (
      entity_type IN (
        'booking',
        'workout_assignment',
        'trainer_feedback'
      )
    ),

  entity_id UUID NOT NULL,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object'),

  idempotency_key TEXT NOT NULL UNIQUE,

  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'processing',
        'sent',
        'failed',
        'cancelled'
      )
    ),

  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

  max_attempts INTEGER NOT NULL DEFAULT 5
    CHECK (max_attempts > 0),

  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  locked_at TIMESTAMPTZ,
  locked_by TEXT,

  sent_at TIMESTAMPTZ,
  expo_ticket_id TEXT,

  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notification_outbox_idempotency_not_empty
    CHECK (char_length(trim(idempotency_key)) > 0),

  CONSTRAINT notification_outbox_lock_consistency
    CHECK (
      (status = 'processing' AND locked_at IS NOT NULL)
      OR
      (status <> 'processing' AND locked_at IS NULL)
    )
);

CREATE INDEX idx_notification_outbox_pending_due
  ON public.notification_outbox (
    scheduled_for,
    next_attempt_at,
    created_at
  )
  WHERE status = 'pending';

CREATE INDEX idx_notification_outbox_recipient
  ON public.notification_outbox (
    recipient_id,
    created_at DESC
  );

CREATE INDEX idx_notification_outbox_processing_lock
  ON public.notification_outbox (locked_at)
  WHERE status = 'processing';


-- =========================================================
-- 4. ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE public.device_push_tokens
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_preferences
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_outbox
  ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 5. DEVICE TOKEN PRIVILEGES
-- Clients cannot modify ownership or backend delivery errors.
-- =========================================================

REVOKE ALL ON TABLE public.device_push_tokens
  FROM PUBLIC, anon, authenticated;

GRANT DELETE
  ON TABLE public.device_push_tokens
  TO authenticated;

GRANT SELECT (
  id,
  user_id,
  expo_push_token,
  platform,
  device_id,
  device_name,
  timezone,
  is_active,
  last_seen_at,
  created_at,
  updated_at
)
ON TABLE public.device_push_tokens
TO authenticated;

GRANT INSERT (
  user_id,
  expo_push_token,
  platform,
  device_id,
  device_name,
  timezone
)
ON TABLE public.device_push_tokens
TO authenticated;

GRANT UPDATE (
  expo_push_token,
  platform,
  device_id,
  device_name,
  timezone,
  is_active,
  last_seen_at,
  updated_at
)
ON TABLE public.device_push_tokens
TO authenticated;

CREATE POLICY "Users read their own push tokens"
ON public.device_push_tokens
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users register their own push tokens"
ON public.device_push_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.role IN ('trainer', 'gym_goer')
  )
);

CREATE POLICY "Users update their own push tokens"
ON public.device_push_tokens
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users remove their own push tokens"
ON public.device_push_tokens
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- =========================================================
-- 6. NOTIFICATION PREFERENCE PRIVILEGES
-- =========================================================

REVOKE ALL ON TABLE public.notification_preferences
  FROM PUBLIC, anon, authenticated;

GRANT SELECT
  ON TABLE public.notification_preferences
  TO authenticated;

GRANT INSERT (
  user_id,
  booking_updates,
  session_reminders,
  workout_updates,
  feedback_updates,
  post_session_followups
)
ON TABLE public.notification_preferences
TO authenticated;

GRANT UPDATE (
  booking_updates,
  session_reminders,
  workout_updates,
  feedback_updates,
  post_session_followups
)
ON TABLE public.notification_preferences
TO authenticated;

CREATE POLICY "Users read their own notification preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users create their own notification preferences"
ON public.notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.role IN ('trainer', 'gym_goer')
  )
);

CREATE POLICY "Users update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));


-- =========================================================
-- 7. NOTIFICATION OUTBOX PRIVILEGES
-- =========================================================

REVOKE ALL ON TABLE public.notification_outbox
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.notification_outbox
  TO service_role;


-- =========================================================
-- 8. AUTOMATIC UPDATED_AT MAINTENANCE
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_notification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_device_push_tokens_updated_at
BEFORE UPDATE ON public.device_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_updated_at();

CREATE TRIGGER set_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_updated_at();

CREATE TRIGGER set_notification_outbox_updated_at
BEFORE UPDATE ON public.notification_outbox
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_updated_at();

COMMIT;
