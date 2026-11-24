BEGIN;

-- Remove inherited default privileges from anonymous users.
REVOKE ALL PRIVILEGES ON TABLE
  public.workouts,
  public.personal_exercises,
  public.workout_exercises,
  public.workout_sets,
  public.fitness_goals
FROM anon;

-- Restrict authenticated users to application-level CRUD operations.
REVOKE ALL PRIVILEGES ON TABLE
  public.workouts,
  public.personal_exercises,
  public.workout_exercises,
  public.workout_sets,
  public.fitness_goals
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.workouts,
  public.personal_exercises,
  public.workout_exercises,
  public.workout_sets,
  public.fitness_goals
TO authenticated;

-- The personal records view is private to authenticated users.
REVOKE ALL PRIVILEGES ON TABLE public.personal_records
FROM anon, authenticated;

GRANT SELECT ON TABLE public.personal_records
TO authenticated;

COMMIT;
