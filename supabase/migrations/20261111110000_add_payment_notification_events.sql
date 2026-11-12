BEGIN;

-- =========================================================
-- 1. EXTEND NOTIFICATION OUTBOX EVENT TYPES
-- =========================================================

ALTER TABLE public.notification_outbox
DROP CONSTRAINT notification_outbox_event_type_check;

ALTER TABLE public.notification_outbox
ADD CONSTRAINT notification_outbox_event_type_check
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
    'post_session_followup',
    'payment_succeeded',
    'payment_failed'
  )
);

-- =========================================================
-- 2. PAYMENT STATUS EVENT CAPTURE
-- =========================================================

CREATE OR REPLACE FUNCTION public.enqueue_payment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type TEXT;
  v_scheduled_for TIMESTAMPTZ;
BEGIN
  -- Only capture definitive transitions from pending.
  IF OLD.status IS DISTINCT FROM 'pending'
     OR NEW.status NOT IN ('successful', 'failed') THEN
    RETURN NEW;
  END IF;

  -- Do not enqueue notifications for already superseded attempts.
  IF NEW.superseded_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'successful' THEN
    v_event_type := 'payment_succeeded';
    v_scheduled_for := pg_catalog.now();
  ELSE
    v_event_type := 'payment_failed';
    v_scheduled_for := pg_catalog.now() + INTERVAL '2 minutes';
  END IF;

  INSERT INTO public.notification_outbox (
    event_type,
    recipient_id,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    scheduled_for,
    next_attempt_at
  )
  VALUES (
    v_event_type,
    NEW.gym_goer_id,
    'booking',
    NEW.booking_id,
    pg_catalog.jsonb_build_object(
      'payment_id', NEW.id
    ),
    'payment:' || NEW.id::TEXT || ':' || NEW.status,
    v_scheduled_for,
    v_scheduled_for
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Keep the trigger function unavailable for direct client execution.
REVOKE ALL ON FUNCTION public.enqueue_payment_notification()
FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 3. PAYMENT STATUS TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS enqueue_payment_notification
ON public.booking_payments;

CREATE TRIGGER enqueue_payment_notification
AFTER UPDATE OF status
ON public.booking_payments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_payment_notification();

COMMIT;
