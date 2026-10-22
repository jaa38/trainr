
BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_webhook_event(
  p_event_key text,
  p_event_type text,
  p_provider_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_provider_status text
)
RETURNS TABLE (
  event_status text,
  payment_id uuid,
  payment_status text,
  duplicate boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_event_status text;
  v_existing_event_type text;
  v_existing_reference text;
  v_booking_id uuid;
  v_locked_booking_id uuid;
  v_payment public.booking_payments%ROWTYPE;
  v_existing_success uuid;
  v_booking_status text;
BEGIN
  -- Validate event identity.
  IF p_event_key IS NULL
     OR length(p_event_key) < 1
     OR length(p_event_key) > 255
     OR p_event_type IS NULL
     OR length(p_event_type) < 1
     OR length(p_event_type) > 100 THEN
    RAISE EXCEPTION 'Invalid webhook event identity';
  END IF;

  -- Record each webhook event once.
  INSERT INTO public.paystack_webhook_events (
    event_key,
    event_type,
    provider_reference,
    processing_status
  )
  VALUES (
    p_event_key,
    p_event_type,
    p_provider_reference,
    'received'
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT
      e.id,
      e.processing_status,
      e.event_type,
      e.provider_reference
    INTO
      v_event_id,
      v_event_status,
      v_existing_event_type,
      v_existing_reference
    FROM public.paystack_webhook_events AS e
    WHERE e.event_key = p_event_key
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Webhook event disappeared during processing';
    END IF;

    -- Reject conflicting identity for the same event key.
    IF v_existing_event_type IS DISTINCT FROM p_event_type
       OR v_existing_reference IS DISTINCT FROM p_provider_reference THEN
      UPDATE public.paystack_webhook_events AS e
      SET processing_status = 'reconciliation_required',
          error_message = 'Duplicate event key has conflicting identity'
      WHERE e.id = v_event_id;

      RETURN QUERY
      SELECT
        'reconciliation_required'::text,
        NULL::uuid,
        NULL::text,
        true,
        'Event identity conflict requires reconciliation';
      RETURN;
    END IF;

    -- Do not automatically reprocess terminal events.
    IF v_event_status IN ('processed', 'reconciliation_required') THEN
      RETURN QUERY
      SELECT
        v_event_status,
        NULL::uuid,
        NULL::text,
        true,
        'Event was already recorded';
      RETURN;
    END IF;
  END IF;

  UPDATE public.paystack_webhook_events AS e
  SET processing_status = 'processing',
      error_message = NULL
  WHERE e.id = v_event_id;

  -- Only successful charge events may confirm a payment.
  IF p_event_type <> 'charge.success'
     OR p_provider_status IS DISTINCT FROM 'success' THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'processed',
        processed_at = pg_catalog.now()
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'processed'::text,
      NULL::uuid,
      NULL::text,
      false,
      'Event recorded; no successful payment confirmation requested';
    RETURN;
  END IF;

  -- Validate the provider's payment details.
  IF p_provider_reference IS NULL
     OR length(p_provider_reference) < 1
     OR p_amount_kobo IS NULL
     OR p_amount_kobo <= 0
     OR p_currency IS DISTINCT FROM 'NGN' THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Missing or invalid payment details'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      NULL::uuid,
      NULL::text,
      false,
      'Payment details require reconciliation';
    RETURN;
  END IF;

  -- Read the booking ID without locking the payment row.
  SELECT bp.booking_id
  INTO v_booking_id
  FROM public.booking_payments AS bp
  WHERE bp.provider_reference = p_provider_reference;

  IF NOT FOUND THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'No payment matches the provider reference'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      NULL::uuid,
      NULL::text,
      false,
      'No matching payment was found';
    RETURN;
  END IF;

  -- Acquire the booking lock before locking booking/payment rows.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking_id::text, 0)
  );

  SELECT tb.id, tb.status
  INTO v_locked_booking_id, v_booking_status
  FROM public.trainer_bookings AS tb
  WHERE tb.id = v_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Booking not found for payment'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      NULL::uuid,
      NULL::text,
      false,
      'Booking requires reconciliation';
    RETURN;
  END IF;

  -- Lock and re-read the payment after acquiring the booking lock.
  SELECT bp.*
  INTO v_payment
  FROM public.booking_payments AS bp
  WHERE bp.provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND
     OR v_payment.booking_id IS DISTINCT FROM v_booking_id THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Payment changed or disappeared during processing'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      NULL::uuid,
      NULL::text,
      false,
      'Payment requires reconciliation';
    RETURN;
  END IF;

  -- Validate provider, amount and currency against the stored payment.
  IF v_payment.provider <> 'paystack'
     OR v_payment.currency <> p_currency
     OR v_payment.amount * 100 <> p_amount_kobo THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Provider details do not match stored payment'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      v_payment.id,
      v_payment.status,
      false,
      'Provider details do not match the stored payment';
    RETURN;
  END IF;

  -- Superseded attempts must be reconciled, even if Paystack reports success.
  IF v_payment.superseded_by IS NOT NULL THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Superseded payment received a late success'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      v_payment.id,
      v_payment.status,
      false,
      'Superseded payment succeeded late; manual reconciliation is required';
    RETURN;
  END IF;

  -- An already-successful payment is idempotent.
  IF v_payment.status = 'successful' THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'processed',
        processed_at = pg_catalog.now(),
        error_message = NULL
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'processed'::text,
      v_payment.id,
      v_payment.status,
      false,
      'Payment was already confirmed';
    RETURN;
  END IF;

  -- Only pending payments for confirmed bookings may be confirmed here.
  IF v_payment.status <> 'pending'
     OR v_booking_status IS DISTINCT FROM 'confirmed' THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Payment or booking state is not eligible for automatic confirmation'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      v_payment.id,
      v_payment.status,
      false,
      'Payment or booking state requires reconciliation';
    RETURN;
  END IF;

  -- Never automatically confirm if another attempt has succeeded.
  SELECT bp.id
  INTO v_existing_success
  FROM public.booking_payments AS bp
  WHERE bp.booking_id = v_payment.booking_id
    AND bp.status = 'successful'
    AND bp.id <> v_payment.id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.paystack_webhook_events AS e
    SET processing_status = 'reconciliation_required',
        error_message = 'Another payment for this booking succeeded'
    WHERE e.id = v_event_id;

    RETURN QUERY
    SELECT
      'reconciliation_required'::text,
      v_payment.id,
      v_payment.status,
      false,
      'Another payment succeeded; manual reconciliation is required';
    RETURN;
  END IF;

  -- Confirm only the eligible pending payment.
  UPDATE public.booking_payments AS bp
  SET
    status = 'successful',
    paid_at = COALESCE(bp.paid_at, pg_catalog.now()),
    updated_at = pg_catalog.now()
  WHERE bp.id = v_payment.id
    AND bp.status = 'pending'
    AND bp.superseded_by IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment status changed during confirmation';
  END IF;

  UPDATE public.paystack_webhook_events AS e
  SET processing_status = 'processed',
      processed_at = pg_catalog.now(),
      error_message = NULL
  WHERE e.id = v_event_id;

  RETURN QUERY
  SELECT
    'processed'::text,
    v_payment.id,
    'successful'::text,
    false,
    'Verified successful payment recorded';
END;
$$;

REVOKE ALL ON FUNCTION public.process_paystack_webhook_event(
  text, text, text, bigint, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_paystack_webhook_event(
  text, text, text, bigint, text, text
) TO service_role;

COMMIT;
