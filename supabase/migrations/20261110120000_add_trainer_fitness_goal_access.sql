BEGIN;

-- Remove unnecessary direct privileges from anonymous users.
REVOKE ALL PRIVILEGES
ON TABLE public.gym_goer_fitness_goals
FROM anon;

-- Reset authenticated privileges to the minimum required by the app.
REVOKE ALL PRIVILEGES
ON TABLE public.gym_goer_fitness_goals
FROM authenticated;

GRANT SELECT, INSERT, DELETE
ON TABLE public.gym_goer_fitness_goals
TO authenticated;

-- Trainers can read fitness goals only for clients with a confirmed booking.
DROP POLICY IF EXISTS "Trainers can view confirmed clients fitness goals"
ON public.gym_goer_fitness_goals;

CREATE POLICY "Trainers can view confirmed clients fitness goals"
ON public.gym_goer_fitness_goals
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
      AND booking.gym_goer_id = gym_goer_fitness_goals.user_id
      AND booking.status = 'confirmed'
  )
);

COMMIT;
