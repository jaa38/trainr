
const CURRENCY_LOCALES: Record<string, string> = {
  NGN: "en-NG",
  GBP: "en-GB",
  USD: "en-US",
  EUR: "en-IE",
  GHS: "en-GH",
  ZAR: "en-ZA",
  KES: "en-KE",
  CAD: "en-CA",
  AUD: "en-AU",
};

type FormatCurrencyOptions = {
  currency: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrency(
  amount: number,
  {
    currency,
    locale,
    minimumFractionDigits,
    maximumFractionDigits,
  }: FormatCurrencyOptions,
): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }

  const normalizedCurrency = currency.toUpperCase();

  const resolvedLocale =
    locale ?? CURRENCY_LOCALES[normalizedCurrency] ?? "en";

  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: normalizedCurrency,
    currencyDisplay: "narrowSymbol",
    ...(minimumFractionDigits !== undefined && {
      minimumFractionDigits,
    }),
    ...(maximumFractionDigits !== undefined && {
      maximumFractionDigits,
    }),
  }).format(amount);
}
