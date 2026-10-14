import { z } from 'zod';

export const trainerExpertiseSchema = z.object({
  specialities: z
    .array(z.string().trim().min(1))
    .min(1, 'Select at least one speciality.')
    .refine(
      (items) => new Set(items).size === items.length,
      'Remove duplicate specialities.',
    ),

  qualifications: z
    .string()
    .trim()
    .min(1, 'Enter at least one qualification.')
    .max(2000, 'Qualifications must be 2,000 characters or fewer.')
    .refine(
      (value) => value.split(',').some((item) => item.trim().length > 0),
      'Enter at least one qualification.',
    ),

  certifications: z
    .string()
    .trim()
    .min(1, 'Enter at least one certification.')
    .max(2000, 'Certifications must be 2,000 characters or fewer.')
    .refine(
      (value) => value.split(',').some((item) => item.trim().length > 0),
      'Enter at least one certification.',
    ),

  yearsExperience: z
    .string()
    .trim()
    .min(1, 'Enter your years of experience.')
    .regex(/^\d+$/, 'Enter a whole number of years.')
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      'Enter a valid number of years.',
    )
    .refine(
      (value) => Number(value) >= 0 && Number(value) <= 80,
      'Years of experience must be between 0 and 80.',
    ),
});

export type TrainerExpertiseFormValues = z.infer<typeof trainerExpertiseSchema>;
