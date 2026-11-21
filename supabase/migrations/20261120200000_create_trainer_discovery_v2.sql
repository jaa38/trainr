BEGIN;

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
    LEFT JOIN public.trainer_pricing AS pricing
        ON pricing.user_id = tp.user_id
    WHERE tp.is_published = TRUE
      AND p.role = 'trainer'
      AND p.onboarding_completed = TRUE;
$function$;

-- Restrict execution to authenticated users and trusted backend operations.
REVOKE EXECUTE
ON FUNCTION public.discover_published_trainers_v2()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.discover_published_trainers_v2()
TO authenticated, service_role;

COMMIT;
