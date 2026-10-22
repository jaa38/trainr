
BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
    p_payment_id uuid,
    p_expected_reference text,
    p_expected_amount numeric,
    p_expected_currency text
)
RETURNS TABLE (
    payment_id uuid,
    payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_booking_id uuid;
    v_locked_booking_id uuid;
    v_booking_status text;
    v_payment public.booking_payments%ROWTYPE;
    v_existing_success uuid;
BEGIN
    -- Read the booking ID without locking the payment row.
    SELECT bp.booking_id
    INTO v_booking_id
    FROM public.booking_payments AS bp
    WHERE bp.id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    -- Match the booking-first lock order used by payment reservation.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_booking_id::text, 0)
    );

    -- Lock the booking and capture its current status before locking payment.
    SELECT tb.id, tb.status
    INTO v_locked_booking_id, v_booking_status
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

    -- Protect against unexpected changes to the payment's booking.
    IF v_payment.booking_id IS DISTINCT FROM v_booking_id THEN
        RAISE EXCEPTION 'Payment booking changed during confirmation';
    END IF;

    -- Validate the provider details before accepting the payment.
    IF v_payment.provider IS DISTINCT FROM 'paystack'
       OR v_payment.provider_reference IS DISTINCT FROM p_expected_reference
       OR v_payment.amount IS DISTINCT FROM p_expected_amount
       OR v_payment.currency IS DISTINCT FROM p_expected_currency
    THEN
        RAISE EXCEPTION 'Payment details do not match';
    END IF;

    -- Superseded attempts must not be treated as ordinary confirmations.
    IF v_payment.superseded_by IS NOT NULL THEN
        RAISE EXCEPTION 'Payment attempt has been superseded';
    END IF;

    -- Preserve idempotency for an already-successful, non-superseded payment.
    -- A completed booking must not invalidate a previously recorded payment.
    IF v_payment.status = 'successful' THEN
        RETURN QUERY
        SELECT v_payment.id, v_payment.status;
        RETURN;
    END IF;

    -- Only confirmed bookings may receive a new payment confirmation.
    IF v_booking_status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Booking is not eligible for payment confirmation';
    END IF;

    -- Only pending payments may transition to successful.
    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'Payment is not pending';
    END IF;

    -- Prevent two successful payments for one booking.
    SELECT bp.id
    INTO v_existing_success
    FROM public.booking_payments AS bp
    WHERE bp.booking_id = v_payment.booking_id
      AND bp.status = 'successful'
      AND bp.id <> v_payment.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Another payment has already succeeded';
    END IF;

    UPDATE public.booking_payments AS bp
    SET
        status = 'successful',
        paid_at = COALESCE(bp.paid_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE bp.id = p_payment_id
      AND bp.status = 'pending'
      AND bp.superseded_by IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment status changed during confirmation';
    END IF;

    RETURN QUERY
    SELECT bp.id, bp.status
    FROM public.booking_payments AS bp
    WHERE bp.id = p_payment_id;
END;
$function$;

COMMIT;
