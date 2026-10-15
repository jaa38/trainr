import { z } from 'zod';

const availabilityDaySchema = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

const dailyTimeWindowSchema = z
  .object({
    start: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid start time in 24-hour format.'),
    end: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid end time in 24-hour format.'),
  })
  .refine(({ start, end }) => start < end, {
    message: 'End time must be later than start time.',
    path: ['end'],
  });

const dailyScheduleSchema = z.object({
  Monday: dailyTimeWindowSchema.optional(),
  Tuesday: dailyTimeWindowSchema.optional(),
  Wednesday: dailyTimeWindowSchema.optional(),
  Thursday: dailyTimeWindowSchema.optional(),
  Friday: dailyTimeWindowSchema.optional(),
  Saturday: dailyTimeWindowSchema.optional(),
  Sunday: dailyTimeWindowSchema.optional(),
});

export const trainerAvailabilitySchema = z
  .object({
    availableDays: z
      .array(availabilityDaySchema)
      .min(1, 'Select at least one day when you are available.')
      .refine((days) => new Set(days).size === days.length, 'Remove duplicate days.'),

    dailySchedule: dailyScheduleSchema,
  })
  .superRefine(({ availableDays, dailySchedule }, ctx) => {
    for (const day of availableDays) {
      if (!dailySchedule[day]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Set a start and end time for ${day}.`,
          path: ['dailySchedule', day],
        });
      }
    }
  });

export type TrainerAvailabilityFormValues = z.infer<typeof trainerAvailabilitySchema>;
