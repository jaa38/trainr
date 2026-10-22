
BEGIN;

-- Record a failure only after the Edge Function has independently verified
-- the Paystack transaction. Serialize this state transition with payment
-- confirmation, reservation, retry, and webhook processing.

CREATE OR REPLACE FUNCTION public.record_verified_payment_failure(
    p_payment_id uuid,
    p_expected_reference text,
    p_expected_amount numeric,
    p_expected_currency text
)
RETURNS TABLE (
    payment_id uuid,
    payment_status text,
    superseded_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_booking_id uuid;
    v_locked_booking_id uuid;
    v_payment public.booking_payments%ROWTYPE;
BEGIN
    IF p_payment_id IS NULL
       OR p_expected_reference IS NULL
       OR p_expected_amount IS NULL
       OR p_expected_amount <= 0
       OR p_expected_currency IS DISTINCT FROM 'NGN'
    THEN
        RAISE EXCEPTION 'Verified payment details are invalid';
    END IF;

    -- Read the booking ID without locking the payment row.
    SELECT bp.booking_id
    INTO v_booking_id
    FROM public.booking_payments AS bp
    WHERE bp.id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    -- Use the same booking-first lock order as reservation and confirmation.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_booking_id::text, 0)
    );

    SELECT tb.id
    INTO v_locked_booking_id
    FROM public.trainer_bookings AS tb
    WHERE tb.id = v_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    SELECT bp.*
    INTO v_payment
    FROM public.booking_payments AS bp
    WHERE bp.id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    IF v_payment.booking_id IS DISTINCT FROM v_booking_id THEN
        RAISE EXCEPTION 'Payment booking changed during verification';
    END IF;

    -- Ensure the verified transaction still matches the stored payment.
    IF v_payment.provider IS DISTINCT FROM 'paystack'
       OR v_payment.provider_reference
          IS DISTINCT FROM p_expected_reference
       OR v_payment.amount IS DISTINCT FROM p_expected_amount
       OR v_payment.currency IS DISTINCT FROM p_expected_currency
    THEN
        RAISE EXCEPTION 'Verified transaction details do not match';
    END IF;

    -- A superseded attempt must never be changed by a stale verification.
    IF v_payment.superseded_by IS NOT NULL THEN
        RETURN QUERY
        SELECT v_payment.id, v_payment.status, v_payment.superseded_by;
        RETURN;
    END IF;

    -- Preserve successful payments if another operation confirmed them first.
    IF v_payment.status = 'successful' THEN
        RETURN QUERY
        SELECT v_payment.id, v_payment.status, v_payment.superseded_by;
        RETURN;
    END IF;

    -- Make the transition idempotent.
    IF v_payment.status = 'failed' THEN
        RETURN QUERY
        SELECT v_payment.id, v_payment.status, v_payment.superseded_by;
        RETURN;
    END IF;

    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'Payment is not eligible for failure transition';
    END IF;

    UPDATE public.booking_payments AS bp
    SET
        status = 'failed',
        updated_at = pg_catalog.now()
    WHERE bp.id = p_payment_id
      AND bp.status = 'pending'
      AND bp.superseded_by IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment status changed during failure transition';
    END IF;

    RETURN QUERY
    SELECT bp.id, bp.status, bp.superseded_by
    FROM public.booking_payments AS bp
    WHERE bp.id = p_payment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_verified_payment_failure(
    uuid, text, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_verified_payment_failure(
    uuid, text, numeric, text
) TO service_role;

COMMIT;
