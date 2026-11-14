import React from 'react';

import { fireEvent, render } from '@testing-library/react-native';

import EarningsScreen from '@/app/(tabs)/personal-trainer/earnings';
import { useTrainerEarnings } from '@/hooks/earnings/useTrainerEarnings';
import { useTrainerTransactions } from '@/hooks/transactions/useTrainerTransactions';
import type {
  TrainerTransactionHistory,
  TrainerTransactionHistoryParams,
} from '@/types/transactions';

jest.mock('@/hooks/earnings/useTrainerEarnings', () => ({
  TRAINER_EARNINGS_QUERY_ENABLED: false,
  useTrainerEarnings: jest.fn(),
}));

jest.mock('@/hooks/transactions/useTrainerTransactions', () => ({
  useTrainerTransactions: jest.fn(),
}));

jest.mock('@/theme', () => ({
  useTrainrTheme: () => ({
    colors: {
      background: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
      },
      brand: {
        red: '#D71920',
        redLight: '#FDE8E9',
      },
      border: {
        default: '#DDDDDD',
      },
      text: {
        primary: '#111111',
        secondary: '#666666',
        tertiary: '#999999',
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxxl: 40,
    },
  }),
}));

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    AppText: ({ children, style }: React.PropsWithChildren<{ style?: object }>) =>
      React.createElement(Text, { style }, children),
  };
});

const mockUseTrainerEarnings = jest.mocked(useTrainerEarnings);
const mockUseTrainerTransactions = jest.mocked(useTrainerTransactions);

const mockRefetchTransactions = jest.fn();

type RenderResult = Awaited<ReturnType<typeof render>>;

const mockTransaction: TrainerTransactionHistory['transactions'][number] = {
  id: 'transaction-001',
  bookingId: 'booking-001',
  amount: 12500,
  currency: 'NGN',
  provider: 'paystack',
  status: 'successful',
  paidAt: '2026-11-10T12:30:00.000Z',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:30:00.000Z',
  booking: {
    id: 'booking-001',
    scheduledStart: '2026-11-12T10:00:00.000Z',
    scheduledEnd: '2026-11-12T11:00:00.000Z',
    status: 'confirmed',
  },
};

const mockPagination: TrainerTransactionHistory['pagination'] = {
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function createTransactionHistory(
  transactions: TrainerTransactionHistory['transactions'] = [mockTransaction],
  pagination: TrainerTransactionHistory['pagination'] = mockPagination,
): TrainerTransactionHistory {
  return {
    transactions,
    pagination,
    filters: {
      status: null,
    },
  };
}

function createTransactionQuery(
  overrides: {
    data?: TrainerTransactionHistory | null;
    isLoading?: boolean;
    isError?: boolean;
    isFetching?: boolean;
  } = {},
) {
  return {
    data: 'data' in overrides ? overrides.data : createTransactionHistory(),
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isFetching: overrides.isFetching ?? false,
    refetch: mockRefetchTransactions,
  } as unknown as ReturnType<typeof useTrainerTransactions>;
}

let view: RenderResult | undefined;

function getView(): RenderResult {
  if (!view) {
    throw new Error('The Earnings screen has not been rendered.');
  }

  return view;
}

async function renderEarningsScreen(): Promise<RenderResult> {
  view = await render(<EarningsScreen />);
  return view;
}

async function openTransactionsTab() {
  await fireEvent.press(
    getView().getByRole('button', {
      name: 'Transactions',
    }),
  );
}

describe('Earnings screen — transaction history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    view = undefined;

    mockUseTrainerEarnings.mockReturnValue({
      data: {
        data: null,
        error: null,
      },
      isPending: true,
      fetchStatus: 'idle',
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    } as never);

    mockUseTrainerTransactions.mockReturnValue(createTransactionQuery());
  });

  describe('Transaction rendering', () => {
    it('renders the transaction history when the Transactions tab is selected', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('TRANSACTION HISTORY')).toBeTruthy();

      expect(
        getView().getByText('Review payments associated with your training bookings.'),
      ).toBeTruthy();
    });

    it('renders a successful transaction with its status and provider', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('Booking payment')).toBeTruthy();

      expect(getView().getByText('SUCCESSFUL')).toBeTruthy();

      expect(getView().getByText('Paystack')).toBeTruthy();

      expect(getView().getByText(/12,500/)).toBeTruthy();
    });

    it('renders the payment date', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText(/Paid/)).toBeTruthy();
    });

    it('does not show transaction history on the Overview tab', async () => {
      await renderEarningsScreen();

      expect(getView().queryByText('TRANSACTION HISTORY')).toBeNull();

      expect(getView().getByText('TOTAL EARNINGS')).toBeTruthy();
    });
  });

  describe('Transaction filters', () => {
    it('renders all transaction status filters', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      expect(
        getView().getByRole('button', {
          name: 'All transactions',
        }),
      ).toBeTruthy();

      expect(
        getView().getByRole('button', {
          name: 'Pending transactions',
        }),
      ).toBeTruthy();

      expect(
        getView().getByRole('button', {
          name: 'Successful transactions',
        }),
      ).toBeTruthy();

      expect(
        getView().getByRole('button', {
          name: 'Failed transactions',
        }),
      ).toBeTruthy();

      expect(
        getView().getByRole('button', {
          name: 'Cancelled transactions',
        }),
      ).toBeTruthy();
    });

    it('requests successful transactions when the Successful filter is selected', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Successful transactions',
        }),
      );

      expect(mockUseTrainerTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          status: 'successful',
        }),
        expect.objectContaining({
          enabled: true,
        }),
      );
    });

    it('requests failed transactions when the Failed filter is selected', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Failed transactions',
        }),
      );

      expect(mockUseTrainerTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'failed',
          page: 1,
        }),
        expect.objectContaining({
          enabled: true,
        }),
      );
    });

    it('requests all transactions when the All filter is selected', async () => {
      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Pending transactions',
        }),
      );

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'All transactions',
        }),
      );

      expect(mockUseTrainerTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
        expect.objectContaining({
          enabled: true,
        }),
      );

      const lastParams = mockUseTrainerTransactions.mock.calls[
        mockUseTrainerTransactions.mock.calls.length - 1
      ][0] as TrainerTransactionHistoryParams;

      expect(lastParams.status).toBeUndefined();
    });
  });

  describe('Empty state', () => {
    it('shows the empty state when no transactions are returned', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([]),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('NO TRANSACTIONS YET')).toBeTruthy();

      expect(
        getView().getByText(
          'Your payment transactions will appear here when they become available.',
        ),
      ).toBeTruthy();
    });

    it('shows the filtered empty state when a status has no matching transactions', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([]),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Failed transactions',
        }),
      );

      expect(getView().getByText('NO MATCHING TRANSACTIONS')).toBeTruthy();

      expect(
        getView().getByText(
          'There are no transactions matching this status. Try another filter.',
        ),
      ).toBeTruthy();
    });
  });

  describe('Loading and error states', () => {
    it('shows a loading state while transactions are being retrieved', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: null,
          isLoading: true,
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('LOADING TRANSACTIONS')).toBeTruthy();

      expect(getView().getByText('Retrieving your transaction history.')).toBeTruthy();
    });

    it('shows an error state when transaction retrieval fails', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: null,
          isError: true,
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('TRANSACTIONS UNAVAILABLE')).toBeTruthy();

      expect(
        getView().getByText(
          'We could not retrieve your transaction history. Please try again.',
        ),
      ).toBeTruthy();
    });

    it('retries transaction retrieval when Try Again is pressed', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: null,
          isError: true,
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Retry loading transactions',
        }),
      );

      expect(mockRefetchTransactions).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pagination', () => {
    it('shows pagination controls when multiple pages exist', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([mockTransaction], {
            page: 1,
            pageSize: 20,
            total: 25,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false,
          }),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(
        getView().getByRole('button', {
          name: 'Previous transaction page',
        }),
      ).toBeTruthy();

      expect(
        getView().getByRole('button', {
          name: 'Next transaction page',
        }),
      ).toBeTruthy();

      expect(getView().getByText('Page 1 of 2')).toBeTruthy();
    });

    it('requests the next page when Next is pressed', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([mockTransaction], {
            page: 1,
            pageSize: 20,
            total: 25,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false,
          }),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      await fireEvent.press(
        getView().getByRole('button', {
          name: 'Next transaction page',
        }),
      );

      expect(mockUseTrainerTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 20,
        }),
        expect.objectContaining({
          enabled: true,
        }),
      );
    });

    it('disables Previous on the first page', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([mockTransaction], {
            page: 1,
            pageSize: 20,
            total: 25,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false,
          }),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(
        getView().getByRole('button', {
          name: 'Previous transaction page',
        }).props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it('displays the total transaction count', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionQuery({
          data: createTransactionHistory([mockTransaction], {
            page: 1,
            pageSize: 20,
            total: 25,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false,
          }),
        }),
      );

      await renderEarningsScreen();
      await openTransactionsTab();

      expect(getView().getByText('25 transactions found')).toBeTruthy();
    });
  });
});
