
-- Extend gym-goer fitness preferences for Sprint 10.

ALTER TABLE public.gym_goer_profiles
  ADD COLUMN primary_goal text,
  ADD COLUMN training_format text,
  ADD COLUMN training_frequency smallint;

-- Validate the primary fitness goal.
ALTER TABLE public.gym_goer_profiles
  ADD CONSTRAINT gym_goer_primary_goal_valid
  CHECK (
    primary_goal IS NULL
    OR primary_goal IN (
      'build_muscle',
      'lose_weight',
      'improve_fitness',
      'increase_strength',
      'improve_health',
      'improve_endurance',
      'improve_flexibility',
      'sports_performance'
    )
  );

-- Validate the preferred training format.
ALTER TABLE public.gym_goer_profiles
  ADD CONSTRAINT gym_goer_training_format_valid
  CHECK (
    training_format IS NULL
    OR training_format IN ('online', 'in_person', 'both')
  );

-- Preferred training frequency must be between 1 and 7 days.
ALTER TABLE public.gym_goer_profiles
  ADD CONSTRAINT gym_goer_training_frequency_valid
  CHECK (
    training_frequency IS NULL
    OR training_frequency BETWEEN 1 AND 7
  );

-- Preserve existing goal IDs and add endurance and flexibility.
ALTER TABLE public.gym_goer_fitness_goals
  DROP CONSTRAINT gym_goer_fitness_goals_goal_check;

ALTER TABLE public.gym_goer_fitness_goals
  ADD CONSTRAINT gym_goer_fitness_goals_goal_check
  CHECK (
    goal IN (
      'build_muscle',
      'lose_weight',
      'improve_fitness',
      'increase_strength',
      'improve_health',
      'improve_endurance',
      'improve_flexibility',
      'sports_performance'
    )
  );
