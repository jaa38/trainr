/**
 * Preferred locales for commonly used currencies.
 *
 * All other valid ISO 4217 currency codes are supported
 * through Intl.NumberFormat using the default English locale.
 */
const CURRENCY_LOCALES: Record<string, string> = {
    // Africa
    NGN: "en-NG",
    GHS: "en-GH",
    ZAR: "en-ZA",
    KES: "en-KE",
    UGX: "en-UG",
    TZS: "en-TZ",
    RWF: "en-RW",
    EGP: "en-EG",
    MAD: "fr-MA",
    XOF: "fr-SN",
    XAF: "fr-CM",
    ZMW: "en-ZM",
    BWP: "en-BW",
    MUR: "en-MU",

    // Europe
    GBP: "en-GB",
    EUR: "en-IE",
    CHF: "de-CH",
    SEK: "sv-SE",
    NOK: "nb-NO",
    DKK: "da-DK",
    PLN: "pl-PL",
    CZK: "cs-CZ",
    HUF: "hu-HU",
    RON: "ro-RO",
    BGN: "bg-BG",
    ISK: "is-IS",
    TRY: "tr-TR",
    UAH: "uk-UA",
    RUB: "ru-RU",

    // North America
    USD: "en-US",
    CAD: "en-CA",
    MXN: "es-MX",

    // South America
    BRL: "pt-BR",
    ARS: "es-AR",
    CLP: "es-CL",
    COP: "es-CO",
    PEN: "es-PE",

    // Asia
    JPY: "ja-JP",
    CNY: "zh-CN",
    HKD: "zh-HK",
    TWD: "zh-TW",
    INR: "en-IN",
    PKR: "en-PK",
    BDT: "bn-BD",
    SGD: "en-SG",
    MYR: "ms-MY",
    THB: "th-TH",
    IDR: "id-ID",
    PHP: "en-PH",
    KRW: "ko-KR",
    VND: "vi-VN",
    AED: "ar-AE",
    SAR: "ar-SA",
    QAR: "ar-QA",
    KWD: "ar-KW",
    BHD: "ar-BH",
    OMR: "ar-OM",
    JOD: "ar-JO",
    ILS: "he-IL",

    // Oceania
    AUD: "en-AU",
    NZD: "en-NZ",
    FJD: "en-FJ",
};

export type FormatCurrencyOptions = {
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
    if (!Number.isFinite(amount) || !currency?.trim()) {
        return "—";
    }

    const normalizedCurrency = currency.trim().toUpperCase();

    try {
        const resolvedLocale = locale ??
            CURRENCY_LOCALES[normalizedCurrency] ??
            "en";

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
    } catch {
        return "—";
    }
}
