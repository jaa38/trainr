import { supabase } from '@/lib/supabase';
import {
  TRAINER_TRANSACTION_STATUSES,
  type TrainerTransaction,
  type TrainerTransactionHistory,
  type TrainerTransactionHistoryParams,
  type TrainerTransactionHistoryResult,
  type TrainerTransactionStatus,
} from '@/types/transactions';

const EDGE_FUNCTION_NAME = 'trainer-transaction-history';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveAmount(value: unknown): value is number | string {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value !== 'string') {
    return false;
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return false;
  }

  return /[1-9]/.test(value);
}

function isNullableDate(value: unknown): value is string | null {
  return (
    value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
  );
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isTransactionStatus(value: unknown): value is TrainerTransactionStatus {
  return (
    typeof value === 'string' &&
    TRAINER_TRANSACTION_STATUSES.includes(value as TrainerTransactionStatus)
  );
}

function isBookingStatus(value: unknown): boolean {
  return (
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'declined' ||
    value === 'cancelled' ||
    value === 'completed'
  );
}

function isValidTransaction(value: unknown): value is TrainerTransaction {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.bookingId) ||
    !isPositiveAmount(value.amount) ||
    !isNonEmptyString(value.currency) ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    value.provider !== 'paystack' ||
    !isTransactionStatus(value.status) ||
    !isNullableDate(value.paidAt) ||
    !isValidDate(value.createdAt) ||
    !isValidDate(value.updatedAt)
  ) {
    return false;
  }

  if (value.booking === null) {
    return true;
  }

  if (!isRecord(value.booking)) {
    return false;
  }

  return (
    value.booking.id === value.bookingId &&
    isValidDate(value.booking.scheduledStart) &&
    isValidDate(value.booking.scheduledEnd) &&
    Date.parse(value.booking.scheduledEnd) > Date.parse(value.booking.scheduledStart) &&
    isBookingStatus(value.booking.status)
  );
}

function isValidPagination(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.page) &&
    Number(value.page) > 0 &&
    Number.isSafeInteger(value.pageSize) &&
    Number(value.pageSize) > 0 &&
    Number(value.pageSize) <= MAX_PAGE_SIZE &&
    Number.isSafeInteger(value.total) &&
    Number(value.total) >= 0 &&
    Number.isSafeInteger(value.totalPages) &&
    Number(value.totalPages) >= 0 &&
    typeof value.hasNextPage === 'boolean' &&
    typeof value.hasPreviousPage === 'boolean'
  );
}

function isValidHistory(value: unknown): value is TrainerTransactionHistory {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.transactions) ||
    !value.transactions.every(isValidTransaction) ||
    !isValidPagination(value.pagination) ||
    !isRecord(value.filters)
  ) {
    return false;
  }

  const status = value.filters.status;

  return status === null || isTransactionStatus(status);
}

function getErrorMessage(error: unknown): string {
  if (isRecord(error) && isNonEmptyString(error.message)) {
    return error.message;
  }

  return 'Unable to retrieve transaction history.';
}

export async function getTrainerTransactionHistory(
  params: TrainerTransactionHistoryParams = {},
): Promise<TrainerTransactionHistoryResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    return {
      data: null,
      error: 'Invalid transaction history pagination.',
    };
  }

  if (
    params.status !== undefined &&
    !TRAINER_TRANSACTION_STATUSES.includes(params.status)
  ) {
    return {
      data: null,
      error: 'Invalid transaction status filter.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      method: 'POST',
      body: {
        page,
        pageSize,
        ...(params.status ? { status: params.status } : {}),
      },
    });

    if (error) {
      console.error('Trainer transaction history request failed:', error.message);

      return {
        data: null,
        error: 'Unable to retrieve transaction history.',
      };
    }

    if (!isValidHistory(data)) {
      console.error('Trainer transaction history returned an invalid response.');

      return {
        data: null,
        error: 'Transaction history response was invalid.',
      };
    }

    return {
      data,
      error: null,
    };
  } catch (error) {
    console.error('Trainer transaction history request failed:', getErrorMessage(error));

    return {
      data: null,
      error: 'Unable to retrieve transaction history.',
    };
  }
}
