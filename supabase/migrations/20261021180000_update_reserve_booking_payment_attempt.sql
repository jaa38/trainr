BEGIN;

CREATE OR REPLACE FUNCTION public.reserve_booking_payment_attempt(
  p_booking_id uuid,
  p_gym_goer_id uuid,
  p_idempotency_key uuid
)
RETURNS TABLE(
  payment_id uuid,
  booking_id uuid,
  provider_reference text,
  authorization_url text,
  payment_status text,
  was_created boolean,
  amount numeric,
  currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_booking public.trainer_bookings%ROWTYPE;
  v_payment public.booking_payments%ROWTYPE;
  v_reference text;
BEGIN
  IF p_booking_id IS NULL
     OR p_gym_goer_id IS NULL
     OR p_idempotency_key IS NULL
  THEN
    RAISE EXCEPTION 'Booking, gym-goer, and idempotency key are required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_booking_id::text, 0)
  );

  SELECT b.*
  INTO v_booking
  FROM public.trainer_bookings AS b
  WHERE b.id = p_booking_id
    AND b.gym_goer_id = p_gym_goer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not accessible';
  END IF;

  -- Reuse an idempotent result only if the attempt is not superseded.
  SELECT bp.*
  INTO v_payment
  FROM public.booking_payments AS bp
  WHERE bp.gym_goer_id = p_gym_goer_id
    AND bp.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_payment.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'Idempotency key belongs to another booking';
    END IF;

    IF v_payment.superseded_by IS NOT NULL THEN
      RAISE EXCEPTION
        'Payment attempt has been superseded; use a new idempotency key';
    END IF;

    IF v_payment.status IN ('pending', 'successful') THEN
      RETURN QUERY
      SELECT
        v_payment.id,
        v_payment.booking_id,
        v_payment.provider_reference,
        v_payment.authorization_url,
        v_payment.status,
        false,
        v_payment.amount,
        v_payment.currency;
      RETURN;
    END IF;

    RAISE EXCEPTION
      'Existing payment attempt requires reconciliation';
  END IF;

  -- A successful payment must not be superseded.
  SELECT bp.*
  INTO v_payment
  FROM public.booking_payments AS bp
  WHERE bp.booking_id = p_booking_id
    AND bp.status = 'successful'
    AND bp.superseded_by IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_payment.id,
      v_payment.booking_id,
      v_payment.provider_reference,
      v_payment.authorization_url,
      v_payment.status,
      false,
      v_payment.amount,
      v_payment.currency;
    RETURN;
  END IF;

  -- Never reuse a superseded pending attempt.
  SELECT bp.*
  INTO v_payment
  FROM public.booking_payments AS bp
  WHERE bp.booking_id = p_booking_id
    AND bp.status = 'pending'
    AND bp.superseded_by IS NULL
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_payment.id,
      v_payment.booking_id,
      v_payment.provider_reference,
      v_payment.authorization_url,
      v_payment.status,
      false,
      v_payment.amount,
      v_payment.currency;
    RETURN;
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking is not confirmed';
  END IF;

  IF v_booking.currency <> 'NGN' THEN
    RAISE EXCEPTION 'Unsupported payment currency';
  END IF;

  IF v_booking.session_rate IS NULL
     OR v_booking.session_rate <= 0
     OR v_booking.session_rate * 100
        <> pg_catalog.trunc(v_booking.session_rate * 100)
  THEN
    RAISE EXCEPTION 'Invalid booking payment amount';
  END IF;

  v_reference :=
    'trainr_' || replace(pg_catalog.gen_random_uuid()::text, '-', '');

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
    p_booking_id,
    p_gym_goer_id,
    v_booking.session_rate,
    v_booking.currency,
    'paystack',
    v_reference,
    'pending',
    p_idempotency_key,
    'not_started'
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id,
    v_payment.booking_id,
    v_payment.provider_reference,
    v_payment.authorization_url,
    v_payment.status,
    true,
    v_payment.amount,
    v_payment.currency;
END;
$function$;

COMMIT;
