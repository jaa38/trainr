BEGIN;

-- ============================================================
-- 1. DATABASE-MANAGED UPDATED_AT TIMESTAMP
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_trainer_session_rate_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at := pg_catalog.statement_timestamp();
    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.set_trainer_session_rate_updated_at()
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.set_trainer_session_rate_updated_at()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trainer_session_rates_set_updated_at
ON public.trainer_session_rates;

CREATE TRIGGER trainer_session_rates_set_updated_at
BEFORE UPDATE ON public.trainer_session_rates
FOR EACH ROW
EXECUTE FUNCTION public.set_trainer_session_rate_updated_at();


-- ============================================================
-- 2. HARDENED DEFAULT SESSION RATE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_trainer_session_rate_default(
    p_rate_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_rate_id uuid;
BEGIN

    -- Require an authenticated user.
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;


    -- Confirm that the authenticated user is a trainer.
    -- Lock the profile row to serialize default changes
    -- for this trainer.
    PERFORM 1
    FROM public.profiles AS p
    WHERE p.id = v_user_id
      AND p.role = 'trainer'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trainer account required.'
            USING ERRCODE = '42501';
    END IF;


    -- Confirm that the selected rate belongs to this trainer,
    -- is active, and has complete session configuration.
    SELECT rate.id
    INTO v_rate_id
    FROM public.trainer_session_rates AS rate
    WHERE rate.id = p_rate_id
      AND rate.trainer_id = v_user_id
      AND rate.status = 'active'
      AND rate.requires_confirmation = false
      AND rate.session_type IS NOT NULL
      AND rate.training_format IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'A confirmed active session rate is required.'
            USING ERRCODE = '22023';
    END IF;


    -- Remove the previous default.
    UPDATE public.trainer_session_rates
    SET
        is_default = false,
        updated_at = pg_catalog.statement_timestamp()
    WHERE trainer_id = v_user_id
      AND is_default = true
      AND id <> v_rate_id;


    -- Set the selected rate as the new default.
    UPDATE public.trainer_session_rates
    SET
        is_default = true,
        updated_at = pg_catalog.statement_timestamp()
    WHERE id = v_rate_id
      AND trainer_id = v_user_id;

END;
$function$;

ALTER FUNCTION public.set_trainer_session_rate_default(uuid)
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.set_trainer_session_rate_default(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.set_trainer_session_rate_default(uuid)
TO authenticated;


-- ============================================================
-- 3. REMOVE BROAD AUTHENTICATED TABLE PERMISSIONS
-- ============================================================

-- Remove existing column-level privileges.
-- These are separate from table-level privileges and must
-- also be revoked explicitly.

REVOKE
    SELECT (
        id,
        trainer_id,
        session_type,
        session_duration_minutes,
        session_rate,
        currency,
        training_format,
        status,
        is_default,
        requires_confirmation,
        sort_order,
        created_at,
        updated_at
    ),
    INSERT (
        id,
        trainer_id,
        session_type,
        session_duration_minutes,
        session_rate,
        currency,
        training_format,
        status,
        is_default,
        requires_confirmation,
        sort_order,
        created_at,
        updated_at
    ),
    UPDATE (
        id,
        trainer_id,
        session_type,
        session_duration_minutes,
        session_rate,
        currency,
        training_format,
        status,
        is_default,
        requires_confirmation,
        sort_order,
        created_at,
        updated_at
    ),
    REFERENCES (
        id,
        trainer_id,
        session_type,
        session_duration_minutes,
        session_rate,
        currency,
        training_format,
        status,
        is_default,
        requires_confirmation,
        sort_order,
        created_at,
        updated_at
    )
ON TABLE public.trainer_session_rates
FROM authenticated;


-- Remove all existing table-level privileges.
REVOKE ALL PRIVILEGES
ON TABLE public.trainer_session_rates
FROM authenticated;


-- ============================================================
-- 4. RESTORE REQUIRED READ AND DELETE PERMISSIONS
-- ============================================================

-- Trainers can read rates, subject to the existing RLS policy.
GRANT SELECT
ON TABLE public.trainer_session_rates
TO authenticated;


-- Preserve the existing trainer-owned delete workflow.
-- RLS continues to determine which rows can be deleted.
GRANT DELETE
ON TABLE public.trainer_session_rates
TO authenticated;


-- ============================================================
-- 5. RESTRICT INSERT PERMISSIONS
-- ============================================================

-- The database supplies:
-- id
-- currency (default NGN)
-- status (default active)
-- is_default (default false)
-- requires_confirmation (default false)
-- sort_order (default 0)
-- created_at
-- updated_at

-- The client can only supply the trainer and session details.
GRANT INSERT (
    trainer_id,
    session_type,
    session_duration_minutes,
    session_rate,
    currency,
    training_format,
    status,
    sort_order
)
ON TABLE public.trainer_session_rates
TO authenticated;


-- ============================================================
-- 6. RESTRICT UPDATE PERMISSIONS
-- ============================================================

-- Trainers can update session configuration and pricing.
-- requires_confirmation remains writable so legacy rates
-- can be completed through the existing application workflow.
--
-- is_default, trainer_id, id, created_at and updated_at
-- cannot be directly updated by authenticated clients.

GRANT UPDATE (
    session_type,
    session_duration_minutes,
    session_rate,
    currency,
    training_format,
    status,
    requires_confirmation
)
ON TABLE public.trainer_session_rates
TO authenticated;



-- ============================================================
-- 7. RESTRICT DIRECT EXECUTION OF TRIGGER FUNCTIONS
-- ============================================================

-- These functions are invoked by their database triggers.
-- Application roles do not need direct EXECUTE privileges.

ALTER FUNCTION
    public.clear_inactive_trainer_session_rate_default()
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.clear_inactive_trainer_session_rate_default()
FROM PUBLIC, anon, authenticated, service_role;


ALTER FUNCTION
    public.sync_trainer_session_rate_legacy_pricing()
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.sync_trainer_session_rate_legacy_pricing()
FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================
-- 8. DOCUMENT SECURITY EXPECTATIONS
-- ============================================================

COMMENT ON FUNCTION
    public.set_trainer_session_rate_updated_at()
IS
    'Automatically maintains updated_at for trainer session rate changes.';

COMMENT ON FUNCTION
    public.set_trainer_session_rate_default(uuid)
IS
    'Sets a trainer-owned, active and confirmed session rate as the default.';


COMMIT;
