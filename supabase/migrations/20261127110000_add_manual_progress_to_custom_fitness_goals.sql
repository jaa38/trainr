-- =========================================================
-- TRAINR — MANUAL PROGRESS FOR CUSTOM FITNESS GOALS
-- =========================================================

ALTER TABLE public.fitness_goals
    ADD COLUMN current_value numeric;

ALTER TABLE public.fitness_goals
    ADD CONSTRAINT fitness_goals_current_value_check
    CHECK (
        current_value IS NULL
        OR (
            goal_type = 'custom'
            AND current_value >= 0
        )
    );

COMMENT ON COLUMN public.fitness_goals.current_value IS
    'Optional manually recorded progress value for custom fitness goals.';
