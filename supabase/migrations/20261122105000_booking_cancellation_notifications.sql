-- TRAINR Sprint 11A
-- Migration 6: actor-aware cancellation and refund notifications
--
-- LOCAL DRAFT ONLY.
--
-- Depends on:
--   20261122103000_cancellation_refund_schema.sql
--   20261122104000_secure_booking_cancellation_workflow.sql
--
-- Important release gate:
--   The process-notifications Edge Function must recognise all refund_*
--   event types before this migration is deployed.
--
-- This migration:
--   1. Extends the notification_outbox event constraint.
--   2. Extends the notifications history event constraint.
--   3. Preserves booking notifications and fixes cancellation recipients.
--   4. Adds versioned refund status transitions.
--   5. Enqueues refund lifecycle notifications.
--
-- Paystack refund execution and provider webhooks are NOT implemented here.
--
-- No migration deployment is authorised by this draft.

BEGIN;

-- ===========================================================================
-- 1. EXTEND THE NOTIFICATION OUTBOX EVENT CONTRACT
-- ===========================================================================

ALTER TABLE public.notification_outbox
    DROP CONSTRAINT notification_outbox_event_type_check;

ALTER TABLE public.notification_outbox
    ADD CONSTRAINT notification_outbox_event_type_check
    CHECK (
        event_type = ANY (
            ARRAY[
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
                'payment_failed',
                'refund_initiated',
                'refund_approved',
                'refund_awaiting_integration',
                'refund_processing',
                'refund_completed',
                'refund_failed',
                'refund_rejected',
                'refund_reversed'
            ]::text[]
        )
    );

COMMENT ON CONSTRAINT notification_outbox_event_type_check
ON public.notification_outbox IS
    'Allowed booking, workout, payment and refund notification event types. Refund event consumers must be deployed before these events are emitted.';


-- ===========================================================================
-- 2. EXTEND THE IN-APP NOTIFICATION HISTORY EVENT CONTRACT
-- ===========================================================================

ALTER TABLE public.notifications
    DROP CONSTRAINT notifications_event_type_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_event_type_check
    CHECK (
        event_type = ANY (
            ARRAY[
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
                'post_session_followup',
                'refund_initiated',
                'refund_approved',
                'refund_awaiting_integration',
                'refund_processing',
                'refund_completed',
                'refund_failed',
                'refund_rejected',
                'refund_reversed'
            ]::text[]
        )
    );

COMMENT ON CONSTRAINT notifications_event_type_check
ON public.notifications IS
    'Allowed in-app notification event types, including booking, payment, workout and refund events.';


-- ===========================================================================
-- 3. PRESERVE BOOKING NOTIFICATIONS AND CORRECT CANCELLATION RECIPIENTS
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enqueue_booking_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_event_type text;
    v_recipient_id uuid;
    v_recipients uuid[];
    v_event_version bigint;
    v_schedule_changed boolean := false;
    v_status_changed boolean := false;
    v_should_schedule_reminders boolean := false;
    v_reminder record;
    v_reminder_time timestamptz;
    v_cancellation_actor uuid;
    v_cancellation_role text;
    v_recipient uuid;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_schedule_changed :=
            OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
            OR OLD.scheduled_end IS DISTINCT FROM NEW.scheduled_end;

        v_status_changed := OLD.status IS DISTINCT FROM NEW.status;
    END IF;

    -- Invalidate outstanding reminders when the schedule changes or a
    -- confirmed booking ceases to be confirmed.
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

            -- The secure cancellation RPC inserts this record before it
            -- updates trainer_bookings. The trigger is SECURITY DEFINER,
            -- so it can read the protected cancellation record safely.
            SELECT
                cancellation.cancelled_by,
                cancellation.cancelled_by_role
            INTO
                v_cancellation_actor,
                v_cancellation_role
            FROM public.booking_cancellations AS cancellation
            WHERE cancellation.booking_id = NEW.id;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Cancellation notification requires an authoritative cancellation record.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_cancellation_role = 'gym_goer' THEN

                -- Gym-Goer cancellation notifies the Trainer.
                v_recipients := ARRAY[NEW.trainer_id];

            ELSIF v_cancellation_role = 'trainer' THEN

                -- Trainer cancellation notifies the Gym-Goer.
                v_recipients := ARRAY[NEW.gym_goer_id];

            ELSIF v_cancellation_role = 'admin' THEN

                -- Admin cancellation notifies both participants.
                v_recipients := ARRAY[
                    NEW.gym_goer_id,
                    NEW.trainer_id
                ];

            ELSE
                RAISE EXCEPTION
                    'Unsupported cancellation actor role for notification.'
                    USING ERRCODE = '23514';
            END IF;

        ELSIF OLD.status = 'confirmed'
           AND NEW.status = 'completed' THEN

            v_event_type := 'session_completed';
            v_recipient_id := NEW.gym_goer_id;

        END IF;

    ELSIF v_schedule_changed
       AND NEW.status = 'pending' THEN

        v_event_type := 'booking_reschedule_requested';
        v_recipient_id := NEW.trainer_id;

    END IF;

    -- Schedule reminders for confirmed sessions.
    v_should_schedule_reminders :=
        NEW.status = 'confirmed'
        AND (
            TG_OP = 'INSERT'
            OR v_status_changed
            OR v_schedule_changed
        );

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
        RETURNING event_version INTO v_event_version;

    END IF;

    -- Enqueue ordinary lifecycle events.
    IF v_event_type IS NOT NULL
       AND v_event_type <> 'booking_cancelled' THEN

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
            'booking:' || NEW.id::text || ':' ||
                v_event_version::text || ':' || v_event_type
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

    END IF;

    -- Cancellation may notify one or both participants.
    -- Include recipient identity in the idempotency key so each
    -- participant gets one event.
    IF v_event_type = 'booking_cancelled' THEN

        FOREACH v_recipient IN ARRAY
            COALESCE(v_recipients, ARRAY[]::uuid[])
        LOOP

            INSERT INTO public.notification_outbox (
                event_type,
                recipient_id,
                entity_type,
                entity_id,
                payload,
                idempotency_key
            )
            VALUES (
                'booking_cancelled',
                v_recipient,
                'booking',
                NEW.id,
                pg_catalog.jsonb_build_object(
                    'booking_id', NEW.id,
                    'cancelled_by', v_cancellation_actor,
                    'cancelled_by_role', v_cancellation_role,
                    'scheduled_start', NEW.scheduled_start,
                    'scheduled_end', NEW.scheduled_end
                ),
                'booking:' || NEW.id::text || ':' ||
                    v_event_version::text ||
                    ':booking_cancelled:' ||
                    v_recipient::text
            )
            ON CONFLICT (idempotency_key) DO NOTHING;

        END LOOP;

    END IF;

    -- Preserve the existing 24-hour and 1-hour Gym-Goer reminders.
    IF v_should_schedule_reminders THEN

        FOR v_reminder IN
            SELECT *
            FROM (
                VALUES
                    ('24h'::text, INTERVAL '24 hours'),
                    ('1h'::text, INTERVAL '1 hour')
            ) AS reminder_options(
                reminder_interval,
                reminder_offset
            )
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
                        'reminder_interval',
                            v_reminder.reminder_interval
                    ),
                    'booking:' || NEW.id::text || ':' ||
                        v_event_version::text ||
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
$function$;

-- Trigger functions execute through their attached triggers.
-- Application roles must not be able to invoke this function directly.
ALTER FUNCTION public.enqueue_booking_notification()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enqueue_booking_notification()
FROM PUBLIC, anon, authenticated, service_role;


-- ===========================================================================
-- 4. VERSION REFUND STATUS TRANSITIONS
-- ===========================================================================


-- Replace the refund transition trigger with the fully hardened version.
-- The status-version trigger runs first alphabetically and controls
-- NEW.status_version before this function executes.
CREATE OR REPLACE FUNCTION public.enforce_payment_refund_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_allowed boolean := false;
    v_status_changed boolean;
BEGIN
    v_status_changed :=
        NEW.refund_status IS DISTINCT FROM OLD.refund_status;

    IF (
        v_status_changed
        AND NEW.status_version <> OLD.status_version + 1
    ) OR (
        NOT v_status_changed
        AND NEW.status_version <> OLD.status_version
    ) THEN
        RAISE EXCEPTION
            'Refund status version must match the actual status transition.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.cancellation_id IS DISTINCT FROM OLD.cancellation_id
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.initiated_by IS DISTINCT FROM OLD.initiated_by
       OR NEW.refund_reason IS DISTINCT FROM OLD.refund_reason
       OR NEW.original_amount IS DISTINCT FROM OLD.original_amount
       OR NEW.refund_percentage IS DISTINCT FROM OLD.refund_percentage
       OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN

        RAISE EXCEPTION
            'Refund identity, financial fields and creation timestamp are immutable.'
            USING ERRCODE = '23514';
    END IF;

    -- Provider references may be assigned once, when processing begins.
    -- They cannot be cleared or replaced afterwards.
    IF NEW.provider_reference IS DISTINCT FROM OLD.provider_reference THEN
        IF OLD.provider_reference IS NOT NULL
           OR NEW.provider_reference IS NULL
           OR pg_catalog.btrim(NEW.provider_reference) = ''
           OR NEW.refund_status <> 'processing'
           OR OLD.refund_status NOT IN (
               'awaiting_integration',
               'processing'
           ) THEN
            RAISE EXCEPTION
                'Provider reference may only be assigned once during refund processing.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- updated_at is controlled by this trigger, never by the caller.
    IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        RAISE EXCEPTION
            'Refund updated_at is database-controlled.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT v_status_changed THEN
        RETURN NEW;
    END IF;

    v_allowed := CASE OLD.refund_status
        WHEN 'awaiting_review'
            THEN NEW.refund_status IN ('approved', 'rejected')
        WHEN 'approved'
            THEN NEW.refund_status = 'awaiting_integration'
        WHEN 'awaiting_integration'
            THEN NEW.refund_status = 'processing'
        WHEN 'processing'
            THEN NEW.refund_status IN ('completed', 'failed')
        WHEN 'failed'
            THEN NEW.refund_status = 'awaiting_integration'
        WHEN 'completed'
            THEN NEW.refund_status = 'reversed'
        ELSE false
    END;

    IF NOT v_allowed THEN
        RAISE EXCEPTION
            'Invalid refund status transition: % -> %.',
            OLD.refund_status,
            NEW.refund_status
            USING ERRCODE = '23514';
    END IF;

    NEW.updated_at := pg_catalog.statement_timestamp();

    INSERT INTO public.refund_audit_logs (
        refund_id,
        actor_id,
        action,
        previous_status,
        new_status,
        remarks
    )
    VALUES (
        OLD.id,
        auth.uid(),
        'refund_status_changed',
        OLD.refund_status,
        NEW.refund_status,
        'Status transition recorded by database trigger.'
    );

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_payment_refund_status_transition()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enforce_payment_refund_status_transition()
FROM PUBLIC, anon, authenticated, service_role;


-- Existing refund records receive version 1.
-- New refund records also default to version 1.
ALTER TABLE public.payment_refunds
    ADD COLUMN status_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.payment_refunds
    ADD CONSTRAINT payment_refunds_status_version_check
    CHECK (status_version >= 1);

-- Keep status_version database-controlled on every update.
-- Increment only when refund_status actually changes.
CREATE OR REPLACE FUNCTION public.increment_refund_status_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.status_version := 1;
    ELSIF OLD.refund_status IS DISTINCT FROM NEW.refund_status THEN
        NEW.status_version := OLD.status_version + 1;
    ELSE
        NEW.status_version := OLD.status_version;
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.increment_refund_status_version()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.increment_refund_status_version()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS increment_refund_status_version_before_update
ON public.payment_refunds;

CREATE TRIGGER increment_refund_status_version_before_update
BEFORE INSERT OR UPDATE
ON public.payment_refunds
FOR EACH ROW
EXECUTE FUNCTION public.increment_refund_status_version();

COMMENT ON COLUMN public.payment_refunds.status_version IS
    'Monotonically increasing version for each actual refund status transition. Used to identify notification events uniquely.';


-- ===========================================================================
-- 5. ENQUEUE REFUND LIFECYCLE NOTIFICATIONS FOR THE GYM-GOER
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enqueue_booking_refund_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_event_type text;
    v_gym_goer_id uuid;
    v_booking_start timestamptz;
BEGIN

    -- Do not enqueue a notification when the status has not changed.
    IF TG_OP = 'UPDATE'
       AND OLD.refund_status IS NOT DISTINCT FROM NEW.refund_status THEN

        RETURN NEW;

    END IF;

    -- Map refund status to notification event.
    CASE NEW.refund_status

        WHEN 'awaiting_review' THEN
            v_event_type := 'refund_initiated';

        WHEN 'approved' THEN
            v_event_type := 'refund_approved';

        WHEN 'awaiting_integration' THEN
            v_event_type := 'refund_awaiting_integration';

        WHEN 'processing' THEN
            v_event_type := 'refund_processing';

        WHEN 'completed' THEN
            v_event_type := 'refund_completed';

        WHEN 'failed' THEN
            v_event_type := 'refund_failed';

        WHEN 'rejected' THEN
            v_event_type := 'refund_rejected';

        WHEN 'reversed' THEN
            v_event_type := 'refund_reversed';

        ELSE
            RETURN NEW;

    END CASE;

    -- Resolve the Gym-Goer and booking schedule.
    SELECT
        booking.gym_goer_id,
        booking.scheduled_start
    INTO
        v_gym_goer_id,
        v_booking_start
    FROM public.trainer_bookings AS booking
    WHERE booking.id = NEW.booking_id;

    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Refund notification could not resolve its booking.'
            USING ERRCODE = '23503';

    END IF;

    -- Enqueue the refund notification.
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
        v_gym_goer_id,
        'booking',
        NEW.booking_id,
        pg_catalog.jsonb_build_object(
            'booking_id', NEW.booking_id,
            'refund_id', NEW.id,
            'payment_id', NEW.payment_id,
            'refund_amount', NEW.refund_amount,
            'currency', NEW.currency,
            'refund_status', NEW.refund_status,
            'status_version', NEW.status_version,
            'scheduled_start', v_booking_start
        ),
        'refund:' || NEW.id::text || ':' ||
            NEW.status_version::text || ':' ||
            NEW.refund_status
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enqueue_booking_refund_notification()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enqueue_booking_refund_notification()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enqueue_booking_refund_notification_after_change
ON public.payment_refunds;

CREATE TRIGGER enqueue_booking_refund_notification_after_change
AFTER INSERT OR UPDATE
ON public.payment_refunds
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_booking_refund_notification();

COMMENT ON FUNCTION public.enqueue_booking_refund_notification() IS
    'Enqueues versioned refund lifecycle events for the booking Gym-Goer. Completion events are emitted only when the trusted refund status becomes completed.';


-- ===========================================================================
-- 6. COMMIT
-- ===========================================================================

COMMIT;