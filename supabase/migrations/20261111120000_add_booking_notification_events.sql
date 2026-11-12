BEGIN;

-- =========================================================
-- 1. PRIVATE BOOKING NOTIFICATION EVENT SEQUENCES
-- =========================================================

CREATE TABLE public.booking_notification_event_sequences (
  booking_id UUID PRIMARY KEY
    REFERENCES public.trainer_bookings(id) ON DELETE CASCADE,

  event_version BIGINT NOT NULL DEFAULT 0
    CHECK (event_version >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.booking_notification_event_sequences
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_notification_event_sequences
  FROM PUBLIC, anon, authenticated, service_role;


-- =========================================================
-- 2. BOOKING NOTIFICATION EVENT CAPTURE
-- =========================================================

CREATE OR REPLACE FUNCTION public.enqueue_booking_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type TEXT;
  v_recipient_id UUID;
  v_event_version BIGINT;
  v_schedule_changed BOOLEAN := FALSE;
BEGIN

  -- New booking request
  IF TG_OP = 'INSERT' THEN

    IF NEW.status <> 'pending' THEN
      RETURN NEW;
    END IF;

    v_event_type := 'booking_requested';
    v_recipient_id := NEW.trainer_id;

  ELSE

    v_schedule_changed :=
      OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
      OR OLD.scheduled_end IS DISTINCT FROM NEW.scheduled_end;

    -- Rescheduling invalidates outstanding reminders.
    IF v_schedule_changed THEN

      UPDATE public.notification_outbox
      SET
        status = 'cancelled',
        locked_at = NULL,
        locked_by = NULL
      WHERE entity_type = 'booking'
        AND entity_id = NEW.id
        AND event_type = 'session_reminder'
        AND status IN ('pending', 'processing');

      IF NEW.status = 'pending' THEN
        v_event_type := 'booking_reschedule_requested';
        v_recipient_id := NEW.trainer_id;
      END IF;

    ELSE

      IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
      END IF;

      IF OLD.status = 'pending'
         AND NEW.status = 'confirmed' THEN

        v_event_type := 'booking_confirmed';
        v_recipient_id := NEW.gym_goer_id;

      ELSIF OLD.status = 'pending'
            AND NEW.status = 'declined' THEN

        v_event_type := 'booking_declined';
        v_recipient_id := NEW.gym_goer_id;

      ELSIF OLD.status IN ('pending', 'confirmed')
            AND NEW.status = 'cancelled' THEN

        v_event_type := 'booking_cancelled';
        v_recipient_id := NEW.trainer_id;

      ELSIF OLD.status = 'confirmed'
            AND NEW.status = 'completed' THEN

        v_event_type := 'session_completed';
        v_recipient_id := NEW.gym_goer_id;

      END IF;

    END IF;

  END IF;

  IF v_event_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allocate a unique transactional event version.
  INSERT INTO public.booking_notification_event_sequences AS current_sequence (
    booking_id,
    event_version
  )
  VALUES (
    NEW.id,
    1
  )
  ON CONFLICT (booking_id)
  DO UPDATE SET
    event_version = current_sequence.event_version + 1
  RETURNING event_version
  INTO v_event_version;

  -- Insert notification into the transactional outbox.
  INSERT INTO public.notification_outbox (
    event_type,
    recipient_id,
    entity_type,
    entity_id,
    payload,
    idempotency_key
  )
  VALUES (
    v_event_type,
    v_recipient_id,
    'booking',
    NEW.id,
    pg_catalog.jsonb_build_object(
      'booking_id', NEW.id,
      'scheduled_start', NEW.scheduled_start,
      'scheduled_end', NEW.scheduled_end
    ),
    'booking:' || NEW.id::TEXT || ':' ||
      v_event_version::TEXT || ':' || v_event_type
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Cancellation invalidates outstanding reminders.
  IF NEW.status = 'cancelled' THEN

    UPDATE public.notification_outbox
    SET
      status = 'cancelled',
      locked_at = NULL,
      locked_by = NULL
    WHERE entity_type = 'booking'
      AND entity_id = NEW.id
      AND event_type = 'session_reminder'
      AND status IN ('pending', 'processing');

  END IF;

  RETURN NEW;
END;
$$;


-- =========================================================
-- 3. RESTRICT FUNCTION EXECUTION
-- =========================================================

REVOKE ALL ON FUNCTION public.enqueue_booking_notification()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_booking_notification()
  TO service_role;


-- =========================================================
-- 4. BOOKING INSERT TRIGGER
-- =========================================================

CREATE TRIGGER enqueue_booking_notification_after_insert
AFTER INSERT ON public.trainer_bookings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_booking_notification();


-- =========================================================
-- 5. BOOKING UPDATE TRIGGER
-- =========================================================

CREATE TRIGGER enqueue_booking_notification_after_update
AFTER UPDATE OF status, scheduled_start, scheduled_end
ON public.trainer_bookings
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
  OR OLD.scheduled_end IS DISTINCT FROM NEW.scheduled_end
)
EXECUTE FUNCTION public.enqueue_booking_notification();

COMMIT;
