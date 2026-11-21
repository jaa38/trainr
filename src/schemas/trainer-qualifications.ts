import { z } from 'zod';

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Enter a date in YYYY-MM-DD format.',
  )
  .refine((value) => {
    if (!value) return true;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Enter a valid calendar date.');

export const trainerQualificationSchema = z
  .object({
    category: z.enum(['qualification', 'certification']),
    qualificationName: z
      .string()
      .trim()
      .min(1, 'Enter a qualification or certification name.')
      .max(200, 'Name must be 200 characters or fewer.'),
    issuingOrganisation: z
      .string()
      .trim()
      .max(200, 'Issuing organisation must be 200 characters or fewer.'),
    dateObtained: optionalDate,
    expiryDate: optionalDate,
  })
  .superRefine((values, context) => {
    if (
      values.dateObtained &&
      values.expiryDate &&
      values.expiryDate < values.dateObtained
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'Expiry date cannot be earlier than the date obtained.',
      });
    }
  });

export type TrainerQualificationFormValues = z.infer<typeof trainerQualificationSchema>;

export type TrainerQualificationCategory = 'qualification' | 'certification';
