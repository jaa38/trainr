BEGIN;

-- =========================================================
-- 1. WORKOUT ASSIGNMENT NOTIFICATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.enqueue_workout_assignment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only notify gym-goers about active assignments.
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_outbox (
    event_type,
    recipient_id,
    entity_type,
    entity_id,
    payload,
    idempotency_key
  )
  VALUES (
    'workout_assigned',
    NEW.gym_goer_id,
    'workout_assignment',
    NEW.id,
    pg_catalog.jsonb_build_object(
      'assignment_id', NEW.id,
      'workout_plan_id', NEW.workout_plan_id,
      'plan_version', NEW.plan_version
    ),
    'workout-assignment:' || NEW.id::TEXT || ':workout_assigned'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;


-- =========================================================
-- 2. TRAINER FEEDBACK NOTIFICATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.enqueue_trainer_feedback_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_outbox (
    event_type,
    recipient_id,
    entity_type,
    entity_id,
    payload,
    idempotency_key
  )
  VALUES (
    'trainer_feedback_created',
    NEW.gym_goer_id,
    'trainer_feedback',
    NEW.id,
    pg_catalog.jsonb_build_object(
      'feedback_id', NEW.id,
      'assigned_workout_plan_id', NEW.assigned_workout_plan_id,
      'workout_log_id', NEW.workout_log_id
    ),
    'trainer-feedback:' || NEW.id::TEXT || ':trainer_feedback_created'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;


-- =========================================================
-- 3. RESTRICT FUNCTION EXECUTION
-- =========================================================

REVOKE ALL ON FUNCTION
  public.enqueue_workout_assignment_notification()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.enqueue_workout_assignment_notification()
TO service_role;

REVOKE ALL ON FUNCTION
  public.enqueue_trainer_feedback_notification()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.enqueue_trainer_feedback_notification()
TO service_role;


-- =========================================================
-- 4. WORKOUT ASSIGNMENT INSERT TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
  enqueue_workout_assignment_notification_after_insert
ON public.assigned_workout_plans;

CREATE TRIGGER enqueue_workout_assignment_notification_after_insert
AFTER INSERT ON public.assigned_workout_plans
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.enqueue_workout_assignment_notification();


-- =========================================================
-- 5. TRAINER FEEDBACK INSERT TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
  enqueue_trainer_feedback_notification_after_insert
ON public.trainer_feedback;

CREATE TRIGGER enqueue_trainer_feedback_notification_after_insert
AFTER INSERT ON public.trainer_feedback
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_trainer_feedback_notification();

COMMIT;
