import React from 'react';

import { fireEvent, render } from '@testing-library/react-native';

import EarningsScreen from '@/app/(tabs)/personal-trainer/earnings';
import { useTrainerEarnings } from '@/hooks/earnings/useTrainerEarnings';
import { useTrainerTransactions } from '@/hooks/transactions/useTrainerTransactions';
import type { TrainerEarningsDashboard } from '@/types/earnings';
import { formatEarningsAmount } from '@/utils/earnings/earnings-formatters';

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
      text: {
        primary: '#0B0B0B',
        secondary: '#666666',
        tertiary: '#999999',
      },
      border: {
        default: '#E5E5E5',
      },
    },
    spacing: {
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

type RenderResult = Awaited<ReturnType<typeof render>>;

const verifiedDashboard: TrainerEarningsDashboard = {
  totalEarnings: 1250,
  nextPayoutAmount: null,
  nextPayoutDate: null,
  currencyCode: 'NGN',
  financialStatus: 'available',
  nextPayoutStatus: 'not_available',
  updatedAt: '2026-01-01T00:00:00.000Z',
  recentEarnings: [],
};

const noEarningsDashboard: TrainerEarningsDashboard = {
  totalEarnings: 0,
  nextPayoutAmount: null,
  nextPayoutDate: null,
  currencyCode: 'NGN',
  financialStatus: 'no_earnings',
  nextPayoutStatus: 'not_available',
  updatedAt: '2026-01-01T00:00:00.000Z',
  recentEarnings: [],
};

const successfulTransaction = {
  id: 'transaction-001',
  bookingId: 'booking-001',
  amount: 5000,
  currency: 'NGN',
  provider: 'paystack',
  status: 'successful',
  paidAt: '2026-11-12T10:30:00.000Z',
  createdAt: '2026-11-12T10:00:00.000Z',
  updatedAt: '2026-11-12T10:30:00.000Z',
  booking: {
    id: 'booking-001',
    scheduledStart: '2026-11-12T10:00:00.000Z',
    scheduledEnd: '2026-11-12T11:00:00.000Z',
    status: 'completed',
  },
};

function createQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: true,
    fetchStatus: 'idle',
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTrainerEarnings>;
}

function createTransactionsQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      transactions: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {
        status: null,
      },
    },
    error: null,
    isPending: false,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTrainerTransactions>;
}

async function openTransactionsTab(getByRole: RenderResult['getByRole']) {
  await fireEvent.press(
    getByRole('button', {
      name: 'Transactions',
    }),
  );
}

describe('EarningsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTrainerEarnings.mockReturnValue(createQuery());
    mockUseTrainerTransactions.mockReturnValue(createTransactionsQuery());
  });

  describe('Overview', () => {
    it('renders the earnings screen header', async () => {
      const { getByText } = await render(<EarningsScreen />);

      expect(getByText('TRAINER WORKSPACE')).toBeTruthy();
      expect(getByText('EARNINGS.')).toBeTruthy();

      expect(
        getByText('Your training business, financial performance and payouts.'),
      ).toBeTruthy();
    });

    it('shows the payment integration pending state when the query is disabled', async () => {
      const { getAllByText, getByText } = await render(<EarningsScreen />);

      expect(getAllByText('AWAITING PAYMENT INTEGRATION').length).toBeGreaterThan(0);

      expect(
        getByText(
          'Your earnings dashboard will become available when payment processing and the earnings service are configured.',
        ),
      ).toBeTruthy();
    });

    it('shows a loading state while earnings are being retrieved', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          isPending: true,
          fetchStatus: 'fetching',
          isLoading: true,
        }),
      );

      const { getByText } = await render(<EarningsScreen />);

      expect(getByText('LOADING EARNINGS')).toBeTruthy();
      expect(getByText('LOADING FINANCIAL INFORMATION')).toBeTruthy();
    });

    it('displays verified earnings', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          data: {
            data: verifiedDashboard,
            error: null,
          },
          isPending: false,
          fetchStatus: 'idle',
        }),
      );

      const { getByText } = await render(<EarningsScreen />);

      expect(getByText('VERIFIED EARNINGS')).toBeTruthy();

      expect(getByText(formatEarningsAmount(1250, 'NGN'))).toBeTruthy();

      expect(getByText('Verified earnings after TRAINR commission.')).toBeTruthy();
    });

    it('displays the no earnings state', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          data: {
            data: noEarningsDashboard,
            error: null,
          },
          isPending: false,
          fetchStatus: 'idle',
        }),
      );

      const { getByText } = await render(<EarningsScreen />);

      expect(getByText('NO VERIFIED EARNINGS')).toBeTruthy();
      expect(getByText('NO EARNINGS YET')).toBeTruthy();

      expect(getByText(formatEarningsAmount(0, 'NGN'))).toBeTruthy();
    });

    it('shows an unavailable state when the query fails', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          isPending: false,
          isError: true,
          fetchStatus: 'idle',
        }),
      );

      const { getByText, queryByText } = await render(<EarningsScreen />);

      expect(getByText('FINANCIAL INFORMATION UNAVAILABLE')).toBeTruthy();

      expect(getByText('EARNINGS UNAVAILABLE')).toBeTruthy();
      expect(queryByText('TRY AGAIN')).toBeNull();
    });

    it('shows the next payout placeholder when no payout is scheduled', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          data: {
            data: verifiedDashboard,
            error: null,
          },
          isPending: false,
          fetchStatus: 'idle',
        }),
      );

      const { getAllByText } = await render(<EarningsScreen />);

      expect(getAllByText('—').length).toBeGreaterThan(0);
    });

    it('does not expose unverified financial amounts after an error', async () => {
      mockUseTrainerEarnings.mockReturnValue(
        createQuery({
          isPending: false,
          isError: true,
          fetchStatus: 'idle',
        }),
      );

      const { queryByText } = await render(<EarningsScreen />);

      expect(queryByText(formatEarningsAmount(1250, 'NGN'))).toBeNull();
    });
  });

  describe('Tab navigation', () => {
    it('switches from Overview to Transactions', async () => {
      const { getByRole } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(
        getByRole('button', { name: 'Transactions' }).props.accessibilityState?.selected,
      ).toBe(true);
    });

    it('switches back to Overview', async () => {
      const { getByRole, getAllByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      await fireEvent.press(getByRole('button', { name: 'Overview' }));

      expect(
        getByRole('button', { name: 'Overview' }).props.accessibilityState?.selected,
      ).toBe(true);

      expect(getAllByText('AWAITING PAYMENT INTEGRATION').length).toBeGreaterThan(0);
    });
  });

  describe('Transaction history', () => {
    it('renders transaction history when the Transactions tab is selected', async () => {
      const { getByRole, getByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(
        getByRole('button', { name: 'Transactions' }).props.accessibilityState?.selected,
      ).toBe(true);

      expect(getByText('TRANSACTION HISTORY')).toBeTruthy();
    });

    it('renders a successful transaction in the Transactions tab', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionsQuery({
          data: {
            transactions: [successfulTransaction],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
            filters: {
              status: null,
            },
          },
        }),
      );

      const { getByRole, getByText, getAllByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(getAllByText(/successful/i).length).toBeGreaterThan(0);

      expect(getByText(/5,000/)).toBeTruthy();
    });

    it('does not show transaction history on the Overview tab', async () => {
      const { queryByText, getByRole } = await render(<EarningsScreen />);

      expect(
        getByRole('button', { name: 'Overview' }).props.accessibilityState?.selected,
      ).toBe(true);

      expect(queryByText('TRANSACTION HISTORY')).toBeNull();
    });

    it('does not render transaction rows when the history is empty', async () => {
      mockUseTrainerTransactions.mockReturnValue(createTransactionsQuery());

      const { getByRole, queryByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(queryByText(/5,000/)).toBeNull();
    });

    it('does not render transaction rows while history is loading', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionsQuery({
          data: undefined,
          isPending: true,
          isLoading: true,
          isFetching: true,
        }),
      );

      const { getByRole, queryByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(queryByText(/5,000/)).toBeNull();
    });

    it('does not render transaction rows when history retrieval fails', async () => {
      mockUseTrainerTransactions.mockReturnValue(
        createTransactionsQuery({
          data: undefined,
          isPending: false,
          isError: true,
          error: new Error('Unable to retrieve transaction history.'),
        }),
      );

      const { getByRole, queryByText } = await render(<EarningsScreen />);

      await openTransactionsTab(getByRole);

      expect(queryByText(/5,000/)).toBeNull();
    });
  });
});
