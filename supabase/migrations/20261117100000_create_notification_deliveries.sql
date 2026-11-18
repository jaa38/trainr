BEGIN;

-- =========================================================
-- NOTIFICATION DELIVERY TRACKING
-- One record per notification and registered device.
-- =========================================================

CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  notification_id UUID NOT NULL
    REFERENCES public.notification_outbox(id) ON DELETE CASCADE,

  device_push_token_id UUID
    REFERENCES public.device_push_tokens(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'accepted',
        'retryable_failure',
        'permanent_failure',
        'invalid'
      )
    ),

  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

  expo_ticket_id TEXT,

  last_error TEXT,

  last_attempt_at TIMESTAMPTZ,

  accepted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate delivery records for the same device
  -- and notification event.
  CONSTRAINT notification_deliveries_unique_device
    UNIQUE (notification_id, device_push_token_id),

  CONSTRAINT notification_deliveries_ticket_not_empty
    CHECK (
      expo_ticket_id IS NULL
      OR char_length(trim(expo_ticket_id)) > 0
    ),

  CONSTRAINT notification_deliveries_accepted_consistency
    CHECK (
      status <> 'accepted'
      OR (
        expo_ticket_id IS NOT NULL
        AND accepted_at IS NOT NULL
      )
    )
);

-- Efficiently find deliveries for a notification and status.
CREATE INDEX idx_notification_deliveries_notification_status
  ON public.notification_deliveries (
    notification_id,
    status
  );

-- Efficiently find delivery records associated with a device.
CREATE INDEX idx_notification_deliveries_device
  ON public.notification_deliveries (
    device_push_token_id
  );

-- RLS: delivery records are backend-managed only.
ALTER TABLE public.notification_deliveries
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_deliveries
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.notification_deliveries
  TO service_role;

-- Keep updated_at consistent with the existing notification tables.
CREATE TRIGGER set_notification_deliveries_updated_at
BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_updated_at();

COMMIT;

