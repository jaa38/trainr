
-- TRAINR Sprint 11A
-- Migration 1: session-rate discovery and legacy pricing synchronisation
--
-- IMPORTANT:
-- 1. Deploy this migration with the matching mobile-app release that moves
--    onboarding writes to trainer_session_rates and reads
--    discover_published_trainers_v3.
-- 2. The legacy trainer_pricing table remains a compatibility projection.
-- 3. No existing booking, payment, completion, or earnings rows are changed.

BEGIN;

-- Keep trainer_pricing synchronised only with a complete, active, confirmed
-- default session rate. If trainer_id changes, synchronise both owners.
CREATE OR REPLACE FUNCTION public.sync_trainer_session_rate_legacy_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_trainer_ids uuid[];
    v_trainer_id uuid;
    v_default_rate public.trainer_session_rates%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_trainer_ids := ARRAY[OLD.trainer_id];
    ELSIF TG_OP = 'UPDATE'
          AND OLD.trainer_id IS DISTINCT FROM NEW.trainer_id THEN
        v_trainer_ids := ARRAY[OLD.trainer_id, NEW.trainer_id];
    ELSE
        v_trainer_ids := ARRAY[NEW.trainer_id];
    END IF;

    FOREACH v_trainer_id IN ARRAY v_trainer_ids
    LOOP
        SELECT sr.*
        INTO v_default_rate
        FROM public.trainer_session_rates AS sr
        WHERE sr.trainer_id = v_trainer_id
          AND sr.is_default = true
          AND sr.status = 'active'
          AND sr.requires_confirmation = false
          AND sr.session_type IS NOT NULL
          AND sr.training_format IS NOT NULL
        ORDER BY sr.created_at ASC
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO public.trainer_pricing (
                user_id,
                session_rate,
                currency,
                session_duration_minutes,
                updated_at
            )
            VALUES (
                v_default_rate.trainer_id,
                v_default_rate.session_rate,
                v_default_rate.currency,
                v_default_rate.session_duration_minutes,
                now()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                session_rate = EXCLUDED.session_rate,
                currency = EXCLUDED.currency,
                session_duration_minutes = EXCLUDED.session_duration_minutes,
                updated_at = now();
        ELSE
            DELETE FROM public.trainer_pricing
            WHERE user_id = v_trainer_id;
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

-- The function is called by its trigger, not directly by application clients.
-- SECURITY DEFINER runs it with the function owner's privileges.
ALTER FUNCTION public.sync_trainer_session_rate_legacy_pricing()
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.sync_trainer_session_rate_legacy_pricing()
FROM PUBLIC, anon, authenticated, service_role;


-- Preserve the existing v2 signature for older app versions, but prevent
-- trainers without a synchronised eligible default price from appearing as
-- bookable through the legacy single-price discovery response.
CREATE OR REPLACE FUNCTION public.discover_published_trainers_v2()
RETURNS TABLE (
    trainer_id uuid,
    first_name text,
    last_name text,
    avatar_url text,
    professional_bio text,
    qualifications text[],
    specialities text[],
    years_experience integer,
    location text,
    coaching_approach text,
    certifications text[],
    session_rate numeric,
    currency text,
    session_duration_minutes integer,
    availability jsonb,
    timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT
        tp.user_id,
        p.first_name,
        p.last_name,
        p.avatar_url,
        tp.professional_bio,
        tp.qualifications,
        tp.specialities,
        tp.years_experience,
        tp.location,
        tp.coaching_approach,
        tp.certifications,
        pricing.session_rate,
        pricing.currency,
        pricing.session_duration_minutes,
        tp.availability,
        tp.timezone
    FROM public.trainer_profiles AS tp
    JOIN public.profiles AS p
        ON p.id = tp.user_id
    JOIN public.trainer_pricing AS pricing
        ON pricing.user_id = tp.user_id
    WHERE tp.is_published = TRUE
      AND p.role = 'trainer'
      AND p.onboarding_completed = TRUE
      AND pricing.session_rate IS NOT NULL;
$function$;

ALTER FUNCTION public.discover_published_trainers_v2()
OWNER TO postgres;

REVOKE EXECUTE
ON FUNCTION public.discover_published_trainers_v2()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.discover_published_trainers_v2()
TO authenticated, service_role;


-- New discovery contract: one trainer result containing all active,
-- complete, confirmed rates. This supports multiple rates per trainer.
CREATE OR REPLACE FUNCTION public.discover_published_trainers_v3()
RETURNS TABLE (
    trainer_id uuid,
    first_name text,
    last_name text,
    avatar_url text,
    professional_bio text,
    qualifications text[],
    specialities text[],
    years_experience integer,
    location text,
    coaching_approach text,
    certifications text[],
    availability jsonb,
    timezone text,
    session_rates jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT
        tp.user_id,
        p.first_name,
        p.last_name,
        p.avatar_url,
        tp.professional_bio,
        tp.qualifications,
        tp.specialities,
        tp.years_experience,
        tp.location,
        tp.coaching_approach,
        tp.certifications,
        tp.availability,
        tp.timezone,
        rate_data.session_rates
    FROM public.trainer_profiles AS tp
    JOIN public.profiles AS p
        ON p.id = tp.user_id
    CROSS JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', sr.id,
                'session_type', sr.session_type,
                'session_duration_minutes', sr.session_duration_minutes,
                'session_rate', sr.session_rate,
                'currency', sr.currency,
                'training_format', sr.training_format,
                'is_default', sr.is_default,
                'sort_order', sr.sort_order
            )
            ORDER BY
                sr.is_default DESC,
                sr.sort_order ASC,
                sr.created_at ASC
        ) AS session_rates
        FROM public.trainer_session_rates AS sr
        WHERE sr.trainer_id = tp.user_id
          AND sr.status = 'active'
          AND sr.requires_confirmation = false
          AND sr.session_type IS NOT NULL
          AND sr.training_format IS NOT NULL
    ) AS rate_data
    WHERE tp.is_published = TRUE
      AND p.role = 'trainer'
      AND p.onboarding_completed = TRUE
      AND rate_data.session_rates IS NOT NULL;
$function$;

ALTER FUNCTION public.discover_published_trainers_v3()
OWNER TO postgres;

REVOKE ALL ON FUNCTION
    public.discover_published_trainers_v3()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.discover_published_trainers_v3()
TO authenticated, service_role;

COMMIT;
