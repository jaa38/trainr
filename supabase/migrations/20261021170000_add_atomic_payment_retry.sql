
BEGIN;

-- Atomically replace a payment attempt only after the trusted server has
-- independently verified that Paystack reports the exact transaction failed.
--
-- This RPC is intentionally restricted to service_role. The Edge Function
-- must authenticate the gym-goer and verify the original transaction first.

CREATE OR REPLACE FUNCTION public.retry_failed_booking_payment(
    p_old_payment_id uuid,
    p_gym_goer_id uuid,
    p_expected_reference text,
    p_expected_amount numeric,
    p_expected_currency text,
    p_verified_provider_status text,
    p_new_idempotency_key uuid
)
RETURNS TABLE (
    payment_id uuid,
    booking_id uuid,
    provider_reference text,
    payment_status text,
    was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_booking_id uuid;
    v_booking public.trainer_bookings%ROWTYPE;
    v_old_payment public.booking_payments%ROWTYPE;
    v_replacement public.booking_payments%ROWTYPE;
BEGIN
    IF p_old_payment_id IS NULL
       OR p_gym_goer_id IS NULL
       OR p_new_idempotency_key IS NULL
       OR p_expected_reference IS NULL
       OR p_expected_amount IS NULL
       OR p_expected_amount <= 0
       OR p_expected_currency IS DISTINCT FROM 'NGN'
       OR p_verified_provider_status IS DISTINCT FROM 'failed'
    THEN
        RAISE EXCEPTION 'Payment retry is not eligible';
    END IF;

    -- Read the booking ID without locking the payment row.
    SELECT bp.booking_id
    INTO v_booking_id
    FROM public.booking_payments AS bp
    WHERE bp.id = p_old_payment_id
      AND bp.gym_goer_id = p_gym_goer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found or not accessible';
    END IF;

    -- Match the booking-first lock order used by reservation and confirmation.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_booking_id::text, 0)
    );

    SELECT tb.*
    INTO v_booking
    FROM public.trainer_bookings AS tb
    WHERE tb.id = v_booking_id
      AND tb.gym_goer_id = p_gym_goer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found or not accessible';
    END IF;

    SELECT bp.*
    INTO v_old_payment
    FROM public.booking_payments AS bp
    WHERE bp.id = p_old_payment_id
      AND bp.gym_goer_id = p_gym_goer_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_old_payment.booking_id IS DISTINCT FROM v_booking_id
    THEN
        RAISE EXCEPTION 'Payment changed or is no longer accessible';
    END IF;

    -- Validate the original payment before handling a repeated request.
    IF v_old_payment.provider IS DISTINCT FROM 'paystack'
       OR v_old_payment.provider_reference
          IS DISTINCT FROM p_expected_reference
       OR v_old_payment.amount IS DISTINCT FROM p_expected_amount
       OR v_old_payment.currency IS DISTINCT FROM p_expected_currency
       OR v_old_payment.currency IS DISTINCT FROM 'NGN'
    THEN
        RAISE EXCEPTION
            'Stored payment does not match the verified transaction';
    END IF;

    -- Repeated requests return the same replacement when the idempotency key
    -- matches the replacement already linked to this original attempt.
    IF v_old_payment.superseded_by IS NOT NULL THEN
        SELECT bp.*
        INTO v_replacement
        FROM public.booking_payments AS bp
        WHERE bp.id = v_old_payment.superseded_by
          AND bp.booking_id = v_booking_id
          AND bp.gym_goer_id = p_gym_goer_id
          AND bp.idempotency_key = p_new_idempotency_key;

        IF FOUND THEN
            -- Never return a replacement that has itself been superseded.
            IF v_replacement.superseded_by IS NOT NULL THEN
                RAISE EXCEPTION
                    'Replacement payment attempt has already been superseded';
            END IF;

            -- Failed replacements require reconciliation, not checkout.
            IF v_replacement.status NOT IN ('pending', 'successful') THEN
                RAISE EXCEPTION
                    'Replacement payment attempt requires reconciliation';
            END IF;

            RETURN QUERY
            SELECT
                v_replacement.id,
                v_replacement.booking_id,
                v_replacement.provider_reference,
                v_replacement.status,
                false;
            RETURN;
        END IF;

        RAISE EXCEPTION 'Payment attempt has already been superseded';
    END IF;

    -- Verification may already have changed pending -> failed.
    -- Accept either state, but reject successful or otherwise ineligible states.
    IF v_old_payment.status NOT IN ('pending', 'failed') THEN
        RAISE EXCEPTION 'Payment is not eligible for retry';
    END IF;

    IF v_booking.status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Booking is not eligible for payment retry';
    END IF;

    -- Do not retry when a different payment for this booking has succeeded.
    IF EXISTS (
        SELECT 1
        FROM public.booking_payments AS bp
        WHERE bp.booking_id = v_booking_id
          AND bp.status = 'successful'
          AND bp.id <> v_old_payment.id
    ) THEN
        RAISE EXCEPTION 'Another payment has already succeeded';
    END IF;

    -- Reject an idempotency key already assigned to another attempt.
    SELECT bp.*
    INTO v_replacement
    FROM public.booking_payments AS bp
    WHERE bp.gym_goer_id = p_gym_goer_id
      AND bp.idempotency_key = p_new_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Idempotency key already belongs to another attempt';
    END IF;

    IF v_booking.currency IS DISTINCT FROM 'NGN'
       OR v_booking.session_rate IS DISTINCT FROM p_expected_amount
    THEN
        RAISE EXCEPTION 'Current booking amount or currency has changed';
    END IF;

    -- If verification has already recorded failure, preserve that state.
    -- Otherwise, transition pending -> failed within this transaction.
    IF v_old_payment.status = 'pending' THEN
        UPDATE public.booking_payments AS bp
        SET
            status = 'failed',
            updated_at = pg_catalog.now()
        WHERE bp.id = v_old_payment.id
          AND bp.status = 'pending'
          AND bp.superseded_by IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Payment state changed during retry';
        END IF;
    END IF;

    -- Create the replacement with a fresh provider reference.
    INSERT INTO public.booking_payments (
        booking_id,
        gym_goer_id,
        amount,
        currency,
        provider,
        provider_reference,
        status,
        idempotency_key,
        initialization_status
    )
    VALUES (
        v_booking_id,
        p_gym_goer_id,
        v_old_payment.amount,
        v_old_payment.currency,
        'paystack',
        'trainr_' || replace(
            pg_catalog.gen_random_uuid()::text,
            '-',
            ''
        ),
        'pending',
        p_new_idempotency_key,
        'not_started'
    )
    RETURNING * INTO v_replacement;

    -- Link the old attempt to the replacement atomically.
    UPDATE public.booking_payments AS bp
    SET
        superseded_by = v_replacement.id,
        superseded_at = pg_catalog.now(),
        supersession_reason = 'verified_provider_failure',
        updated_at = pg_catalog.now()
    WHERE bp.id = v_old_payment.id
      AND bp.superseded_by IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment attempt changed during retry';
    END IF;

    RETURN QUERY
    SELECT
        v_replacement.id,
        v_replacement.booking_id,
        v_replacement.provider_reference,
        v_replacement.status,
        true;
END;
$function$;

REVOKE ALL ON FUNCTION public.retry_failed_booking_payment(
    uuid, uuid, text, numeric, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.retry_failed_booking_payment(
    uuid, uuid, text, numeric, text, text, uuid
) TO service_role;

COMMIT;
