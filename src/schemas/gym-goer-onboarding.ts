import { z } from 'zod';

function isValidPastDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date < today
  );
}

export const gymGoerDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name.'),

  lastName: z.string().trim().min(1, 'Please enter your last name.'),

  dateOfBirth: z
    .string()
    .trim()
    .refine(isValidPastDate, 'Enter a valid date of birth in the past using YYYY-MM-DD.'),

  phone: z
    .string()
    .trim()
    .min(1, 'Please enter your phone number.')
    .max(30, 'Please enter a valid phone number.')
    .refine(
      (value) => /^[+()\d\s-]+$/.test(value),
      'Use digits, spaces, +, parentheses or hyphens in your phone number.',
    ),
});

export type GymGoerDetailsFormValues = z.infer<typeof gymGoerDetailsSchema>;
