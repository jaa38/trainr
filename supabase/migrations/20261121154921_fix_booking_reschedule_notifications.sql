
BEGIN;

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
  v_status_changed BOOLEAN := FALSE;
  v_should_schedule_reminders BOOLEAN := FALSE;
  v_reminder RECORD;
  v_reminder_time TIMESTAMPTZ;
BEGIN

  -- Determine which booking fields changed.
  IF TG_OP = 'UPDATE' THEN
    v_schedule_changed :=
      OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
      OR OLD.scheduled_end IS DISTINCT FROM NEW.scheduled_end;

    v_status_changed :=
      OLD.status IS DISTINCT FROM NEW.status;
  END IF;

  -- Invalidate outstanding reminders.
  IF TG_OP = 'UPDATE'
     AND (
       v_schedule_changed
       OR (v_status_changed AND NEW.status <> 'confirmed')
     ) THEN

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

  -- Determine booking lifecycle event.
  IF TG_OP = 'INSERT' THEN

    IF NEW.status = 'pending' THEN
      v_event_type := 'booking_requested';
      v_recipient_id := NEW.trainer_id;
    END IF;

  ELSIF v_status_changed THEN

    -- A confirmed booking moved to a new proposed time.
    -- Notify the trainer that the gym-goer needs confirmation.
    IF v_schedule_changed
       AND OLD.status = 'confirmed'
       AND NEW.status = 'pending' THEN

      v_event_type := 'booking_reschedule_requested';
      v_recipient_id := NEW.trainer_id;

    ELSIF OLD.status = 'pending'
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

  ELSIF v_schedule_changed AND NEW.status = 'pending' THEN

    v_event_type := 'booking_reschedule_requested';
    v_recipient_id := NEW.trainer_id;

  END IF;

  -- Determine whether reminders should be created.
  v_should_schedule_reminders :=
    NEW.status = 'confirmed'
    AND (
      TG_OP = 'INSERT'
      OR v_status_changed
      OR v_schedule_changed
    );

  -- Allocate a unique event version.
  IF v_event_type IS NOT NULL
     OR v_should_schedule_reminders THEN

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

  END IF;

  -- Enqueue booking lifecycle event.
  IF v_event_type IS NOT NULL THEN

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

  END IF;

  -- Schedule session reminders.
  IF v_should_schedule_reminders THEN

    FOR v_reminder IN
      SELECT *
      FROM (
        VALUES
          ('24h'::TEXT, INTERVAL '24 hours'),
          ('1h'::TEXT, INTERVAL '1 hour')
      ) AS reminder_options(reminder_interval, reminder_offset)
    LOOP

      v_reminder_time :=
        NEW.scheduled_start - v_reminder.reminder_offset;

      IF v_reminder_time > pg_catalog.now() THEN

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
          'session_reminder',
          NEW.gym_goer_id,
          'booking',
          NEW.id,
          pg_catalog.jsonb_build_object(
            'booking_id', NEW.id,
            'scheduled_start', NEW.scheduled_start,
            'scheduled_end', NEW.scheduled_end,
            'reminder_interval', v_reminder.reminder_interval
          ),
          'booking:' || NEW.id::TEXT || ':' ||
            v_event_version::TEXT ||
            ':session_reminder:' ||
            v_reminder.reminder_interval,
          v_reminder_time
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

      END IF;

    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_booking_notification()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_booking_notification()
  TO service_role;

COMMIT;
