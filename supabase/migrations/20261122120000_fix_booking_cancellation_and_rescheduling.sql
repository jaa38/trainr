-- ============================================================
-- TRAINR: Correct booking cancellation and rescheduling
-- Migration: 20261122120000
--
-- Scope:
-- 1. Match cancellation records to the exact booking updated_at.
-- 2. Add transaction-bound private reschedule authorisation.
-- 3. Derive rescheduled end time from stored session duration.
-- 4. Require renewed trainer approval after rescheduling.
--
-- No remote deployment is performed by this migration file.
-- ============================================================


-- ============================================================
-- 1. Private, transaction-bound reschedule authorisations
-- ============================================================

CREATE TABLE private.trainer_booking_reschedule_authorizations (
    transaction_id bigint NOT NULL,
    actor_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    scheduled_start timestamptz NOT NULL,
    scheduled_end timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,

    CONSTRAINT trainer_booking_reschedule_authorizations_pkey
        PRIMARY KEY (transaction_id, booking_id),

    CONSTRAINT trainer_booking_reschedule_authorizations_valid_interval
        CHECK (scheduled_end > scheduled_start)
);

ALTER TABLE private.trainer_booking_reschedule_authorizations
    OWNER TO postgres;

REVOKE ALL ON TABLE
    private.trainer_booking_reschedule_authorizations
FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================
-- 2. Secure booking transition trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_trainer_booking_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_user_role text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.role
    INTO v_user_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Authenticated profile not found.'
            USING ERRCODE = '42501';
    END IF;


    -- --------------------------------------------------------
    -- Trainer transitions
    -- --------------------------------------------------------

    IF v_user_id = OLD.trainer_id
       AND v_user_role = 'trainer' THEN

        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.gym_goer_id IS DISTINCT FROM OLD.gym_goer_id
           OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id
           OR NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
           OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
           OR NEW.session_rate IS DISTINCT FROM OLD.session_rate
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.notes IS DISTINCT FROM OLD.notes
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.session_rate_id IS DISTINCT FROM OLD.session_rate_id
           OR NEW.session_type IS DISTINCT FROM OLD.session_type
           OR NEW.training_format IS DISTINCT FROM OLD.training_format
           OR NEW.session_duration_minutes
                IS DISTINCT FROM OLD.session_duration_minutes
           OR NEW.cancellation_policy_version_id
                IS DISTINCT FROM OLD.cancellation_policy_version_id
           OR NEW.cancellation_policy_snapshot
                IS DISTINCT FROM OLD.cancellation_policy_snapshot THEN

            RAISE EXCEPTION
                'Trainers cannot change protected booking details.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
            RETURN NEW;
        END IF;

        -- Trainer approval or decline.
        IF OLD.status = 'pending'
           AND NEW.status IN ('confirmed', 'declined') THEN
            RETURN NEW;
        END IF;

        -- Complete only after the scheduled session has ended.
        IF OLD.status = 'confirmed'
           AND NEW.status = 'completed'
           AND OLD.scheduled_end <= pg_catalog.statement_timestamp() THEN
            RETURN NEW;
        END IF;

        -- Trainer cancellation must have a matching RPC-created record.
        IF OLD.status = 'confirmed'
           AND NEW.status = 'cancelled'
           AND OLD.scheduled_end > pg_catalog.statement_timestamp() THEN

            PERFORM 1
            FROM public.booking_cancellations AS cancellation
            WHERE cancellation.booking_id = OLD.id
              AND cancellation.cancelled_by = v_user_id
              AND cancellation.cancelled_by_role = 'trainer'
              AND cancellation.cancellation_type = 'trainer_initiated'
              AND cancellation.cancelled_at = NEW.updated_at
              AND cancellation.cancelled_at < OLD.scheduled_end;

            IF FOUND THEN
                RETURN NEW;
            END IF;
        END IF;

        RAISE EXCEPTION
            'This booking status transition is not permitted for trainers.'
            USING ERRCODE = '23514';
    END IF;


    -- --------------------------------------------------------
    -- Gym-goer transitions
    -- --------------------------------------------------------

    IF v_user_id = OLD.gym_goer_id
       AND v_user_role = 'gym_goer' THEN

        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.gym_goer_id IS DISTINCT FROM OLD.gym_goer_id
           OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id
           OR NEW.session_rate IS DISTINCT FROM OLD.session_rate
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.notes IS DISTINCT FROM OLD.notes
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.session_rate_id IS DISTINCT FROM OLD.session_rate_id
           OR NEW.session_type IS DISTINCT FROM OLD.session_type
           OR NEW.training_format IS DISTINCT FROM OLD.training_format
           OR NEW.session_duration_minutes
                IS DISTINCT FROM OLD.session_duration_minutes
           OR NEW.cancellation_policy_version_id
                IS DISTINCT FROM OLD.cancellation_policy_version_id
           OR NEW.cancellation_policy_snapshot
                IS DISTINCT FROM OLD.cancellation_policy_snapshot THEN

            RAISE EXCEPTION
                'Gym-goers cannot change protected booking details.'
                USING ERRCODE = '42501';
        END IF;

        -- Gym-goer cancellation must have a matching RPC-created record.
        IF NEW.status = 'cancelled'
           AND OLD.status IN ('pending', 'confirmed')
           AND OLD.scheduled_start > pg_catalog.statement_timestamp()
           AND NEW.scheduled_start IS NOT DISTINCT FROM OLD.scheduled_start
           AND NEW.scheduled_end IS NOT DISTINCT FROM OLD.scheduled_end THEN

            PERFORM 1
            FROM public.booking_cancellations AS cancellation
            WHERE cancellation.booking_id = OLD.id
              AND cancellation.cancelled_by = v_user_id
              AND cancellation.cancelled_by_role = 'gym_goer'
              AND cancellation.cancellation_type = 'gym_goer_initiated'
              AND cancellation.cancelled_at = NEW.updated_at
              AND cancellation.cancelled_at < OLD.scheduled_start;

            IF FOUND THEN
                RETURN NEW;
            END IF;
        END IF;

        -- Rescheduling is permitted only through the secure RPC.
        -- The authorisation must match this transaction, actor,
        -- booking, exact time interval and update timestamp.
        IF OLD.status IN ('pending', 'confirmed')
           AND NEW.status = 'pending'
           AND OLD.scheduled_start > pg_catalog.statement_timestamp()
           AND NEW.scheduled_start > pg_catalog.statement_timestamp()
           AND NEW.scheduled_end > NEW.scheduled_start
           AND (
               NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
               OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
           )
           AND EXISTS (
               SELECT 1
               FROM private.trainer_booking_reschedule_authorizations
                    AS reschedule_auth
               WHERE reschedule_auth.transaction_id =
                         pg_catalog.txid_current()
                 AND reschedule_auth.actor_id = v_user_id
                 AND reschedule_auth.booking_id = OLD.id
                 AND reschedule_auth.scheduled_start = NEW.scheduled_start
                 AND reschedule_auth.scheduled_end = NEW.scheduled_end
                 AND reschedule_auth.updated_at = NEW.updated_at
           ) THEN

            RETURN NEW;
        END IF;

        RAISE EXCEPTION
            'This booking change is not permitted for gym-goers.'
            USING ERRCODE = '23514';
    END IF;


    RAISE EXCEPTION
        'You are not authorised to modify this booking.'
        USING ERRCODE = '42501';
END;
$function$;

ALTER FUNCTION public.enforce_trainer_booking_transitions()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.enforce_trainer_booking_transitions()
FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================
-- 3. Secure rescheduling RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.reschedule_trainer_booking(
    p_booking_id uuid,
    p_scheduled_start timestamptz,
    p_scheduled_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_booking public.trainer_bookings%ROWTYPE;
    v_scheduled_end timestamptz;
    v_rescheduled_at timestamptz;
    v_transaction_id bigint;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.role
    INTO v_user_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_user_role IS DISTINCT FROM 'gym_goer' THEN
        RAISE EXCEPTION 'Gym-goer account required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_booking_id IS NULL
       OR p_scheduled_start IS NULL
       OR p_scheduled_end IS NULL THEN
        RAISE EXCEPTION 'Booking ID and new session times are required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_scheduled_start <= pg_catalog.clock_timestamp()
       OR p_scheduled_end <= p_scheduled_start THEN
        RAISE EXCEPTION 'Choose a valid future session time.'
            USING ERRCODE = '22023';
    END IF;

    -- Serialize this operation with cancellation and payment operations.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_booking_id::text, 0)
    );

    SELECT b.*
    INTO v_booking
    FROM public.trainer_bookings AS b
    WHERE b.id = p_booking_id
      AND b.gym_goer_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_booking.status NOT IN ('pending', 'confirmed')
       OR v_booking.scheduled_start <= pg_catalog.clock_timestamp() THEN
        RAISE EXCEPTION
            'Booking not found or no longer eligible for rescheduling.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.session_duration_minutes IS NULL
       OR v_booking.session_duration_minutes <= 0 THEN
        RAISE EXCEPTION
            'The booking does not have a valid stored session duration.'
            USING ERRCODE = '23514';
    END IF;

    -- The database, not the client, determines the new end time.
    v_scheduled_end :=
        p_scheduled_start
        + pg_catalog.make_interval(
            mins => v_booking.session_duration_minutes
        );

    -- Keep the existing three-argument API compatible, but reject
    -- client values that disagree with the server-calculated end.
    IF p_scheduled_end IS DISTINCT FROM v_scheduled_end THEN
        RAISE EXCEPTION
            'The supplied session end time does not match the booking duration.'
            USING ERRCODE = '22023';
    END IF;

    IF p_scheduled_start IS NOT DISTINCT FROM v_booking.scheduled_start
       AND v_scheduled_end IS NOT DISTINCT FROM v_booking.scheduled_end THEN
        RAISE EXCEPTION
            'Choose a different session time to reschedule this booking.'
            USING ERRCODE = '22023';
    END IF;

    v_transaction_id := pg_catalog.txid_current();
    v_rescheduled_at := pg_catalog.clock_timestamp();

    -- This authorisation exists only within the current transaction.
    INSERT INTO private.trainer_booking_reschedule_authorizations (
        transaction_id,
        actor_id,
        booking_id,
        scheduled_start,
        scheduled_end,
        updated_at
    )
    VALUES (
        v_transaction_id,
        v_user_id,
        v_booking.id,
        p_scheduled_start,
        v_scheduled_end,
        v_rescheduled_at
    );

    -- A confirmed booking returns to pending and needs trainer approval.
    UPDATE public.trainer_bookings AS b
    SET
        scheduled_start = p_scheduled_start,
        scheduled_end = v_scheduled_end,
        status = 'pending',
        updated_at = v_rescheduled_at
    WHERE b.id = v_booking.id;

    -- Remove the authorisation before the transaction completes.
    DELETE FROM private.trainer_booking_reschedule_authorizations
    WHERE transaction_id = v_transaction_id
      AND actor_id = v_user_id
      AND booking_id = v_booking.id;

END;
$function$;

ALTER FUNCTION public.reschedule_trainer_booking(
    uuid,
    timestamptz,
    timestamptz
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reschedule_trainer_booking(
    uuid,
    timestamptz,
    timestamptz
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reschedule_trainer_booking(
    uuid,
    timestamptz,
    timestamptz
) TO authenticated, service_role;


-- ============================================================
-- 4. Final private-table permissions
-- ============================================================

REVOKE ALL ON TABLE
    private.trainer_booking_reschedule_authorizations
FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================
-- End of migration
-- ============================================================
