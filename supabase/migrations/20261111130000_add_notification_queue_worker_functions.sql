
BEGIN;

-- ============================================================
-- 1. CLAIM NOTIFICATION BATCH
-- ============================================================
-- Claims a bounded batch of notifications.
-- Exhausted pending records are failed before eligible records
-- are claimed.
-- Total records transitioned per call cannot exceed p_batch_size.

CREATE OR REPLACE FUNCTION public.claim_notification_batch(
  p_worker_id text,
  p_batch_size integer DEFAULT 50
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_exhausted_count integer := 0;
  v_remaining integer;
BEGIN
  IF p_worker_id IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_worker_id)) = 0
     OR pg_catalog.length(p_worker_id) > 128 THEN
    RAISE EXCEPTION 'A valid worker ID is required';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
    RAISE EXCEPTION 'Batch size must be between 1 and 100';
  END IF;

  -- Fail exhausted records first, respecting the total batch limit.
  WITH exhausted AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.status = 'pending'
      AND o.attempt_count >= o.max_attempts
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.notification_outbox AS o
  SET
    status = 'failed',
    locked_at = NULL,
    locked_by = NULL,
    last_error = COALESCE(
      o.last_error,
      'Maximum delivery attempts reached'
    )
  FROM exhausted AS e
  WHERE o.id = e.id;

  GET DIAGNOSTICS v_exhausted_count = ROW_COUNT;

  v_remaining := p_batch_size - v_exhausted_count;

  IF v_remaining <= 0 THEN
    RETURN;
  END IF;

  -- Claim only the remaining capacity.
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.status = 'pending'
      AND o.scheduled_for <= pg_catalog.clock_timestamp()
      AND o.next_attempt_at <= pg_catalog.clock_timestamp()
      AND o.attempt_count < o.max_attempts
    ORDER BY
      o.scheduled_for,
      o.next_attempt_at,
      o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT v_remaining
  )
  UPDATE public.notification_outbox AS o
  SET
    status = 'processing',
    attempt_count = o.attempt_count + 1,
    locked_at = pg_catalog.clock_timestamp(),
    locked_by = p_worker_id
  FROM candidates AS c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$function$;


-- ============================================================
-- 2. RENEW NOTIFICATION LOCK
-- ============================================================
-- Only the owning worker can renew an unexpired lock.
-- Locks older than ten minutes cannot be renewed.

CREATE OR REPLACE FUNCTION public.renew_notification_lock(
  p_notification_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  IF p_notification_id IS NULL
     OR p_worker_id IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_worker_id)) = 0
     OR pg_catalog.length(p_worker_id) > 128 THEN
    RAISE EXCEPTION 'A valid notification ID and worker ID are required';
  END IF;

  UPDATE public.notification_outbox AS o
  SET locked_at = pg_catalog.clock_timestamp()
  WHERE o.id = p_notification_id
    AND o.status = 'processing'
    AND o.locked_by = p_worker_id
    AND o.locked_at >= (
      pg_catalog.clock_timestamp() - interval '10 minutes'
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count = 1;
END;
$function$;


-- ============================================================
-- 3. COMPLETE NOTIFICATION ATTEMPT
-- ============================================================
-- Only the owning worker can complete an unexpired attempt.
-- Locks older than ten minutes cannot be completed.
-- Retry delays after attempts 1-4 are 1, 2, 4 and 8 minutes.
-- Attempt 5 is terminal with the existing max_attempts default.

CREATE OR REPLACE FUNCTION public.complete_notification_attempt(
  p_notification_id uuid,
  p_worker_id text,
  p_outcome text,
  p_expo_ticket_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  IF p_notification_id IS NULL
     OR p_worker_id IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_worker_id)) = 0
     OR pg_catalog.length(p_worker_id) > 128 THEN
    RAISE EXCEPTION 'A valid notification ID and worker ID are required';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN (
    'accepted',
    'retryable_failure',
    'permanent_failure'
  ) THEN
    RAISE EXCEPTION 'Unsupported notification outcome';
  END IF;

  IF p_outcome = 'accepted'
     AND (
       p_expo_ticket_id IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_expo_ticket_id)) = 0
     ) THEN
    RAISE EXCEPTION 'An Expo ticket ID is required for accepted delivery';
  END IF;

  UPDATE public.notification_outbox AS o
  SET
    status = CASE
      WHEN p_outcome = 'accepted' THEN 'sent'
      WHEN p_outcome = 'permanent_failure' THEN 'failed'
      WHEN o.attempt_count >= o.max_attempts THEN 'failed'
      ELSE 'pending'
    END,

    sent_at = CASE
      WHEN p_outcome = 'accepted'
        THEN pg_catalog.clock_timestamp()
      ELSE o.sent_at
    END,

    expo_ticket_id = CASE
      WHEN p_outcome = 'accepted'
        THEN p_expo_ticket_id
      ELSE o.expo_ticket_id
    END,

    next_attempt_at = CASE
      WHEN p_outcome = 'retryable_failure'
           AND o.attempt_count < o.max_attempts
        THEN pg_catalog.clock_timestamp()
          + pg_catalog.make_interval(
              secs => (
                60 * pg_catalog.power(
                  2::numeric,
                  LEAST(o.attempt_count - 1, 3)
                )
              )::integer
            )
      ELSE o.next_attempt_at
    END,

    last_error = CASE
      WHEN p_outcome = 'accepted' THEN NULL
      WHEN p_outcome = 'retryable_failure'
           AND o.attempt_count < o.max_attempts
        THEN pg_catalog.left(
          COALESCE(
            NULLIF(pg_catalog.btrim(p_error), ''),
            'Temporary delivery failure'
          ),
          1000
        )
      WHEN p_outcome = 'retryable_failure'
        THEN pg_catalog.left(
          COALESCE(
            NULLIF(pg_catalog.btrim(p_error), ''),
            'Maximum delivery attempts reached'
          ),
          1000
        )
      ELSE pg_catalog.left(
        COALESCE(
          NULLIF(pg_catalog.btrim(p_error), ''),
          'Permanent delivery failure'
        ),
        1000
      )
    END,

    locked_at = NULL,
    locked_by = NULL

  WHERE o.id = p_notification_id
    AND o.status = 'processing'
    AND o.locked_by = p_worker_id
    AND o.locked_at >= (
      pg_catalog.clock_timestamp() - interval '10 minutes'
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION
      'Notification is not processing, is not owned by this worker, or its lock has expired';
  END IF;
END;
$function$;


-- ============================================================
-- 4. RECOVER STALE NOTIFICATION LOCKS
-- ============================================================
-- Lock expiry is fixed at ten minutes across all worker operations.
-- Recovery events are recorded while preserving previous errors.

-- Remove the previous configurable-timeout function signature.
DROP FUNCTION IF EXISTS
  public.recover_stale_notification_locks(interval, integer);

CREATE OR REPLACE FUNCTION public.recover_stale_notification_locks(
  p_batch_size integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_recovered_count integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'Recovery batch size must be between 1 and 500';
  END IF;

  WITH stale AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.status = 'processing'
      AND o.locked_at < (
        pg_catalog.clock_timestamp() - interval '10 minutes'
      )
    ORDER BY o.locked_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.notification_outbox AS o
  SET
    status = CASE
      WHEN o.attempt_count >= o.max_attempts THEN 'failed'
      ELSE 'pending'
    END,

    next_attempt_at = CASE
      WHEN o.attempt_count < o.max_attempts
        THEN pg_catalog.clock_timestamp()
      ELSE o.next_attempt_at
    END,

    last_error = pg_catalog.left(
      'Worker lock expired; notification recovered'
      || CASE
           WHEN NULLIF(pg_catalog.btrim(o.last_error), '') IS NOT NULL
             THEN ': ' || o.last_error
           ELSE ''
         END,
      1000
    ),

    locked_at = NULL,
    locked_by = NULL

  FROM stale AS s
  WHERE o.id = s.id;

  GET DIAGNOSTICS v_recovered_count = ROW_COUNT;

  RETURN v_recovered_count;
END;
$function$;


-- ============================================================
-- 5. FUNCTION PERMISSIONS
-- ============================================================
-- Only the trusted backend service can execute worker functions.

REVOKE ALL ON FUNCTION public.claim_notification_batch(text, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.renew_notification_lock(uuid, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_notification_attempt(
  uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.recover_stale_notification_locks(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_batch(text, integer)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.renew_notification_lock(uuid, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.complete_notification_attempt(
  uuid, text, text, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.recover_stale_notification_locks(integer)
  TO service_role;

COMMIT;
