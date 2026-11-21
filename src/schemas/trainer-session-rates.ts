import { z } from 'zod';

export const trainerSessionTypeSchema = z.enum([
  'one_to_one',
  'group_training',
  'online_training',
]);

export const trainerSessionDurationSchema = z.union([
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
]);

export const trainerSessionCurrencySchema = z.enum(['NGN', 'GBP', 'USD', 'EUR']);

export const trainerTrainingFormatSchema = z.enum(['online', 'in_person', 'both']);

export const trainerSessionStatusSchema = z.enum(['active', 'inactive']);

export const trainerSessionRateSchema = z.object({
  sessionType: trainerSessionTypeSchema,
  sessionDurationMinutes: trainerSessionDurationSchema,
  sessionRate: z.coerce
    .number()
    .finite('Enter a valid session price.')
    .positive('Session price must be greater than zero.')
    .max(99999999.99, 'Session price exceeds the maximum supported amount.'),
  currency: trainerSessionCurrencySchema,
  trainingFormat: trainerTrainingFormatSchema,
  status: trainerSessionStatusSchema,
});

export type TrainerSessionRateFormValues = z.infer<typeof trainerSessionRateSchema>;

export type TrainerSessionType = z.infer<typeof trainerSessionTypeSchema>;

export type TrainerSessionDuration = z.infer<typeof trainerSessionDurationSchema>;

export type TrainerSessionCurrency = z.infer<typeof trainerSessionCurrencySchema>;

export type TrainerTrainingFormat = z.infer<typeof trainerTrainingFormatSchema>;

export type TrainerSessionStatus = z.infer<typeof trainerSessionStatusSchema>;
