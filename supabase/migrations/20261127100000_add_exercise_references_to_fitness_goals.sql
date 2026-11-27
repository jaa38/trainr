-- =========================================================
-- TRAINR — EXERCISE-SPECIFIC FITNESS GOALS
-- =========================================================

ALTER TABLE public.fitness_goals
    ADD COLUMN exercise_id uuid
        REFERENCES public.exercises(id) ON DELETE RESTRICT,

    ADD COLUMN personal_exercise_id uuid
        REFERENCES public.personal_exercises(id) ON DELETE RESTRICT;

-- A goal may reference one exercise source, or neither.
ALTER TABLE public.fitness_goals
    ADD CONSTRAINT fitness_goals_exercise_reference_check
    CHECK (
        (exercise_id IS NOT NULL AND personal_exercise_id IS NULL)
        OR
        (exercise_id IS NULL AND personal_exercise_id IS NOT NULL)
        OR
        (exercise_id IS NULL AND personal_exercise_id IS NULL)
    );

-- Exercise references are only valid for strength and cardio goals.
-- Existing strength/cardio goals without references remain supported.
ALTER TABLE public.fitness_goals
    ADD CONSTRAINT fitness_goals_exercise_type_check
    CHECK (
        (
            exercise_id IS NULL
            AND personal_exercise_id IS NULL
        )
        OR goal_type IN ('strength_target', 'cardio_target')
    );

COMMENT ON COLUMN public.fitness_goals.exercise_id IS
    'Optional shared exercise reference for strength or cardio goals.';

COMMENT ON COLUMN public.fitness_goals.personal_exercise_id IS
    'Optional user-created exercise reference for strength or cardio goals.';
