import { z } from 'zod';

export const gymGoerPreferencesSchema = z
  .object({
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced'], {
      error: 'Please select your experience level.',
    }),

    preferredTraining: z
      .array(z.enum(['gym', 'home', 'outdoor', 'online']))
      .min(1, 'Please select at least one training preference.'),

    location: z
      .string()
      .trim()
      .min(1, 'Please enter your city or area.')
      .max(150, 'Location must be 150 characters or fewer.'),

    budgetCurrency: z.enum(['NGN', 'GBP', 'USD', 'EUR']),

    budgetMin: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value),
        'Enter a valid minimum budget.',
      )
      .refine(
        (value) => value === '' || Number.isFinite(Number(value)),
        'Enter a valid minimum budget.',
      ),

    budgetMax: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value),
        'Enter a valid maximum budget.',
      )
      .refine(
        (value) => value === '' || Number.isFinite(Number(value)),
        'Enter a valid maximum budget.',
      ),
  })
  .superRefine((values, context) => {
    const min = values.budgetMin === '' ? null : Number(values.budgetMin);
    const max = values.budgetMax === '' ? null : Number(values.budgetMax);

    if (min !== null && min < 0) {
      context.addIssue({
        code: 'custom',
        path: ['budgetMin'],
        message: 'Minimum budget cannot be negative.',
      });
    }

    if (max !== null && max < 0) {
      context.addIssue({
        code: 'custom',
        path: ['budgetMax'],
        message: 'Maximum budget cannot be negative.',
      });
    }

    if (min !== null && max !== null && min > max) {
      context.addIssue({
        code: 'custom',
        path: ['budgetMax'],
        message: 'Maximum budget must be greater than or equal to minimum budget.',
      });
    }
  });

export type GymGoerPreferencesFormValues = z.infer<typeof gymGoerPreferencesSchema>;
