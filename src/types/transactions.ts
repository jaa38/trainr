export const TRAINER_TRANSACTION_STATUSES = [
  'pending',
  'successful',
  'failed',
  'cancelled',
] as const;

export type TrainerTransactionStatus = (typeof TRAINER_TRANSACTION_STATUSES)[number];

export type TrainerTransactionBooking = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
};

export type TrainerTransaction = {
  id: string;
  bookingId: string;
  amount: number | string;
  currency: string;
  provider: 'paystack';
  status: TrainerTransactionStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking: TrainerTransactionBooking | null;
};

export type TrainerTransactionPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type TrainerTransactionFilters = {
  status: TrainerTransactionStatus | null;
};

export type TrainerTransactionHistory = {
  transactions: TrainerTransaction[];
  pagination: TrainerTransactionPagination;
  filters: TrainerTransactionFilters;
};

export type TrainerTransactionHistoryParams = {
  page?: number;
  pageSize?: number;
  status?: TrainerTransactionStatus;
};

export type TrainerTransactionHistoryResult = {
  data: TrainerTransactionHistory | null;
  error: string | null;
};
