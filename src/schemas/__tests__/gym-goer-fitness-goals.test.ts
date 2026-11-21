import {
  gymGoerExperienceLevelSchema,
  gymGoerFitnessGoalSchema,
  gymGoerFitnessGoalsSchema,
  gymGoerPrimaryGoalSchema,
  gymGoerTrainingFormatSchema,
  gymGoerTrainingPreferenceSchema,
} from '../gym-goer-fitness-goals';

const validValues = {
  primaryGoal: 'lose_weight',
  additionalGoals: ['build_muscle', 'improve_endurance'],
  experienceLevel: 'intermediate',
  trainingPreferences: ['strength', 'cardio'],
  trainingFormat: 'online',
  trainingFrequency: 4,
  location: '',
};

describe('Gym-Goer Fitness Goals schema', () => {
  describe('primary goal', () => {
    it.each([
      'lose_weight',
      'build_muscle',
      'increase_strength',
      'improve_endurance',
      'improve_fitness',
      'improve_flexibility',
    ])('accepts primary goal: %s', (primaryGoal) => {
      expect(gymGoerPrimaryGoalSchema.safeParse(primaryGoal).success).toBe(true);
    });

    it('rejects an unsupported primary goal', () => {
      expect(gymGoerPrimaryGoalSchema.safeParse('sports_performance').success).toBe(
        false,
      );
    });
  });

  describe('additional fitness goals', () => {
    it.each([
      'build_muscle',
      'lose_weight',
      'improve_fitness',
      'increase_strength',
      'improve_endurance',
      'improve_health',
      'improve_flexibility',
      'sports_performance',
    ])('accepts additional goal: %s', (goal) => {
      expect(gymGoerFitnessGoalSchema.safeParse(goal).success).toBe(true);
    });

    it('rejects an unsupported additional goal', () => {
      expect(gymGoerFitnessGoalSchema.safeParse('weight_gain').success).toBe(false);
    });
  });

  describe('experience level', () => {
    it.each(['beginner', 'intermediate', 'advanced'])(
      'accepts experience level: %s',
      (experienceLevel) => {
        expect(gymGoerExperienceLevelSchema.safeParse(experienceLevel).success).toBe(
          true,
        );
      },
    );

    it('rejects an unsupported experience level', () => {
      expect(gymGoerExperienceLevelSchema.safeParse('professional').success).toBe(false);
    });
  });

  describe('training preferences', () => {
    it.each(['strength', 'cardio', 'hiit', 'functional_training', 'flexibility'])(
      'accepts training preference: %s',
      (preference) => {
        expect(gymGoerTrainingPreferenceSchema.safeParse(preference).success).toBe(true);
      },
    );

    it('rejects an unsupported training preference', () => {
      expect(gymGoerTrainingPreferenceSchema.safeParse('crossfit').success).toBe(false);
    });
  });

  describe('training format', () => {
    it.each(['online', 'in_person', 'both'])(
      'accepts training format: %s',
      (trainingFormat) => {
        expect(gymGoerTrainingFormatSchema.safeParse(trainingFormat).success).toBe(true);
      },
    );

    it('rejects an unsupported training format', () => {
      expect(gymGoerTrainingFormatSchema.safeParse('hybrid').success).toBe(false);
    });
  });

  describe('complete fitness preferences', () => {
    it('accepts valid fitness preferences', () => {
      expect(gymGoerFitnessGoalsSchema.safeParse(validValues).success).toBe(true);
    });

    it('accepts an empty additional goals list', () => {
      expect(
        gymGoerFitnessGoalsSchema.safeParse({
          ...validValues,
          additionalGoals: [],
        }).success,
      ).toBe(true);
    });

    it('requires at least one training preference', () => {
      const result = gymGoerFitnessGoalsSchema.safeParse({
        ...validValues,
        trainingPreferences: [],
      });

      expect(result.success).toBe(false);
    });

    it.each([1, 2, 3, 4, 5, 6, 7])(
      'accepts training frequency of %i days',
      (trainingFrequency) => {
        expect(
          gymGoerFitnessGoalsSchema.safeParse({
            ...validValues,
            trainingFrequency,
          }).success,
        ).toBe(true);
      },
    );

    it.each([0, 8, -1, 2.5])(
      'rejects invalid training frequency: %s',
      (trainingFrequency) => {
        expect(
          gymGoerFitnessGoalsSchema.safeParse({
            ...validValues,
            trainingFrequency,
          }).success,
        ).toBe(false);
      },
    );

    it('requires a location for in-person training', () => {
      const result = gymGoerFitnessGoalsSchema.safeParse({
        ...validValues,
        trainingFormat: 'in_person',
        location: '',
      });

      expect(result.success).toBe(false);
    });

    it('requires a location for both training formats', () => {
      const result = gymGoerFitnessGoalsSchema.safeParse({
        ...validValues,
        trainingFormat: 'both',
        location: '',
      });

      expect(result.success).toBe(false);
    });

    it('accepts a location for in-person training', () => {
      expect(
        gymGoerFitnessGoalsSchema.safeParse({
          ...validValues,
          trainingFormat: 'in_person',
          location: 'Lekki, Lagos',
        }).success,
      ).toBe(true);
    });

    it('does not require a location for online training', () => {
      expect(
        gymGoerFitnessGoalsSchema.safeParse({
          ...validValues,
          trainingFormat: 'online',
          location: '',
        }).success,
      ).toBe(true);
    });

    it('rejects a primary goal repeated in additional goals', () => {
      const result = gymGoerFitnessGoalsSchema.safeParse({
        ...validValues,
        primaryGoal: 'lose_weight',
        additionalGoals: ['lose_weight'],
      });

      expect(result.success).toBe(false);
    });

    it('rejects a location longer than 150 characters', () => {
      expect(
        gymGoerFitnessGoalsSchema.safeParse({
          ...validValues,
          location: 'L'.repeat(151),
        }).success,
      ).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(
        gymGoerFitnessGoalsSchema.safeParse({
          primaryGoal: 'lose_weight',
        }).success,
      ).toBe(false);
    });
  });
});
