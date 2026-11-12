BEGIN;

-- =========================================================
-- 1. ALLOW WORKOUT LOG NOTIFICATION ENTITIES
-- =========================================================

ALTER TABLE public.notification_outbox
  DROP CONSTRAINT notification_outbox_entity_type_check;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_entity_type_check
  CHECK (
    entity_type IN (
      'booking',
      'workout_assignment',
      'trainer_feedback',
      'workout_log'
    )
  );


-- =========================================================
-- 2. POST-SESSION FOLLOW-UP EVENT PRODUCER
-- =========================================================

CREATE OR REPLACE FUNCTION
  public.enqueue_post_session_followup_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only process the first transition to completed.
  IF OLD.completed_at IS NOT NULL
     OR NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_outbox (
    event_type,
    recipient_id,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    scheduled_for
  )
  VALUES (
    'post_session_followup',
    NEW.gym_goer_id,
    'workout_log',
    NEW.id,
    pg_catalog.jsonb_build_object(
      'workout_log_id', NEW.id,
      'assigned_workout_plan_id', NEW.assigned_workout_plan_id
    ),
    'workout-log:' || NEW.id::TEXT || ':post_session_followup',
    NEW.completed_at + INTERVAL '24 hours'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;


-- =========================================================
-- 3. RESTRICT FUNCTION EXECUTION
-- =========================================================

REVOKE ALL ON FUNCTION
  public.enqueue_post_session_followup_notification()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.enqueue_post_session_followup_notification()
TO service_role;


-- =========================================================
-- 4. WORKOUT COMPLETION TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
  enqueue_post_session_followup_after_completion
ON public.workout_logs;

CREATE TRIGGER enqueue_post_session_followup_after_completion
AFTER UPDATE OF completed_at ON public.workout_logs
FOR EACH ROW
WHEN (
  OLD.completed_at IS NULL
  AND NEW.completed_at IS NOT NULL
)
EXECUTE FUNCTION
  public.enqueue_post_session_followup_notification();

COMMIT;
