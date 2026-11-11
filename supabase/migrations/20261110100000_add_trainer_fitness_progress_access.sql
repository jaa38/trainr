BEGIN;

DROP POLICY IF EXISTS "Trainers can view confirmed clients fitness progress"
ON public.fitness_progress;

CREATE POLICY "Trainers can view confirmed clients fitness progress"
ON public.fitness_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS trainer
    WHERE trainer.id = (SELECT auth.uid())
      AND trainer.role = 'trainer'
  )
  AND EXISTS (
    SELECT 1
    FROM public.trainer_bookings AS booking
    WHERE booking.trainer_id = (SELECT auth.uid())
      AND booking.gym_goer_id = fitness_progress.user_id
      AND booking.status = 'confirmed'
  )
);

COMMIT;
