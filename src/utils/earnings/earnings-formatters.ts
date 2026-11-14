
import { formatCurrency } from '../formatCurrency';

export function formatEarningsAmount(
  amount: number | null,
  currencyCode: string | null,
): string {
  if (amount === null || !currencyCode) {
    return '—';
  }

  return formatCurrency(amount, {
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPayoutDate(
  date: string | null,
): string {
  if (!date) {
    return '—';
  }

  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parsedDate);
}
