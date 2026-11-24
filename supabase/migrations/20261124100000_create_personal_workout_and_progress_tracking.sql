BEGIN;

-- =========================================================
-- TRAINR SPRINT 9
-- Personal Workout Logging & Progress Tracking
-- =========================================================


-- =========================================================
-- 1. PERSONAL WORKOUTS
-- =========================================================

CREATE TABLE public.workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    workout_name text NOT NULL,
    workout_type text NOT NULL,
    workout_date date NOT NULL DEFAULT CURRENT_DATE,

    started_at timestamptz,
    completed_at timestamptz,
    duration_seconds integer,

    notes text,
    status text NOT NULL DEFAULT 'draft',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workouts_name_not_empty
        CHECK (length(trim(workout_name)) > 0),

    CONSTRAINT workouts_type_check
        CHECK (
            workout_type IN (
                'strength',
                'cardio',
                'bodyweight',
                'flexibility',
                'functional',
                'custom'
            )
        ),

    CONSTRAINT workouts_status_check
        CHECK (
            status IN ('draft', 'in_progress', 'completed')
        ),

    CONSTRAINT workouts_duration_check
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    CONSTRAINT workouts_completion_check
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL)
            OR
            (status <> 'completed' AND completed_at IS NULL)
        ),

    CONSTRAINT workouts_timestamp_check
        CHECK (
            completed_at IS NULL
            OR started_at IS NULL
            OR completed_at >= started_at
        )
);


-- =========================================================
-- 2. REUSABLE PERSONAL EXERCISES
-- =========================================================

CREATE TABLE public.personal_exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    name text NOT NULL,
    description text,
    category text NOT NULL,
    muscle_group text,

    equipment text[] NOT NULL DEFAULT '{}',
    instructions text,

    archived_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT personal_exercises_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT personal_exercises_category_check
        CHECK (
            category IN (
                'strength',
                'cardio',
                'bodyweight',
                'flexibility',
                'functional',
                'custom'
            )
        )
);


-- =========================================================
-- 3. WORKOUT EXERCISES
-- =========================================================

CREATE TABLE public.workout_exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workout_id uuid NOT NULL
        REFERENCES public.workouts(id) ON DELETE CASCADE,

    exercise_id uuid
        REFERENCES public.exercises(id) ON DELETE RESTRICT,

    personal_exercise_id uuid
        REFERENCES public.personal_exercises(id) ON DELETE RESTRICT,

    exercise_order integer NOT NULL DEFAULT 0,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workout_exercises_order_check
        CHECK (exercise_order >= 0),

    CONSTRAINT workout_exercises_reference_check
        CHECK (
            (exercise_id IS NOT NULL AND personal_exercise_id IS NULL)
            OR
            (exercise_id IS NULL AND personal_exercise_id IS NOT NULL)
        ),

    CONSTRAINT workout_exercises_order_unique
        UNIQUE (workout_id, exercise_order)
);


-- =========================================================
-- 4. WORKOUT SETS
-- =========================================================

CREATE TABLE public.workout_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workout_exercise_id uuid NOT NULL
        REFERENCES public.workout_exercises(id) ON DELETE CASCADE,

    set_number integer NOT NULL,

    repetitions integer,
    weight numeric(12, 4),
    weight_unit text,

    duration_seconds integer,

    distance numeric(12, 4),
    distance_unit text,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workout_sets_number_check
        CHECK (set_number > 0),

    CONSTRAINT workout_sets_repetitions_check
        CHECK (
            repetitions IS NULL
            OR repetitions >= 0
        ),

    CONSTRAINT workout_sets_weight_check
        CHECK (
            weight IS NULL
            OR weight >= 0
        ),

    CONSTRAINT workout_sets_weight_unit_check
        CHECK (
            (weight IS NULL AND weight_unit IS NULL)
            OR
            (
                weight IS NOT NULL
                AND weight_unit IS NOT NULL
                AND weight_unit IN ('kg', 'lb')
            )
        ),

    CONSTRAINT workout_sets_duration_check
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    CONSTRAINT workout_sets_distance_check
        CHECK (
            distance IS NULL
            OR distance >= 0
        ),

    CONSTRAINT workout_sets_distance_unit_check
        CHECK (
            (distance IS NULL AND distance_unit IS NULL)
            OR
            (
                distance IS NOT NULL
                AND distance_unit IS NOT NULL
                AND distance_unit IN ('km', 'mi')
            )
        ),

    CONSTRAINT workout_sets_number_unique
        UNIQUE (workout_exercise_id, set_number)
);


-- =========================================================
-- 5. MEASURABLE FITNESS GOALS
-- =========================================================

CREATE TABLE public.fitness_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    goal_type text NOT NULL,
    goal_name text NOT NULL,
    description text,

    target_value numeric(12, 4) NOT NULL,
    measurement_unit text,

    start_date date NOT NULL DEFAULT CURRENT_DATE,
    target_date date,

    goal_status text NOT NULL DEFAULT 'active',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fitness_goals_type_check
        CHECK (
            goal_type IN (
                'workout_frequency',
                'strength_target',
                'cardio_target',
                'workout_duration',
                'body_weight',
                'custom'
            )
        ),

    CONSTRAINT fitness_goals_name_not_empty
        CHECK (length(trim(goal_name)) > 0),

    CONSTRAINT fitness_goals_target_check
        CHECK (target_value > 0),

    CONSTRAINT fitness_goals_status_check
        CHECK (
            goal_status IN (
                'active',
                'paused',
                'completed',
                'archived'
            )
        ),

    CONSTRAINT fitness_goals_date_check
        CHECK (
            target_date IS NULL
            OR target_date >= start_date
        )
);

-- =========================================================
-- 6. UPDATED_AT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_personal_workout_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    NEW.updated_at := pg_catalog.statement_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER workouts_set_updated_at
BEFORE UPDATE ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.set_personal_workout_updated_at();

CREATE TRIGGER personal_exercises_set_updated_at
BEFORE UPDATE ON public.personal_exercises
FOR EACH ROW
EXECUTE FUNCTION public.set_personal_workout_updated_at();

CREATE TRIGGER fitness_goals_set_updated_at
BEFORE UPDATE ON public.fitness_goals
FOR EACH ROW
EXECUTE FUNCTION public.set_personal_workout_updated_at();


-- =========================================================
-- 7. PREVENT OWNERSHIP CHANGES
-- =========================================================

CREATE OR REPLACE FUNCTION public.prevent_personal_workout_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Record ownership cannot be changed';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER workouts_prevent_owner_change
BEFORE UPDATE OF user_id ON public.workouts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_personal_workout_owner_change();

CREATE TRIGGER personal_exercises_prevent_owner_change
BEFORE UPDATE OF user_id ON public.personal_exercises
FOR EACH ROW
EXECUTE FUNCTION public.prevent_personal_workout_owner_change();


-- =========================================================
-- 8. VALIDATE WORKOUT EXERCISE OWNERSHIP
-- =========================================================

CREATE OR REPLACE FUNCTION public.validate_personal_workout_exercise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_user_id uuid;
    v_exercise_creator uuid;
    v_role text;
BEGIN
    SELECT w.user_id
    INTO v_user_id
    FROM public.workouts w
    WHERE w.id = NEW.workout_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Workout does not exist';
    END IF;

    -- Personal exercises must belong to the workout owner.
    IF NEW.personal_exercise_id IS NOT NULL THEN

        IF NOT EXISTS (
            SELECT 1
            FROM public.personal_exercises pe
            WHERE pe.id = NEW.personal_exercise_id
              AND pe.user_id = v_user_id
              AND pe.archived_at IS NULL
        ) THEN
            RAISE EXCEPTION
                'Personal exercise must belong to the workout owner and be active';
        END IF;

    ELSE

        -- Shared or trainer-created exercise.
        SELECT e.created_by
        INTO v_exercise_creator
        FROM public.exercises e
        WHERE e.id = NEW.exercise_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Exercise does not exist';
        END IF;

        -- A trainer-created exercise may only be used by its creator.
        IF v_exercise_creator IS NOT NULL
           AND v_exercise_creator <> v_user_id THEN
            RAISE EXCEPTION
                'This exercise belongs to another trainer';
        END IF;

        -- Trainer-created exercises must belong to a trainer account.
        IF v_exercise_creator IS NOT NULL THEN

            SELECT p.role
            INTO v_role
            FROM public.profiles p
            WHERE p.id = v_user_id;

            IF v_role IS DISTINCT FROM 'trainer' THEN
                RAISE EXCEPTION
                    'Only trainers can use trainer-created exercises';
            END IF;

        END IF;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER workout_exercises_validate_owner
BEFORE INSERT OR UPDATE OF
    workout_id,
    exercise_id,
    personal_exercise_id
ON public.workout_exercises
FOR EACH ROW
EXECUTE FUNCTION public.validate_personal_workout_exercise();


-- =========================================================
-- 9. RESTRICT DIRECT EXECUTION OF TRIGGER FUNCTIONS
-- =========================================================

REVOKE ALL ON FUNCTION
    public.set_personal_workout_updated_at()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
    public.prevent_personal_workout_owner_change()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
    public.validate_personal_workout_exercise()
FROM PUBLIC, anon, authenticated, service_role;

-- =========================================================
-- 10. PERFORMANCE INDEXES
-- =========================================================

CREATE INDEX workouts_user_date_idx
    ON public.workouts (user_id, workout_date DESC);

CREATE INDEX workouts_user_status_idx
    ON public.workouts (user_id, status);

CREATE INDEX workouts_user_type_date_idx
    ON public.workouts (user_id, workout_type, workout_date DESC);

CREATE INDEX personal_exercises_user_name_idx
    ON public.personal_exercises (user_id, name);

CREATE INDEX workout_exercises_workout_order_idx
    ON public.workout_exercises (workout_id, exercise_order);

CREATE INDEX workout_exercises_shared_exercise_idx
    ON public.workout_exercises (exercise_id)
    WHERE exercise_id IS NOT NULL;

CREATE INDEX workout_exercises_personal_exercise_idx
    ON public.workout_exercises (personal_exercise_id)
    WHERE personal_exercise_id IS NOT NULL;

CREATE INDEX workout_sets_exercise_set_idx
    ON public.workout_sets (workout_exercise_id, set_number);

CREATE INDEX fitness_goals_user_status_idx
    ON public.fitness_goals (user_id, goal_status);

-- Reuse the existing fitness_progress_user_metric_date_idx.
-- Its definition was verified against TRAINR Development.


-- =========================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_goals ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 12. WORKOUT POLICIES
-- =========================================================

CREATE POLICY "Users manage their own personal workouts"
ON public.workouts
FOR ALL
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);


-- =========================================================
-- 13. PERSONAL EXERCISE POLICIES
-- =========================================================

CREATE POLICY "Users manage their own personal exercises"
ON public.personal_exercises
FOR ALL
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);


-- =========================================================
-- 14. WORKOUT EXERCISE POLICIES
-- =========================================================

CREATE POLICY "Users manage exercises in their own workouts"
ON public.workout_exercises
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workouts w
        WHERE w.id = workout_exercises.workout_id
          AND w.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workouts w
        WHERE w.id = workout_exercises.workout_id
          AND w.user_id = (SELECT auth.uid())
    )
);


-- =========================================================
-- 15. WORKOUT SET POLICIES
-- =========================================================

CREATE POLICY "Users manage sets in their own workouts"
ON public.workout_sets
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workout_exercises we
        JOIN public.workouts w
          ON w.id = we.workout_id
        WHERE we.id = workout_sets.workout_exercise_id
          AND w.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workout_exercises we
        JOIN public.workouts w
          ON w.id = we.workout_id
        WHERE we.id = workout_sets.workout_exercise_id
          AND w.user_id = (SELECT auth.uid())
    )
);


-- =========================================================
-- 16. FITNESS GOAL POLICIES
-- =========================================================

CREATE POLICY "Users manage their own measurable fitness goals"
ON public.fitness_goals
FOR ALL
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);


-- =========================================================
-- 17. REMOVE OLD FITNESS PROGRESS POLICIES
-- =========================================================

DROP POLICY IF EXISTS
    "Trainers can view authorised clients fitness progress"
ON public.fitness_progress;

DROP POLICY IF EXISTS
    "Gym-goers create own fitness progress"
ON public.fitness_progress;

DROP POLICY IF EXISTS
    "Gym-goers update own body weight records"
ON public.fitness_progress;


-- =========================================================
-- 18. PRIVATE FITNESS MEASUREMENT POLICIES
-- =========================================================

-- The existing own-user SELECT policy remains in place.

CREATE POLICY "Users create their own fitness measurements"
ON public.fitness_progress
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);

CREATE POLICY "Users update their own fitness measurements"
ON public.fitness_progress
FOR UPDATE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);

CREATE POLICY "Users delete their own fitness measurements"
ON public.fitness_progress
FOR DELETE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('gym_goer', 'trainer')
    )
);


-- =========================================================
-- 19. REMOVE AUTOMATIC TRAINER ACCESS TO CLIENT GOALS
-- =========================================================

DROP POLICY IF EXISTS
    "Trainers can view confirmed clients fitness goals"
ON public.gym_goer_fitness_goals;


-- =========================================================
-- 20. TABLE PERMISSIONS
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workouts
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.personal_exercises
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workout_exercises
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workout_sets
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.fitness_goals
TO authenticated;

GRANT DELETE
ON public.fitness_progress
TO authenticated;

-- =========================================================

-- =========================================================
-- 21. PERSONAL RECORDS VIEW
-- =========================================================
-- Derived from completed workouts only.
--
-- Category mapping:
-- strength training   -> strength
-- core training       -> bodyweight
-- cardio              -> cardio
-- functional training -> functional
-- conditioning        -> custom
--
-- Personal exercise categories already use TRAINR categories.
--
-- Strength:
--   Maximum weight (normalised to kg)
--   Maximum repetitions
--
-- Bodyweight:
--   Maximum repetitions
--
-- Cardio:
--   Maximum distance (normalised to km)
--   Fastest time at an equivalent distance
--
-- Functional, flexibility and custom exercises:
--   No category-specific PR is generated until their
--   comparison metrics are explicitly defined.
--
-- Original exercise category and workout set units are preserved.

CREATE OR REPLACE VIEW public.personal_records
WITH (security_invoker = true)
AS

WITH completed_sets AS (
    SELECT
        w.user_id,

        we.exercise_id,
        we.personal_exercise_id,

        ws.id AS workout_set_id,
        w.completed_at AS achieved_at,

        ws.repetitions,
        ws.weight,
        ws.weight_unit,
        ws.duration_seconds,
        ws.distance,
        ws.distance_unit,

        COALESCE(
            pe.category,
            e.category
        ) AS source_category,

        CASE
            WHEN we.personal_exercise_id IS NOT NULL THEN
                pe.category

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) = 'strength training'
                THEN 'strength'

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) = 'core training'
                THEN 'bodyweight'

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) = 'cardio'
                THEN 'cardio'

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) = 'functional training'
                THEN 'functional'

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) = 'conditioning'
                THEN 'custom'

            WHEN LOWER(TRIM(COALESCE(e.category, ''))) IN (
                'strength',
                'bodyweight',
                'flexibility',
                'functional',
                'custom'
            )
                THEN LOWER(TRIM(e.category))

            ELSE 'custom'
        END AS exercise_category,

        CASE
            WHEN ws.weight_unit = 'lb'
                THEN ws.weight * 0.45359237
            ELSE ws.weight
        END AS weight_kg,

        CASE
            WHEN ws.distance_unit = 'mi'
                THEN ws.distance * 1.609344
            ELSE ws.distance
        END AS distance_km,

        CASE
            WHEN ws.distance_unit = 'mi'
                THEN ws.distance * 1609.344
            ELSE ws.distance * 1000
        END AS comparison_distance_meters

    FROM public.workout_sets ws

    JOIN public.workout_exercises we
        ON we.id = ws.workout_exercise_id

    JOIN public.workouts w
        ON w.id = we.workout_id

    LEFT JOIN public.exercises e
        ON e.id = we.exercise_id

    LEFT JOIN public.personal_exercises pe
        ON pe.id = we.personal_exercise_id

    WHERE w.status = 'completed'
      AND w.completed_at IS NOT NULL
),


-- Maximum strength-training weight.

ranked_weight AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY
                user_id,
                exercise_id,
                personal_exercise_id
            ORDER BY
                weight_kg DESC,
                achieved_at ASC,
                workout_set_id ASC
        ) AS rank_number

    FROM completed_sets

    WHERE exercise_category = 'strength'
      AND weight IS NOT NULL
      AND weight > 0
),


-- Maximum repetitions for strength and bodyweight exercises.

ranked_repetitions AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY
                user_id,
                exercise_id,
                personal_exercise_id
            ORDER BY
                repetitions DESC,
                achieved_at ASC,
                workout_set_id ASC
        ) AS rank_number

    FROM completed_sets

    WHERE exercise_category IN ('strength', 'bodyweight')
      AND repetitions IS NOT NULL
      AND repetitions > 0
),


-- Maximum cardio distance.

ranked_distance AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY
                user_id,
                exercise_id,
                personal_exercise_id
            ORDER BY
                distance_km DESC,
                achieved_at ASC,
                workout_set_id ASC
        ) AS rank_number

    FROM completed_sets

    WHERE exercise_category = 'cardio'
      AND distance IS NOT NULL
      AND distance > 0
),


-- Fastest cardio time at an equivalent distance.
-- Distances are compared using exact numeric conversion,
-- without rounding to an arbitrary number of decimal places.

ranked_fastest AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY
                user_id,
                exercise_id,
                personal_exercise_id,
                comparison_distance_meters
            ORDER BY
                duration_seconds ASC,
                achieved_at ASC,
                workout_set_id ASC
        ) AS rank_number

    FROM completed_sets

    WHERE exercise_category = 'cardio'
      AND duration_seconds IS NOT NULL
      AND duration_seconds > 0
      AND distance IS NOT NULL
      AND distance > 0
)


-- Maximum strength weight.

SELECT
    pg_catalog.md5(
        'max_weight:' || workout_set_id::text
    )::uuid AS id,

    user_id,
    exercise_id,
    personal_exercise_id,
    exercise_category,
    source_category,

    'max_weight'::text AS record_type,

    weight_kg AS record_value,
    'kg'::text AS measurement_unit,

    workout_set_id,
    achieved_at,

    NULL::numeric AS comparison_distance_meters

FROM ranked_weight
WHERE rank_number = 1


UNION ALL


-- Maximum repetitions.

SELECT
    pg_catalog.md5(
        'max_repetitions:' || workout_set_id::text
    )::uuid,

    user_id,
    exercise_id,
    personal_exercise_id,
    exercise_category,
    source_category,

    'max_repetitions'::text,

    repetitions::numeric,
    'reps'::text,

    workout_set_id,
    achieved_at,

    NULL::numeric

FROM ranked_repetitions
WHERE rank_number = 1


UNION ALL


-- Maximum cardio distance.

SELECT
    pg_catalog.md5(
        'max_distance:' || workout_set_id::text
    )::uuid,

    user_id,
    exercise_id,
    personal_exercise_id,
    exercise_category,
    source_category,

    'max_distance'::text,

    distance_km,
    'km'::text,

    workout_set_id,
    achieved_at,

    NULL::numeric

FROM ranked_distance
WHERE rank_number = 1


UNION ALL


-- Fastest cardio time at an equivalent distance.

SELECT
    pg_catalog.md5(
        'fastest_time:' || workout_set_id::text
    )::uuid,

    user_id,
    exercise_id,
    personal_exercise_id,
    exercise_category,
    source_category,

    'fastest_time'::text,

    duration_seconds::numeric,
    'seconds'::text,

    workout_set_id,
    achieved_at,

    comparison_distance_meters

FROM ranked_fastest
WHERE rank_number = 1;


GRANT SELECT
ON public.personal_records
TO authenticated;


-- 22. CLOSE MIGRATION TRANSACTION
-- =========================================================

COMMIT;