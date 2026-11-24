BEGIN;

-- ============================================================================
-- TRAINR — SECURE BOOKING CREATION
--
-- Goals:
-- 1. Route new bookings through a server-authoritative RPC.
-- 2. Derive trainer, rate, currency and duration from the selected rate.
-- 3. Prevent duplicate bookings through idempotency.
-- 4. Remove direct Gym-Goer booking inserts.
-- 5. Permit Trainers to update booking status only.
-- 6. Keep Gym-Goer cancellation and rescheduling behind secure RPCs.
--
-- Prerequisite:
-- Migration 2 must add the booking snapshot columns and the composite
-- foreign key on (session_rate_id, trainer_id).
-- ============================================================================


-- ============================================================================
-- 1. PRIVATE IDEMPOTENCY TABLE
-- ============================================================================

CREATE TABLE private.trainer_booking_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    gym_goer_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    idempotency_key uuid NOT NULL,

    session_rate_id uuid NOT NULL,

    scheduled_start timestamptz NOT NULL,

    notes text,

    booking_id uuid
        REFERENCES public.trainer_bookings(id)
        ON DELETE RESTRICT,

    created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT trainer_booking_requests_unique_key
        UNIQUE (gym_goer_id, idempotency_key),

    CONSTRAINT trainer_booking_requests_notes_length
        CHECK (notes IS NULL OR pg_catalog.char_length(notes) <= 1000)
);

ALTER TABLE private.trainer_booking_requests
    OWNER TO postgres;

-- No direct access to idempotency records.
REVOKE ALL ON TABLE private.trainer_booking_requests
FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================================
-- 2. SECURE BOOKING CREATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_trainer_booking(
    p_session_rate_id uuid,
    p_scheduled_start timestamptz,
    p_idempotency_key uuid,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$

DECLARE
    v_user_id uuid := auth.uid();
    v_role text;
    v_notes text;

    v_request private.trainer_booking_requests%ROWTYPE;
    v_rate record;

    v_booking_id uuid;
    v_scheduled_end timestamptz;

BEGIN

    -- ------------------------------------------------------------------------
    -- Authentication
    -- ------------------------------------------------------------------------

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'You must be signed in to create a booking.'
            USING ERRCODE = '28000';
    END IF;


    -- ------------------------------------------------------------------------
    -- Gym-Goer role verification
    -- ------------------------------------------------------------------------

    SELECT p.role
    INTO v_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_role IS DISTINCT FROM 'gym_goer' THEN
        RAISE EXCEPTION
            'Only Gym-Goers can create bookings.'
            USING ERRCODE = '42501';
    END IF;


    -- ------------------------------------------------------------------------
    -- Input validation
    -- ------------------------------------------------------------------------

    IF p_session_rate_id IS NULL
       OR p_scheduled_start IS NULL
       OR p_idempotency_key IS NULL THEN

        RAISE EXCEPTION
            'A session rate, session start time and idempotency key are required.'
            USING ERRCODE = '22023';
    END IF;

    v_notes := NULLIF(pg_catalog.btrim(p_notes), '');

    IF v_notes IS NOT NULL
       AND pg_catalog.char_length(v_notes) > 1000 THEN

        RAISE EXCEPTION
            'Booking notes cannot exceed 1000 characters.'
            USING ERRCODE = '22023';
    END IF;


    -- ------------------------------------------------------------------------
    -- Idempotency reservation
    --
    -- Concurrent requests using the same Gym-Goer/key pair resolve to the
    -- same request record. The unique constraint serialises duplicate keys.
    -- ------------------------------------------------------------------------

    INSERT INTO private.trainer_booking_requests (
        gym_goer_id,
        idempotency_key,
        session_rate_id,
        scheduled_start,
        notes
    )
    VALUES (
        v_user_id,
        p_idempotency_key,
        p_session_rate_id,
        p_scheduled_start,
        v_notes
    )
    ON CONFLICT (gym_goer_id, idempotency_key)
    DO NOTHING;


    SELECT *
    INTO v_request
    FROM private.trainer_booking_requests
    WHERE gym_goer_id = v_user_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Unable to reserve the booking request.'
            USING ERRCODE = 'P0001';
    END IF;


    -- The same key cannot be reused for a different request.
    IF v_request.session_rate_id IS DISTINCT FROM p_session_rate_id
       OR v_request.scheduled_start IS DISTINCT FROM p_scheduled_start
       OR v_request.notes IS DISTINCT FROM v_notes THEN

        RAISE EXCEPTION
            'This idempotency key has already been used for a different booking request.'
            USING ERRCODE = '22023';
    END IF;


    -- ------------------------------------------------------------------------
    -- Return the original booking for a successful retry.
    --
    -- A retry remains valid even after the original session start time.
    -- ------------------------------------------------------------------------

    IF v_request.booking_id IS NOT NULL THEN
        RETURN v_request.booking_id;
    END IF;


    -- ------------------------------------------------------------------------
    -- New booking requests must have a future start time.
    -- This check deliberately follows the successful retry check.
    -- ------------------------------------------------------------------------

    IF p_scheduled_start <= pg_catalog.clock_timestamp() THEN
        RAISE EXCEPTION
            'The booking start time must be in the future.'
            USING ERRCODE = '22023';
    END IF;


    -- ------------------------------------------------------------------------
    -- Validate and lock the selected trainer session rate
    --
    -- The client cannot provide the trainer, price, currency or duration.
    -- These values are retrieved from the database.
    -- ------------------------------------------------------------------------

    SELECT
        r.id,
        r.trainer_id,
        r.session_type,
        r.session_duration_minutes,
        r.session_rate,
        r.currency,
        r.training_format

    INTO v_rate

    FROM public.trainer_session_rates AS r

    JOIN public.profiles AS p
        ON p.id = r.trainer_id

    JOIN public.trainer_profiles AS tp
        ON tp.user_id = r.trainer_id

    WHERE r.id = p_session_rate_id
      AND r.status = 'active'
      AND r.requires_confirmation = false
      AND r.session_type IS NOT NULL
      AND r.training_format IS NOT NULL
      AND p.role = 'trainer'
      AND p.onboarding_completed = true
      AND tp.is_published = true

    FOR SHARE OF r;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'This trainer session rate is unavailable.'
            USING ERRCODE = 'P0001';
    END IF;


    -- ------------------------------------------------------------------------
    -- Derive the session end time from the stored duration
    -- ------------------------------------------------------------------------

    v_scheduled_end :=
        p_scheduled_start
        + pg_catalog.make_interval(
            mins => v_rate.session_duration_minutes
        );


    -- ------------------------------------------------------------------------
    -- Create the booking using database-owned commercial values
    -- ------------------------------------------------------------------------

    INSERT INTO public.trainer_bookings (
        gym_goer_id,
        trainer_id,
        scheduled_start,
        scheduled_end,
        session_rate,
        currency,
        status,
        notes,
        session_rate_id,
        session_type,
        training_format,
        session_duration_minutes
    )
    VALUES (
        v_user_id,
        v_rate.trainer_id,
        p_scheduled_start,
        v_scheduled_end,
        v_rate.session_rate,
        v_rate.currency,
        'pending',
        v_notes,
        v_rate.id,
        v_rate.session_type,
        v_rate.training_format,
        v_rate.session_duration_minutes
    )
    RETURNING id INTO v_booking_id;


    -- ------------------------------------------------------------------------
    -- Store the completed idempotent result
    -- ------------------------------------------------------------------------

    UPDATE private.trainer_booking_requests
    SET booking_id = v_booking_id
    WHERE gym_goer_id = v_user_id
      AND idempotency_key = p_idempotency_key;


    RETURN v_booking_id;

END;
$function$;


-- ============================================================================
-- 3. SECURE FUNCTION OWNERSHIP AND EXECUTION PERMISSIONS
-- ============================================================================

ALTER FUNCTION public.create_trainer_booking(
    uuid,
    timestamptz,
    uuid,
    text
) OWNER TO postgres;


REVOKE ALL ON FUNCTION public.create_trainer_booking(
    uuid,
    timestamptz,
    uuid,
    text
) FROM PUBLIC, anon, service_role;


GRANT EXECUTE ON FUNCTION public.create_trainer_booking(
    uuid,
    timestamptz,
    uuid,
    text
) TO authenticated;


-- ============================================================================
-- 4. REMOVE DIRECT AUTHENTICATED BOOKING INSERTS
-- ============================================================================

DROP POLICY IF EXISTS
    "Gym-goers can create their own bookings"
ON public.trainer_bookings;


-- Revoke table-level INSERT privileges.
REVOKE INSERT ON TABLE public.trainer_bookings
FROM PUBLIC, anon, authenticated;


-- Also remove any column-level INSERT privileges, if present.
DO $block$
DECLARE
    v_columns text;
BEGIN
    SELECT pg_catalog.string_agg(
        pg_catalog.format('%I', a.attname),
        ', ' ORDER BY a.attnum
    )
    INTO v_columns
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = 'public.trainer_bookings'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_columns IS NOT NULL THEN
        EXECUTE pg_catalog.format(
            'REVOKE INSERT (%s) ON TABLE public.trainer_bookings FROM PUBLIC, anon, authenticated',
            v_columns
        );
    END IF;
END;
$block$;


-- ============================================================================
-- 5. RESTRICT AUTHENTICATED UPDATE TO BOOKING STATUS
-- ============================================================================

-- Remove broad table-level UPDATE privileges.
REVOKE UPDATE ON TABLE public.trainer_bookings
FROM PUBLIC, anon, authenticated;


-- Remove any existing column-level UPDATE grants.
DO $block$
DECLARE
    v_columns text;
BEGIN
    SELECT pg_catalog.string_agg(
        pg_catalog.format('%I', a.attname),
        ', ' ORDER BY a.attnum
    )
    INTO v_columns
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = 'public.trainer_bookings'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_columns IS NOT NULL THEN
        EXECUTE pg_catalog.format(
            'REVOKE UPDATE (%s) ON TABLE public.trainer_bookings FROM PUBLIC, anon, authenticated',
            v_columns
        );
    END IF;
END;
$block$;


-- Trainers may update only the status column.
GRANT UPDATE (status)
ON TABLE public.trainer_bookings
TO authenticated;


-- ============================================================================
-- 6. REMOVE DIRECT GYM-GOER UPDATE POLICY
--
-- Gym-Goers must use the secure cancellation and rescheduling RPCs.
-- This prevents direct status changes from bypassing financial workflows.
-- ============================================================================

DROP POLICY IF EXISTS
    "Gym-goers can update their own bookings"
ON public.trainer_bookings;


-- ============================================================================
-- 7. RESTRICT TRAINER UPDATE POLICY
--
-- Trainers may update only their own assigned booking rows.
-- Column privileges further restrict the update to status.
-- The existing transition trigger validates allowed state changes.
-- ============================================================================

DROP POLICY IF EXISTS
    "Trainers can update their assigned bookings"
ON public.trainer_bookings;


CREATE POLICY "Trainers can update their assigned bookings"
ON public.trainer_bookings
FOR UPDATE
TO authenticated

USING (
    auth.uid() = trainer_id
    AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
    )
)

WITH CHECK (
    auth.uid() = trainer_id
    AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
    )
);


-- ============================================================================
-- 8. DOCUMENT THE SECURE BOOKING ENTRY POINT
-- ============================================================================

COMMENT ON FUNCTION public.create_trainer_booking(
    uuid,
    timestamptz,
    uuid,
    text
) IS
'Creates a Gym-Goer booking using an active, published trainer session rate. Derives trainer, price, currency and duration server-side. Enforces idempotency.';


COMMIT;
