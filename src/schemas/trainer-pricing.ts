
import { z } from 'zod';

import {
  trainerSessionCurrencySchema,
  trainerSessionTypeSchema,
  trainerTrainingFormatSchema,
} from '@/schemas/trainer-session-rates';

const positiveAmount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .refine(
      (value) => /^\d+(\.\d{1,2})?$/.test(value),
      `Enter a valid ${label}.`,
    )
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 99999999.99,
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

/**
 * Form fields can temporarily be empty.
 *
 * The pipe validates that the final value is a real enum member.
 * This lets React Hook Form initialise fields with '' without
 * allowing empty values through the validated submit handler.
 */
const requiredSessionTypeSchema = z
  .union([trainerSessionTypeSchema, z.literal('')])
  .pipe(trainerSessionTypeSchema);

const requiredTrainingFormatSchema = z
  .union([trainerTrainingFormatSchema, z.literal('')])
  .pipe(trainerTrainingFormatSchema);

const requiredCurrencySchema = z
  .union([trainerSessionCurrencySchema, z.literal('')])
  .pipe(trainerSessionCurrencySchema);

const requiredDurationSchema = z
  .union([z.enum(['30', '45', '60', '90']), z.literal('')])
  .pipe(z.enum(['30', '45', '60', '90']));

export const trainerPricingSchema = z.object({
  sessionType: requiredSessionTypeSchema,

  sessionRate: positiveAmount('your session rate'),

  currency: requiredCurrencySchema,

  sessionDuration: requiredDurationSchema,

  trainingFormat: requiredTrainingFormatSchema,

  packages: z.array(trainingPackageSchema),
});

/**
 * Input type:
 * Used by React Hook Form while the user is editing.
 * Empty selections are allowed temporarily.
 */
export type TrainerPricingFormInput = z.input<
  typeof trainerPricingSchema
>;

/**
 * Output type:
 * Used after successful Zod validation.
 * Required selections are narrowed to their actual enum values.
 */
export type TrainerPricingFormValues = z.output<
  typeof trainerPricingSchema
>;

export type TrainingPackageFormValues = z.infer<
  typeof trainingPackageSchema
>;
