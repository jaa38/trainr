BEGIN;

-- Remove published-user access to structured qualification records.
-- Trainers retain access to their own records through the existing
-- owner-only SELECT policy.
DROP POLICY IF EXISTS
    "Users can view published trainer qualifications"
ON public.trainer_qualifications;

COMMIT;
