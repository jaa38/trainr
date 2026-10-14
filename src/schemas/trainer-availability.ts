import { z } from 'zod';

export const trainerAvailabilitySchema = z.object({
  availableDays: z
    .array(
      z.enum([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]),
    )
    .min(1, 'Select at least one day when you are available.')
    .refine((days) => new Set(days).size === days.length, 'Remove duplicate days.'),
});

export type TrainerAvailabilityFormValues = z.infer<typeof trainerAvailabilitySchema>;
