-- TRAINR Sprint 11A
-- Migration 5: secure cancellation and trainer-controlled refund initiation
--
-- IMPORTANT:
-- 1. This migration depends on 20261122103000_cancellation_refund_schema.sql.
-- 2. It is a LOCAL DRAFT. Do not apply to the remote Supabase project yet.
-- 3. Cancellation notification routing is corrected in the following
--    notification migration. Do not expose the RPC to the app until that
--    migration has been reviewed and applied together with this workflow.
-- 4. Paystack refund execution is deliberately NOT implemented here.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Capture the active cancellation policy at booking creation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_trainer_booking(
    p_session_rate_id uuid,
    p_scheduled_start timestamptz,
    p_idempotency_key uuid,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_gym_goer_id uuid := auth.uid();
    v_role text;
    v_notes text;
    v_request private.trainer_booking_requests%ROWTYPE;
    v_rate record;
    v_policy public.cancellation_policies%ROWTYPE;
    v_policy_snapshot jsonb;
    v_booking_id uuid;
    v_scheduled_end timestamptz;
    v_now timestamptz;
BEGIN
    IF v_gym_goer_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT profile.role
    INTO v_role
    FROM public.profiles AS profile
    WHERE profile.id = v_gym_goer_id
    FOR SHARE;

    IF v_role IS DISTINCT FROM 'gym_goer' THEN
        RAISE EXCEPTION 'Gym-goer account required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_session_rate_id IS NULL
       OR p_scheduled_start IS NULL
       OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION
            'A session rate, start time and idempotency key are required.'
            USING ERRCODE = '22023';
    END IF;

    v_notes := NULLIF(pg_catalog.btrim(COALESCE(p_notes, '')), '');

    IF v_notes IS NOT NULL
       AND pg_catalog.char_length(v_notes) > 1000 THEN
        RAISE EXCEPTION 'Booking notes cannot exceed 1000 characters.'
            USING ERRCODE = '22023';
    END IF;

    -- Reserve the idempotency key before time-sensitive validation. A retry
    -- returns the original booking even if its start time has since passed.
    INSERT INTO private.trainer_booking_requests (
        gym_goer_id,
        idempotency_key,
        session_rate_id,
        scheduled_start,
        notes
    )
    VALUES (
        v_gym_goer_id,
        p_idempotency_key,
        p_session_rate_id,
        p_scheduled_start,
        v_notes
    )
    ON CONFLICT (gym_goer_id, idempotency_key) DO NOTHING;

    SELECT request.*
    INTO v_request
    FROM private.trainer_booking_requests AS request
    WHERE request.gym_goer_id = v_gym_goer_id
      AND request.idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unable to reserve the booking request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_request.session_rate_id IS DISTINCT FROM p_session_rate_id
       OR v_request.scheduled_start IS DISTINCT FROM p_scheduled_start
       OR v_request.notes IS DISTINCT FROM v_notes THEN
        RAISE EXCEPTION
            'This idempotency key has already been used for a different request.'
            USING ERRCODE = '22023';
    END IF;

    IF v_request.booking_id IS NOT NULL THEN
        RETURN v_request.booking_id;
    END IF;

    v_now := pg_catalog.clock_timestamp();

    IF NOT pg_catalog.isfinite(p_scheduled_start)
       OR p_scheduled_start <= v_now THEN
        RAISE EXCEPTION
            'The selected session must have a finite future start time.'
            USING ERRCODE = '22023';
    END IF;

    SELECT
        rate.id,
        rate.trainer_id,
        rate.session_type,
        rate.session_duration_minutes,
        rate.session_rate,
        rate.currency,
        rate.training_format
    INTO v_rate
    FROM public.trainer_session_rates AS rate
    JOIN public.profiles AS trainer_profile
        ON trainer_profile.id = rate.trainer_id
    JOIN public.trainer_profiles AS trainer_details
        ON trainer_details.user_id = rate.trainer_id
    WHERE rate.id = p_session_rate_id
      AND rate.status = 'active'
      AND rate.requires_confirmation = false
      AND rate.session_type IS NOT NULL
      AND rate.training_format IS NOT NULL
      AND trainer_profile.role = 'trainer'
      AND trainer_profile.onboarding_completed = true
      AND trainer_details.is_published = true
    FOR SHARE OF rate, trainer_profile, trainer_details;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'This session rate is unavailable. Refresh the trainer profile and try again.'
            USING ERRCODE = '22023';
    END IF;

    SELECT policy.*
    INTO v_policy
    FROM public.cancellation_policies AS policy
    WHERE policy.status = 'active'
      AND policy.effective_from <= v_now
      AND (
          policy.effective_until IS NULL
          OR policy.effective_until > v_now
      )
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active cancellation policy is configured.'
            USING ERRCODE = '55000';
    END IF;

    SELECT pg_catalog.jsonb_build_object(
        'policy_id', v_policy.id,
        'version_number', v_policy.version_number,
        'policy_name', v_policy.policy_name,
        'captured_at', v_now,
        'rules', COALESCE(
            pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'initiator', rule.cancellation_initiator,
                    'window_key', rule.window_key,
                    'minimum_hours_before', rule.minimum_hours_before,
                    'maximum_hours_before', rule.maximum_hours_before,
                    'minimum_inclusive', rule.minimum_inclusive,
                    'maximum_inclusive', rule.maximum_inclusive,
                    'refund_percentage', rule.refund_percentage
                )
                ORDER BY
                    rule.cancellation_initiator,
                    rule.window_key
            ),
            '[]'::jsonb
        )
    )
    INTO v_policy_snapshot
    FROM public.cancellation_policy_rules AS rule
    WHERE rule.policy_id = v_policy.id;

    IF pg_catalog.jsonb_array_length(v_policy_snapshot -> 'rules') = 0 THEN
        RAISE EXCEPTION 'The active cancellation policy has no rules.'
            USING ERRCODE = '55000';
    END IF;

    v_scheduled_end := p_scheduled_start
        + pg_catalog.make_interval(
            mins => v_rate.session_duration_minutes
        );

    IF NOT pg_catalog.isfinite(v_scheduled_end)
       OR v_scheduled_end <= p_scheduled_start THEN
        RAISE EXCEPTION 'The calculated session end time is invalid.'
            USING ERRCODE = '22023';
    END IF;

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
        session_duration_minutes,
        cancellation_policy_version_id,
        cancellation_policy_snapshot
    )
    VALUES (
        v_gym_goer_id,
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
        v_rate.session_duration_minutes,
        v_policy.id,
        v_policy_snapshot
    )
    RETURNING id INTO v_booking_id;

    UPDATE private.trainer_booking_requests
    SET booking_id = v_booking_id
    WHERE gym_goer_id = v_gym_goer_id
      AND idempotency_key = p_idempotency_key;

    RETURN v_booking_id;
END;
$function$;

ALTER FUNCTION public.create_trainer_booking(
    uuid,
    timestamptz,
    uuid,
    text
)
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.create_trainer_booking(uuid, timestamptz, uuid, text)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
    public.create_trainer_booking(uuid, timestamptz, uuid, text)
TO authenticated;

COMMENT ON FUNCTION
    public.create_trainer_booking(uuid, timestamptz, uuid, text)
IS
    'Creates an idempotent booking from an active published trainer rate and snapshots the active cancellation policy and rules at booking creation.';


-- ---------------------------------------------------------------------------
-- 2. Require a matching cancellation record for every cancelled transition
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_trainer_booking_transitions()
RETURNS trigger
LANGUAGE plpgsql
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

        IF OLD.status = 'pending'
           AND NEW.status IN ('confirmed', 'declined') THEN
            RETURN NEW;
        END IF;

        IF OLD.status = 'confirmed'
           AND NEW.status = 'completed'
           AND OLD.scheduled_end <= pg_catalog.statement_timestamp() THEN
            RETURN NEW;
        END IF;

        -- A trainer may cancel a confirmed session only before its
        -- scheduled end. The secure RPC must create the matching record first.
        IF OLD.status = 'confirmed'
           AND NEW.status = 'cancelled'
           AND OLD.scheduled_end > pg_catalog.statement_timestamp() THEN

            PERFORM 1
            FROM public.booking_cancellations AS cancellation
            WHERE cancellation.booking_id = OLD.id
              AND cancellation.cancelled_by = v_user_id
              AND cancellation.cancelled_by_role = 'trainer'
              AND cancellation.cancellation_type = 'trainer_initiated'
              AND cancellation.cancelled_at <= pg_catalog.statement_timestamp()
              AND cancellation.cancelled_at < OLD.scheduled_end;

            IF FOUND THEN
                RETURN NEW;
            END IF;
        END IF;

        RAISE EXCEPTION
            'This booking status transition is not permitted for trainers.'
            USING ERRCODE = '23514';
    END IF;

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
              AND cancellation.cancelled_at <= pg_catalog.statement_timestamp()
              AND cancellation.cancelled_at < OLD.scheduled_start;

            IF FOUND THEN
                RETURN NEW;
            END IF;
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

-- Trainers regain status-only updates after the stricter transition trigger
-- is installed. The trigger still validates each permitted transition.
GRANT UPDATE (status)
ON TABLE public.trainer_bookings
TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. Secure cancellation RPC for the booking participant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_trainer_booking(
    p_booking_id uuid,
    p_cancellation_reason text,
    p_cancellation_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_role text;
    v_booking public.trainer_bookings%ROWTYPE;
    v_policy_id uuid;
    v_policy_snapshot jsonb;
    v_cancelled_at timestamptz := pg_catalog.statement_timestamp();
    v_hours_before numeric;
    v_refund_percentage numeric(5, 2) := 0;
    v_payment public.booking_payments%ROWTYPE;
    v_has_successful_payment boolean := false;
    v_refund_amount numeric(20, 6) := 0;
    v_cancellation_id uuid;
    v_reason text;
    v_comments text;
    v_matching_rule_count integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.role
    INTO v_user_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_user_role IS NULL
       OR v_user_role NOT IN ('gym_goer', 'trainer') THEN
        RAISE EXCEPTION
            'Only a booking participant can cancel this booking.'
            USING ERRCODE = '42501';
    END IF;

    -- Validate and normalise the cancellation reason and comments.
    v_reason := NULLIF(
        pg_catalog.btrim(COALESCE(p_cancellation_reason, '')),
        ''
    );

    v_comments := NULLIF(
        pg_catalog.btrim(COALESCE(p_cancellation_comments, '')),
        ''
    );

    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'A cancellation reason is required.'
            USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.char_length(v_reason) > 500 THEN
        RAISE EXCEPTION
            'Cancellation reason cannot exceed 500 characters.'
            USING ERRCODE = '22023';
    END IF;

    IF v_comments IS NOT NULL
       AND pg_catalog.char_length(v_comments) > 1000 THEN
        RAISE EXCEPTION
            'Cancellation comments cannot exceed 1000 characters.'
            USING ERRCODE = '22023';
    END IF;

    IF p_booking_id IS NULL THEN
        RAISE EXCEPTION 'A booking ID is required.'
            USING ERRCODE = '22023';
    END IF;

    -- Serialize cancellation with payment confirmation and retry operations.
    -- All operations acquire the booking-level advisory lock before locking
    -- the booking row.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_booking_id::text, 0)
    );

    -- Lock the booking before accessing its payment or cancellation records.
    SELECT booking.*
    INTO v_booking
    FROM public.trainer_bookings AS booking
    WHERE booking.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Capture the actual cancellation instant after acquiring the booking
    -- lock.
    v_cancelled_at := pg_catalog.clock_timestamp();

    IF (
        v_user_role = 'gym_goer'
        AND v_booking.gym_goer_id <> v_user_id
    )
    OR (
        v_user_role = 'trainer'
        AND v_booking.trainer_id <> v_user_id
    ) THEN
        RAISE EXCEPTION
            'You are not authorised to cancel this booking.'
            USING ERRCODE = '42501';
    END IF;

    IF v_booking.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION
            'Only pending or confirmed bookings can be cancelled.'
            USING ERRCODE = '23514';
    END IF;

    IF v_user_role = 'gym_goer'
       AND v_booking.scheduled_start <= v_cancelled_at THEN
        RAISE EXCEPTION
            'Gym-goers can only cancel before the session starts.'
            USING ERRCODE = '23514';
    END IF;

    IF v_user_role = 'trainer' THEN
        IF v_booking.status <> 'confirmed' THEN
            RAISE EXCEPTION
                'Trainers can only cancel confirmed bookings.'
                USING ERRCODE = '23514';
        END IF;

        IF v_booking.scheduled_end <= v_cancelled_at THEN
            RAISE EXCEPTION
                'Trainers can only cancel before the session ends.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.booking_cancellations AS existing_cancellation
        WHERE existing_cancellation.booking_id = v_booking.id
    ) THEN
        RAISE EXCEPTION
            'This booking already has a cancellation record.'
            USING ERRCODE = '23505';
    END IF;

    -- Use the booking-time policy snapshot. Legacy bookings created before
    -- snapshot support receive an explicitly labelled active-policy fallback.
    v_policy_id := v_booking.cancellation_policy_version_id;
    v_policy_snapshot := v_booking.cancellation_policy_snapshot;

    IF v_policy_snapshot IS NULL THEN

        SELECT policy.id
        INTO v_policy_id
        FROM public.cancellation_policies AS policy
        WHERE policy.status = 'active'
          AND policy.effective_from <= v_cancelled_at
          AND (
              policy.effective_until IS NULL
              OR policy.effective_until > v_cancelled_at
          )
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No cancellation policy is available for this legacy booking.'
                USING ERRCODE = '55000';
        END IF;

        SELECT pg_catalog.jsonb_build_object(
            'policy_id', v_policy_id,
            'version_number', policy.version_number,
            'policy_name', policy.policy_name,
            'captured_at', v_cancelled_at,
            'legacy_fallback_at_cancellation', true,
            'rules', COALESCE(
                pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'initiator', rule.cancellation_initiator,
                        'window_key', rule.window_key,
                        'minimum_hours_before', rule.minimum_hours_before,
                        'maximum_hours_before', rule.maximum_hours_before,
                        'minimum_inclusive', rule.minimum_inclusive,
                        'maximum_inclusive', rule.maximum_inclusive,
                        'refund_percentage', rule.refund_percentage
                    )
                    ORDER BY
                        rule.cancellation_initiator,
                        rule.window_key
                ),
                '[]'::jsonb
            )
        )
        INTO v_policy_snapshot
        FROM public.cancellation_policies AS policy
        LEFT JOIN public.cancellation_policy_rules AS rule
            ON rule.policy_id = policy.id
        WHERE policy.id = v_policy_id
        GROUP BY policy.id;

        IF pg_catalog.jsonb_array_length(
            v_policy_snapshot -> 'rules'
        ) = 0 THEN
            RAISE EXCEPTION
                'The fallback cancellation policy has no rules.'
                USING ERRCODE = '55000';
        END IF;
    END IF;

    v_hours_before :=
        (
            EXTRACT(
                EPOCH FROM (
                    v_booking.scheduled_start - v_cancelled_at
                )
            ) / 3600
        )::numeric(12, 4);

    IF v_user_role = 'gym_goer'
       AND v_booking.scheduled_start <= v_cancelled_at THEN

        v_refund_percentage := 0;

    ELSE

        SELECT
            pg_catalog.count(*),
            pg_catalog.min(
                (rule.value ->> 'refund_percentage')::numeric(5, 2)
            )
        INTO
            v_matching_rule_count,
            v_refund_percentage
        FROM pg_catalog.jsonb_array_elements(
            v_policy_snapshot -> 'rules'
        ) AS rule(value)
        WHERE rule.value ->> 'initiator' = v_user_role
          AND (
              rule.value ->> 'minimum_hours_before' IS NULL
              OR CASE
                  WHEN COALESCE(
                      (rule.value ->> 'minimum_inclusive')::boolean,
                      true
                  )
                  THEN
                      v_hours_before >=
                      (rule.value ->> 'minimum_hours_before')::numeric
                  ELSE
                      v_hours_before >
                      (rule.value ->> 'minimum_hours_before')::numeric
              END
          )
          AND (
              rule.value ->> 'maximum_hours_before' IS NULL
              OR CASE
                  WHEN COALESCE(
                      (rule.value ->> 'maximum_inclusive')::boolean,
                      false
                  )
                  THEN
                      v_hours_before <=
                      (rule.value ->> 'maximum_hours_before')::numeric
                  ELSE
                      v_hours_before <
                      (rule.value ->> 'maximum_hours_before')::numeric
              END
          );

        IF v_matching_rule_count <> 1
           OR v_refund_percentage IS NULL THEN
            RAISE EXCEPTION
                'The booking policy must define exactly one rule for this cancellation window.'
                USING ERRCODE = '55000';
        END IF;
    END IF;

    -- Lock the one successful payment, if any. The original payment status
    -- is never changed by this workflow.
    SELECT payment.*
    INTO v_payment
    FROM public.booking_payments AS payment
    WHERE payment.booking_id = v_booking.id
      AND payment.gym_goer_id = v_booking.gym_goer_id
      AND payment.status = 'successful'
      AND payment.superseded_by IS NULL
    FOR UPDATE;

    v_has_successful_payment := FOUND;

    IF v_has_successful_payment
       AND v_payment.currency IS DISTINCT FROM v_booking.currency THEN
        RAISE EXCEPTION
            'The successful payment currency does not match the booking currency.'
            USING ERRCODE = '23514';
    END IF;

    IF v_has_successful_payment
       AND v_refund_percentage > 0 THEN

        -- Current supported trainer pricing currencies (NGN/GBP/USD/EUR)
        -- use two fractional digits. The amount is stored at six-decimal
        -- scale; provider-specific minor-unit handling remains part of
        -- integration.
        v_refund_amount := pg_catalog.round(
            v_payment.amount * v_refund_percentage / 100,
            2
        );

    ELSE
        v_refund_percentage := 0;
        v_refund_amount := 0;
    END IF;

    -- A tiny positive payment can round to zero at the currency precision.
    -- The cancellation schema represents that as no eligible refund.
    IF v_refund_amount <= 0 THEN
        v_refund_percentage := 0;
        v_refund_amount := 0;
    END IF;

    INSERT INTO public.booking_cancellations (
        booking_id,
        cancelled_by,
        cancelled_by_role,
        cancellation_reason,
        cancellation_comments,
        cancellation_type,
        policy_version_id,
        policy_snapshot,
        cancelled_at,
        hours_before_session,
        refund_eligible,
        refund_percentage,
        eligible_refund_amount,
        currency,
        payment_id
    )
    VALUES (
        v_booking.id,
        v_user_id,
        v_user_role,
        v_reason,
        v_comments,
        CASE
            WHEN v_user_role = 'trainer'
                THEN 'trainer_initiated'
            ELSE 'gym_goer_initiated'
        END,
        v_policy_id,
        v_policy_snapshot,
        v_cancelled_at,
        v_hours_before,
        v_has_successful_payment AND v_refund_amount > 0,
        v_refund_percentage,
        v_refund_amount,
        v_booking.currency,
        CASE
            WHEN v_has_successful_payment AND v_refund_amount > 0
                THEN v_payment.id
            ELSE NULL
        END
    )
    RETURNING id INTO v_cancellation_id;

    UPDATE public.trainer_bookings
    SET
        status = 'cancelled',
        updated_at = v_cancelled_at
    WHERE id = v_booking.id;

    RETURN v_cancellation_id;
END;
$function$;

ALTER FUNCTION public.cancel_trainer_booking(uuid, text, text)
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.cancel_trainer_booking(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

-- Remove the old one-argument entry point. The replacement requires a reason.
DROP FUNCTION IF EXISTS public.cancel_trainer_booking(uuid);

GRANT EXECUTE ON FUNCTION
    public.cancel_trainer_booking(uuid, text, text)
TO authenticated;

COMMENT ON FUNCTION
    public.cancel_trainer_booking(uuid, text, text)
IS
    'Atomically records a participant cancellation, calculates refund eligibility from the booking policy snapshot and updates booking status. It does not initiate provider refunds.';


-- ---------------------------------------------------------------------------
-- 4. Trainer-controlled refund initiation (no provider execution)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.initiate_booking_refund(
    p_cancellation_id uuid,
    p_refund_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_role text;
    v_cancellation public.booking_cancellations%ROWTYPE;
    v_booking public.trainer_bookings%ROWTYPE;
    v_booking_id uuid;
    v_payment public.booking_payments%ROWTYPE;
    v_reason text;
    v_refund_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.role
    INTO v_user_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_user_role IS DISTINCT FROM 'trainer' THEN
        RAISE EXCEPTION
            'Only the booking trainer can initiate a refund request.'
            USING ERRCODE = '42501';
    END IF;

    v_reason := NULLIF(
        pg_catalog.btrim(COALESCE(p_refund_reason, '')),
        ''
    );

    IF p_cancellation_id IS NULL
       OR v_reason IS NULL
       OR pg_catalog.char_length(v_reason) > 500 THEN
        RAISE EXCEPTION
            'A cancellation ID and refund reason (up to 500 characters) are required.'
            USING ERRCODE = '22023';
    END IF;

    -- Read the booking ID first without taking a row lock. All payment and
    -- cancellation workflows serialize on the booking-level advisory lock.
    SELECT cancellation.booking_id
    INTO v_booking_id
    FROM public.booking_cancellations AS cancellation
    WHERE cancellation.id = p_cancellation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cancellation record not found.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Keep the same lock order as payment confirmation, payment retry and
    -- booking cancellation: advisory lock -> booking row -> related rows.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_booking_id::text, 0)
    );

    SELECT booking.*
    INTO v_booking
    FROM public.trainer_bookings AS booking
    WHERE booking.id = v_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Lock the cancellation only after the booking row.
    SELECT cancellation.*
    INTO v_cancellation
    FROM public.booking_cancellations AS cancellation
    WHERE cancellation.id = p_cancellation_id
      AND cancellation.booking_id = v_booking.id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Cancellation record not found for this booking.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.trainer_id <> v_user_id THEN
        RAISE EXCEPTION
            'You are not authorised to initiate a refund for this booking.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT v_cancellation.refund_eligible
       OR v_cancellation.eligible_refund_amount <= 0
       OR v_cancellation.payment_id IS NULL THEN
        RAISE EXCEPTION
            'This cancellation has no eligible refund.'
            USING ERRCODE = '23514';
    END IF;

    SELECT payment.*
    INTO v_payment
    FROM public.booking_payments AS payment
    WHERE payment.id = v_cancellation.payment_id
      AND payment.booking_id = v_booking.id
      AND payment.status = 'successful'
      AND payment.superseded_by IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The original successful payment is no longer eligible for refund initiation.'
            USING ERRCODE = '23514';
    END IF;

    IF v_cancellation.currency IS DISTINCT FROM v_payment.currency
       OR v_booking.currency IS DISTINCT FROM v_payment.currency THEN
        RAISE EXCEPTION
            'The cancellation, booking and payment currencies must match.'
            USING ERRCODE = '23514';
    END IF;

    IF v_cancellation.eligible_refund_amount > v_payment.amount THEN
        RAISE EXCEPTION
            'The calculated refund exceeds the original successful payment.'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.payment_refunds AS existing_refund
        WHERE existing_refund.cancellation_id = v_cancellation.id
    ) THEN

        SELECT existing_refund.id
        INTO v_refund_id
        FROM public.payment_refunds AS existing_refund
        WHERE existing_refund.cancellation_id = v_cancellation.id
          AND existing_refund.booking_id = v_booking.id
          AND existing_refund.payment_id = v_payment.id
          AND existing_refund.original_amount = v_payment.amount
          AND existing_refund.refund_percentage =
              v_cancellation.refund_percentage
          AND existing_refund.refund_amount =
              v_cancellation.eligible_refund_amount
          AND existing_refund.currency = v_payment.currency
          AND existing_refund.provider = v_payment.provider;

        IF v_refund_id IS NULL THEN
            RAISE EXCEPTION
                'An existing refund request does not match the cancellation and payment records.'
                USING ERRCODE = '23514';
        END IF;

        RETURN v_refund_id;
    END IF;

    INSERT INTO public.payment_refunds (
        cancellation_id,
        booking_id,
        payment_id,
        initiated_by,
        refund_reason,
        original_amount,
        refund_percentage,
        refund_amount,
        currency,
        refund_status,
        provider
    )
    VALUES (
        v_cancellation.id,
        v_booking.id,
        v_payment.id,
        v_user_id,
        v_reason,
        v_payment.amount,
        v_cancellation.refund_percentage,
        v_cancellation.eligible_refund_amount,
        v_payment.currency,
        'awaiting_review',
        v_payment.provider
    )
    RETURNING id INTO v_refund_id;

    INSERT INTO public.refund_audit_logs (
        refund_id,
        actor_id,
        action,
        previous_status,
        new_status,
        remarks
    )
    VALUES (
        v_refund_id,
        v_user_id,
        'refund_request_created',
        NULL,
        'awaiting_review',
        v_reason
    );

    RETURN v_refund_id;
END;
$function$;

ALTER FUNCTION public.initiate_booking_refund(uuid, text)
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.initiate_booking_refund(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.initiate_booking_refund(uuid, text)
TO authenticated;

COMMENT ON FUNCTION
    public.initiate_booking_refund(uuid, text)
IS
    'Allows the booking trainer to create an auditable refund request for the server-calculated eligible amount. Does not contact Paystack or mark a refund completed.';

COMMIT;
