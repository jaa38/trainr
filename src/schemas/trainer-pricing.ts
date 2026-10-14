import { z } from 'zod';

const currencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

const positiveAmount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), `Enter a valid ${label}.`)
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= Number.MAX_SAFE_INTEGER,
      `${label.charAt(0).toUpperCase()}${label.slice(1)} must be greater than zero.`,
    );

const positiveInteger = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .regex(
      /^\d+$/,
      `${label.charAt(0).toUpperCase()}${label.slice(1)} must be a whole number.`,
    )
    .refine(
      (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
      `${label.charAt(0).toUpperCase()}${label.slice(1)} must be greater than zero.`,
    );

export const trainingPackageSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a package name.')
    .max(150, 'Package name must be 150 characters or fewer.'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1,000 characters or fewer.'),
  sessionsCount: positiveInteger('the number of sessions'),
  price: positiveAmount('the package price'),
});

export const trainerPricingSchema = z.object({
  sessionRate: positiveAmount('your session rate'),
  currency: z.enum(currencies),
  sessionDuration: positiveInteger('the session duration'),
  packages: z.array(trainingPackageSchema),
});

export type TrainerPricingFormValues = z.infer<typeof trainerPricingSchema>;

export type TrainingPackageFormValues = z.infer<typeof trainingPackageSchema>;
