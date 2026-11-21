BEGIN;

-- 1. Store multiple configurable session rates per trainer.
CREATE TABLE public.trainer_session_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    trainer_id uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    session_type text,
    session_duration_minutes integer NOT NULL,

    session_rate numeric(10,2) NOT NULL,
    currency text NOT NULL DEFAULT 'NGN',

    training_format text,

    status text NOT NULL DEFAULT 'active',
    is_default boolean NOT NULL DEFAULT false,

    -- Legacy records require trainers to confirm missing details.
    requires_confirmation boolean NOT NULL DEFAULT false,

    sort_order integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT trainer_session_rates_type_check
        CHECK (
            session_type IS NULL
            OR session_type IN (
                'one_to_one',
                'group_training',
                'online_training'
            )
        ),

    CONSTRAINT trainer_session_rates_duration_check
        CHECK (session_duration_minutes IN (30, 45, 60, 90)),

    CONSTRAINT trainer_session_rates_price_check
        CHECK (session_rate > 0),

    CONSTRAINT trainer_session_rates_currency_check
        CHECK (currency IN ('NGN', 'GBP', 'USD', 'EUR')),

    CONSTRAINT trainer_session_rates_format_check
        CHECK (
            training_format IS NULL
            OR training_format IN ('online', 'in_person', 'both')
        ),

    CONSTRAINT trainer_session_rates_status_check
        CHECK (status IN ('active', 'inactive')),

    CONSTRAINT trainer_session_rates_confirmation_check
        CHECK (
            requires_confirmation
            OR (
                session_type IS NOT NULL
                AND training_format IS NOT NULL
            )
        )
);

-- A trainer can have only one default rate.
CREATE UNIQUE INDEX trainer_session_rates_one_default_idx
    ON public.trainer_session_rates (trainer_id)
    WHERE is_default = true;

CREATE INDEX trainer_session_rates_trainer_idx
    ON public.trainer_session_rates (trainer_id);

CREATE INDEX trainer_session_rates_discovery_idx
    ON public.trainer_session_rates (status, trainer_id);

-- 2. Enable RLS. Session-rate records are private to their owner.
ALTER TABLE public.trainer_session_rates
    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can view their own session rates"
    ON public.trainer_session_rates
    FOR SELECT
    TO authenticated
    USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can insert their own session rates"
    ON public.trainer_session_rates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = trainer_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
              AND p.role = 'trainer'
        )
    );

CREATE POLICY "Trainers can update their own session rates"
    ON public.trainer_session_rates
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = trainer_id)
    WITH CHECK (
        auth.uid() = trainer_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
              AND p.role = 'trainer'
        )
    );

CREATE POLICY "Trainers can delete their own session rates"
    ON public.trainer_session_rates
    FOR DELETE
    TO authenticated
    USING (auth.uid() = trainer_id);

REVOKE ALL ON public.trainer_session_rates FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.trainer_session_rates TO authenticated;

-- 3. Synchronise the active default rate with the legacy pricing table.
-- This preserves the existing discovery and booking integrations.
CREATE OR REPLACE FUNCTION public.sync_trainer_session_rate_legacy_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_trainer_id uuid;
    v_default_rate public.trainer_session_rates%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_trainer_id := OLD.trainer_id;
    ELSE
        v_trainer_id := NEW.trainer_id;
    END IF;

    SELECT *
    INTO v_default_rate
    FROM public.trainer_session_rates
    WHERE trainer_id = v_trainer_id
      AND is_default = true
      AND status = 'active'
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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_trainer_session_rate_legacy_pricing
AFTER INSERT OR UPDATE OR DELETE
ON public.trainer_session_rates
FOR EACH ROW
EXECUTE FUNCTION public.sync_trainer_session_rate_legacy_pricing();

-- 4. Atomically change the default rate.
CREATE OR REPLACE FUNCTION public.set_trainer_session_rate_default(
    p_rate_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_user_id
          AND p.role = 'trainer'
    ) THEN
        RAISE EXCEPTION 'Trainer account required.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.trainer_session_rates
        WHERE id = p_rate_id
          AND trainer_id = v_user_id
          AND status = 'active'
          AND requires_confirmation = false
    ) THEN
        RAISE EXCEPTION 'A confirmed active session rate is required.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.trainer_session_rates
    SET is_default = false,
        updated_at = now()
    WHERE trainer_id = v_user_id
      AND is_default = true;

    UPDATE public.trainer_session_rates
    SET is_default = true,
        updated_at = now()
    WHERE id = p_rate_id
      AND trainer_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.set_trainer_session_rate_default(uuid)
    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.set_trainer_session_rate_default(uuid)
    TO authenticated;

-- 5. Backfill existing trainer pricing.
-- Preserve existing values; do not invent session types or formats.
INSERT INTO public.trainer_session_rates (
    trainer_id,
    session_type,
    session_duration_minutes,
    session_rate,
    currency,
    training_format,
    status,
    is_default,
    requires_confirmation,
    sort_order
)
SELECT
    pricing.user_id,
    NULL,
    pricing.session_duration_minutes,
    pricing.session_rate,
    pricing.currency,
    NULL,
    'active',
    true,
    true,
    0
FROM public.trainer_pricing AS pricing
WHERE NOT EXISTS (
    SELECT 1
    FROM public.trainer_session_rates AS existing
    WHERE existing.trainer_id = pricing.user_id
);

COMMIT;
