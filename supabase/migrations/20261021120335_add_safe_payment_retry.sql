BEGIN;

-- Preserve the relationship between an old payment attempt and
-- the replacement attempt, without deleting payment history.
ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS superseded_by uuid,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS supersession_reason text;

-- A replacement must reference an existing payment attempt.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.booking_payments'::regclass
      AND conname = 'booking_payments_superseded_by_fkey'
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_superseded_by_fkey
      FOREIGN KEY (superseded_by)
      REFERENCES public.booking_payments(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- A superseded attempt must identify its replacement and timestamp.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.booking_payments'::regclass
      AND conname = 'booking_payments_supersession_consistency_check'
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_supersession_consistency_check
      CHECK (
        (
          superseded_by IS NULL
          AND superseded_at IS NULL
          AND supersession_reason IS NULL
        )
        OR
        (
          superseded_by IS NOT NULL
          AND superseded_by <> id
          AND superseded_at IS NOT NULL
          AND supersession_reason IS NOT NULL
        )
      );
  END IF;
END
$$;

-- Record webhook deliveries so retries of the same event can be
-- recognised and reconciled without processing them repeatedly.
CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  provider_reference text,
  processing_status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  CONSTRAINT paystack_webhook_events_status_check
    CHECK (
      processing_status IN (
        'received',
        'processing',
        'processed',
        'reconciliation_required'
      )
    )
);

CREATE INDEX IF NOT EXISTS paystack_webhook_events_reference_idx
  ON public.paystack_webhook_events (provider_reference);

CREATE INDEX IF NOT EXISTS paystack_webhook_events_status_idx
  ON public.paystack_webhook_events (processing_status);

-- Do not expose webhook event records to ordinary app users.
ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.paystack_webhook_events
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.paystack_webhook_events
  TO service_role;

COMMIT;
