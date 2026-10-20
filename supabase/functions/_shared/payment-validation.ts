
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );

export const toKobo = (amountInNaira: number): number | null => {
  if (!Number.isFinite(amountInNaira) || amountInNaira <= 0) {
    return null;
  }

  const amountInKobo = Math.round(amountInNaira * 100);

  if (
    !Number.isSafeInteger(amountInKobo) ||
    Math.abs(amountInNaira * 100 - amountInKobo) > 0.000001
  ) {
    return null;
  }

  return amountInKobo;
};

export type VerifiedTransaction = {
  reference?: string;
  amount?: number;
  currency?: string;
};

export const matchesVerifiedTransaction = (
  transaction: VerifiedTransaction,
  expectedReference: string,
  expectedAmountInKobo: number,
  expectedCurrency: string,
): boolean =>
  transaction.reference === expectedReference &&
  transaction.amount === expectedAmountInKobo &&
  transaction.currency === expectedCurrency;
