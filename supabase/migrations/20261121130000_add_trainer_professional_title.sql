-- Add a professional title to trainer profiles.
-- Nullable to preserve existing trainer records.

ALTER TABLE public.trainer_profiles
ADD COLUMN IF NOT EXISTS professional_title text;
