import { z } from 'zod';

export const gymGoerPrimaryGoalSchema = z.enum([
  'lose_weight',
  'build_muscle',
  'increase_strength',
  'improve_endurance',
  'improve_fitness',
  'improve_flexibility',
]);

export const gymGoerFitnessGoalSchema = z.enum([
  'build_muscle',
  'lose_weight',
  'improve_fitness',
  'increase_strength',
  'improve_endurance',
  'improve_health',
  'improve_flexibility',
  'sports_performance',
]);

export const gymGoerExperienceLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);

export const gymGoerTrainingPreferenceSchema = z.enum([
  'strength',
  'cardio',
  'hiit',
  'functional_training',
  'flexibility',
]);

export const gymGoerTrainingFormatSchema = z.enum(['online', 'in_person', 'both']);

export const gymGoerFitnessGoalsSchema = z
  .object({
    primaryGoal: gymGoerPrimaryGoalSchema,

    additionalGoals: z.array(gymGoerFitnessGoalSchema),

    experienceLevel: gymGoerExperienceLevelSchema,

    trainingPreferences: z
      .array(gymGoerTrainingPreferenceSchema)
      .min(1, 'Please select at least one training preference.'),

    trainingFormat: gymGoerTrainingFormatSchema,

    trainingFrequency: z
      .number()
      .int('Select a whole number of training days.')
      .min(1, 'Choose at least one training day per week.')
      .max(7, 'Training frequency cannot exceed seven days per week.'),

    location: z.string().trim().max(150, 'Location must be 150 characters or fewer.'),
  })
  .superRefine((values, context) => {
    if (
      (values.trainingFormat === 'in_person' || values.trainingFormat === 'both') &&
      values.location.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['location'],
        message: 'Please enter your city or area for in-person training.',
      });
    }

    if (values.additionalGoals.includes(values.primaryGoal)) {
      context.addIssue({
        code: 'custom',
        path: ['additionalGoals'],
        message: 'Your primary goal should not be selected again as an additional goal.',
      });
    }
  });

export type GymGoerFitnessGoalsFormValues = z.infer<typeof gymGoerFitnessGoalsSchema>;

export type GymGoerPrimaryGoal = z.infer<typeof gymGoerPrimaryGoalSchema>;

export type GymGoerFitnessGoal = z.infer<typeof gymGoerFitnessGoalSchema>;

export type GymGoerExperienceLevel = z.infer<typeof gymGoerExperienceLevelSchema>;

export type GymGoerTrainingPreference = z.infer<typeof gymGoerTrainingPreferenceSchema>;

export type GymGoerTrainingFormat = z.infer<typeof gymGoerTrainingFormatSchema>;
