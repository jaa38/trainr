-- =============================================================================
-- TRAINR: Structured Trainer Qualifications
-- =============================================================================

CREATE TABLE public.trainer_qualifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    trainer_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    category text NOT NULL
        CHECK (category IN ('qualification', 'certification')),

    qualification_name text NOT NULL
        CHECK (
            char_length(btrim(qualification_name)) BETWEEN 1 AND 200
        ),

    issuing_organisation text,

    date_obtained date,

    expiry_date date,

    certificate_path text,

    sort_order integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT trainer_qualifications_expiry_check
        CHECK (
            expiry_date IS NULL
            OR date_obtained IS NULL
            OR expiry_date >= date_obtained
        )
);

-- Index records by trainer and display order.
CREATE INDEX trainer_qualifications_trainer_idx
    ON public.trainer_qualifications (
        trainer_id,
        category,
        sort_order
    );

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.trainer_qualifications
    ENABLE ROW LEVEL SECURITY;

-- Trainers can manage their own records.
CREATE POLICY "Trainers can view their own qualifications"
    ON public.trainer_qualifications
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = trainer_id
    );

CREATE POLICY "Trainers can insert their own qualifications"
    ON public.trainer_qualifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = trainer_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'trainer'
        )
    );

CREATE POLICY "Trainers can update their own qualifications"
    ON public.trainer_qualifications
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = trainer_id
    )
    WITH CHECK (
        auth.uid() = trainer_id
    );

CREATE POLICY "Trainers can delete their own qualifications"
    ON public.trainer_qualifications
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = trainer_id
    );

-- Gym-goers can view qualification metadata for published trainers.
-- Certificate files remain private in Supabase Storage.
CREATE POLICY "Users can view published trainer qualifications"
    ON public.trainer_qualifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.trainer_profiles tp
            JOIN public.profiles p
                ON p.id = tp.user_id
            WHERE tp.user_id = trainer_qualifications.trainer_id
              AND tp.is_published = true
              AND p.role = 'trainer'
              AND p.onboarding_completed = true
        )
    );

-- =============================================================================
-- PRIVATE CERTIFICATE STORAGE
-- =============================================================================

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'trainer-certificates',
    'trainer-certificates',
    false,
    10485760,
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png'
    ]
)
ON CONFLICT (id) DO UPDATE
SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png'
    ];

CREATE POLICY "Trainers can upload their own certificates"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'trainer-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Trainers can view their own certificates"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'trainer-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Trainers can update their own certificates"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'trainer-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'trainer-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Trainers can delete their own certificates"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'trainer-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- =============================================================================
-- LEGACY COMPATIBILITY
--
-- Existing discovery and profile screens read qualifications and certifications
-- from trainer_profiles text arrays. Keep those arrays synchronised while the
-- app transitions to structured records.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_trainer_qualification_arrays()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    old_trainer_id uuid;
    new_trainer_id uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_trainer_id := OLD.trainer_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        new_trainer_id := NEW.trainer_id;
    END IF;

    IF old_trainer_id IS NOT NULL THEN
        UPDATE public.trainer_profiles tp
        SET
            qualifications = COALESCE(
                (
                    SELECT array_agg(
                        tq.qualification_name
                        ORDER BY tq.sort_order, tq.created_at, tq.id
                    )
                    FROM public.trainer_qualifications tq
                    WHERE tq.trainer_id = old_trainer_id
                      AND tq.category = 'qualification'
                ),
                ARRAY[]::text[]
            ),
            certifications = COALESCE(
                (
                    SELECT array_agg(
                        tq.qualification_name
                        ORDER BY tq.sort_order, tq.created_at, tq.id
                    )
                    FROM public.trainer_qualifications tq
                    WHERE tq.trainer_id = old_trainer_id
                      AND tq.category = 'certification'
                ),
                ARRAY[]::text[]
            ),
            updated_at = now()
        WHERE tp.user_id = old_trainer_id;
    END IF;

    IF new_trainer_id IS NOT NULL
       AND new_trainer_id IS DISTINCT FROM old_trainer_id THEN

        UPDATE public.trainer_profiles tp
        SET
            qualifications = COALESCE(
                (
                    SELECT array_agg(
                        tq.qualification_name
                        ORDER BY tq.sort_order, tq.created_at, tq.id
                    )
                    FROM public.trainer_qualifications tq
                    WHERE tq.trainer_id = new_trainer_id
                      AND tq.category = 'qualification'
                ),
                ARRAY[]::text[]
            ),
            certifications = COALESCE(
                (
                    SELECT array_agg(
                        tq.qualification_name
                        ORDER BY tq.sort_order, tq.created_at, tq.id
                    )
                    FROM public.trainer_qualifications tq
                    WHERE tq.trainer_id = new_trainer_id
                      AND tq.category = 'certification'
                ),
                ARRAY[]::text[]
            ),
            updated_at = now()
        WHERE tp.user_id = new_trainer_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;



-- =============================================================================
-- MIGRATE EXISTING QUALIFICATIONS
-- =============================================================================

INSERT INTO public.trainer_qualifications (
    trainer_id,
    category,
    qualification_name,
    sort_order
)
SELECT
    tp.user_id,
    'qualification',
    btrim(q.qualification_name),
    q.sort_order::integer
FROM public.trainer_profiles tp
CROSS JOIN LATERAL
    unnest(tp.qualifications)
    WITH ORDINALITY AS q(qualification_name, sort_order)
WHERE btrim(q.qualification_name) <> '';

-- Migrate existing certifications separately.
INSERT INTO public.trainer_qualifications (
    trainer_id,
    category,
    qualification_name,
    sort_order
)
SELECT
    tp.user_id,
    'certification',
    btrim(c.certification_name),
    c.sort_order::integer
FROM public.trainer_profiles tp
CROSS JOIN LATERAL
    unnest(tp.certifications)
    WITH ORDINALITY AS c(certification_name, sort_order)
WHERE btrim(c.certification_name) <> '';

-- Create the trigger after both legacy arrays have been migrated.
-- This prevents the first backfill from clearing the second legacy array.

CREATE TRIGGER sync_trainer_qualification_arrays
AFTER INSERT OR UPDATE OR DELETE
ON public.trainer_qualifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_trainer_qualification_arrays();
