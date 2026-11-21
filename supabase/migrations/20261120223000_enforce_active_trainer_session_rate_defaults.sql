-- Automatically clear the default flag when a rate is inactive.
CREATE OR REPLACE FUNCTION public.clear_inactive_trainer_session_rate_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    NEW.is_default := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trainer_session_rates_clear_inactive_default
ON public.trainer_session_rates;

CREATE TRIGGER trainer_session_rates_clear_inactive_default
BEFORE INSERT OR UPDATE OF status, is_default
ON public.trainer_session_rates
FOR EACH ROW
EXECUTE FUNCTION public.clear_inactive_trainer_session_rate_default();

-- Repair existing records that violate the rule.
UPDATE public.trainer_session_rates
SET is_default = false
WHERE status = 'inactive'
  AND is_default = true;

-- Enforce the rule at database level.
ALTER TABLE public.trainer_session_rates
ADD CONSTRAINT trainer_session_rates_default_must_be_active
CHECK (NOT is_default OR status = 'active');
