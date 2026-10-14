import { z } from 'zod';

export const trainerDetailsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Please enter your first name.')
    .max(100, 'First name must be 100 characters or fewer.'),

  lastName: z
    .string()
    .trim()
    .min(1, 'Please enter your last name.')
    .max(100, 'Last name must be 100 characters or fewer.'),

  professionalBio: z
    .string()
    .trim()
    .min(30, 'Your professional bio must be at least 30 characters.')
    .max(1000, 'Your professional bio must be 1,000 characters or fewer.'),

  location: z
    .string()
    .trim()
    .min(1, 'Please enter your city or area.')
    .max(150, 'Location must be 150 characters or fewer.'),

  coachingApproach: z
    .string()
    .trim()
    .min(20, 'Your coaching approach must be at least 20 characters.')
    .max(1000, 'Your coaching approach must be 1,000 characters or fewer.'),
});

export type TrainerDetailsFormValues = z.infer<typeof trainerDetailsSchema>;
