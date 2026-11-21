import { trainerSessionRateSchema } from '../trainer-session-rates';

const validRate = {
  sessionType: 'one_to_one',
  sessionDurationMinutes: 60,
  sessionRate: 15000,
  currency: 'NGN',
  trainingFormat: 'in_person',
  status: 'active',
};

describe('Trainer session rate schema', () => {
  describe('valid session rates', () => {
    it('accepts a valid session rate', () => {
      expect(trainerSessionRateSchema.safeParse(validRate).success).toBe(true);
    });

    it.each(['one_to_one', 'group_training', 'online_training'])(
      'accepts session type: %s',
      (sessionType) => {
        expect(
          trainerSessionRateSchema.safeParse({
            ...validRate,
            sessionType,
          }).success,
        ).toBe(true);
      },
    );

    it.each([30, 45, 60, 90])(
      'accepts session duration: %i minutes',
      (sessionDurationMinutes) => {
        expect(
          trainerSessionRateSchema.safeParse({
            ...validRate,
            sessionDurationMinutes,
          }).success,
        ).toBe(true);
      },
    );

    it.each(['NGN', 'GBP', 'USD', 'EUR'])('accepts currency: %s', (currency) => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          currency,
        }).success,
      ).toBe(true);
    });

    it.each(['online', 'in_person', 'both'])(
      'accepts training format: %s',
      (trainingFormat) => {
        expect(
          trainerSessionRateSchema.safeParse({
            ...validRate,
            trainingFormat,
          }).success,
        ).toBe(true);
      },
    );

    it.each(['active', 'inactive'])('accepts pricing status: %s', (status) => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          status,
        }).success,
      ).toBe(true);
    });

    it('coerces a numeric price string into a number', () => {
      const result = trainerSessionRateSchema.safeParse({
        ...validRate,
        sessionRate: '15000',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.sessionRate).toBe(15000);
      }
    });
  });

  describe('invalid session rates', () => {
    it('rejects a zero price', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionRate: 0,
        }).success,
      ).toBe(false);
    });

    it('rejects a negative price', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionRate: -100,
        }).success,
      ).toBe(false);
    });

    it('rejects a price above the maximum supported amount', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionRate: 100000000,
        }).success,
      ).toBe(false);
    });

    it('rejects a non-numeric price', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionRate: 'not-a-price',
        }).success,
      ).toBe(false);
    });

    it('rejects an unsupported session type', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionType: 'personal_training',
        }).success,
      ).toBe(false);
    });

    it('rejects an unsupported duration', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          sessionDurationMinutes: 120,
        }).success,
      ).toBe(false);
    });

    it('rejects an unsupported currency', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          currency: 'CAD',
        }).success,
      ).toBe(false);
    });

    it('rejects an unsupported training format', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          trainingFormat: 'hybrid',
        }).success,
      ).toBe(false);
    });

    it('rejects an unsupported pricing status', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          ...validRate,
          status: 'pending',
        }).success,
      ).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(
        trainerSessionRateSchema.safeParse({
          sessionType: 'one_to_one',
          sessionRate: 15000,
        }).success,
      ).toBe(false);
    });
  });
});
