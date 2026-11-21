
-- Add dedicated training preferences for Gym-Goer Profile Management.
-- Preserve the existing preferred_training column, which represents
-- workout settings such as gym, home, outdoor and online.

ALTER TABLE public.gym_goer_profiles
ADD COLUMN IF NOT EXISTS training_preferences text[]
NOT NULL DEFAULT '{}';

ALTER TABLE public.gym_goer_profiles
DROP CONSTRAINT IF EXISTS gym_goer_training_preferences_valid;

ALTER TABLE public.gym_goer_profiles
ADD CONSTRAINT gym_goer_training_preferences_valid
CHECK (
  training_preferences <@ ARRAY[
    'strength',
    'cardio',
    'hiit',
    'functional_training',
    'flexibility'
  ]::text[]
);
