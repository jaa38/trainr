BEGIN;

-- Allow authenticated users to create feedback.
GRANT INSERT ON TABLE public.trainer_feedback TO authenticated;

-- Trainers may edit feedback content only.
-- Ownership and workout references remain immutable.
GRANT UPDATE (
  feedback,
  recommendations,
  updated_at
)
ON TABLE public.trainer_feedback
TO authenticated;

DROP POLICY IF EXISTS "Trainers create feedback for their own clients"
ON public.trainer_feedback;

DROP POLICY IF EXISTS "Trainers update their own feedback"
ON public.trainer_feedback;

-- Trainers can create feedback only for their own clients
-- and for assignments/workouts they own.
CREATE POLICY "Trainers create feedback for their own clients"
ON public.trainer_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  trainer_id = (SELECT auth.uid())

  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )

  AND (
    assigned_workout_plan_id IS NOT NULL
    OR workout_log_id IS NOT NULL
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.assigned_workout_plans AS assignment
      WHERE assignment.id = trainer_feedback.assigned_workout_plan_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      INNER JOIN public.assigned_workout_plans AS assignment
        ON assignment.id = workout.assigned_workout_plan_id
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.gym_goer_id = trainer_feedback.gym_goer_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.assigned_workout_plan_id =
            trainer_feedback.assigned_workout_plan_id
    )
  )
);

-- Only the original trainer can update their feedback.
-- The full ownership relationship is checked before and after the update.
CREATE POLICY "Trainers update their own feedback"
ON public.trainer_feedback
FOR UPDATE
TO authenticated
USING (
  trainer_id = (SELECT auth.uid())

  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.assigned_workout_plans AS assignment
      WHERE assignment.id = trainer_feedback.assigned_workout_plan_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      INNER JOIN public.assigned_workout_plans AS assignment
        ON assignment.id = workout.assigned_workout_plan_id
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.gym_goer_id = trainer_feedback.gym_goer_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.assigned_workout_plan_id =
            trainer_feedback.assigned_workout_plan_id
    )
  )
)
WITH CHECK (
  trainer_id = (SELECT auth.uid())

  AND EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.assigned_workout_plans AS assignment
      WHERE assignment.id = trainer_feedback.assigned_workout_plan_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      INNER JOIN public.assigned_workout_plans AS assignment
        ON assignment.id = workout.assigned_workout_plan_id
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.gym_goer_id = trainer_feedback.gym_goer_id
        AND assignment.trainer_id = (SELECT auth.uid())
        AND assignment.gym_goer_id = trainer_feedback.gym_goer_id
    )
  )

  AND (
    assigned_workout_plan_id IS NULL
    OR workout_log_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workout_logs AS workout
      WHERE workout.id = trainer_feedback.workout_log_id
        AND workout.assigned_workout_plan_id =
            trainer_feedback.assigned_workout_plan_id
    )
  )
);

COMMIT;
