import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import {
  TRAINER_EARNINGS_QUERY_ENABLED,
  useTrainerEarnings,
} from '@/hooks/earnings/useTrainerEarnings';
import { useTrainerTransactions } from '@/hooks/transactions/useTrainerTransactions';
import { useTrainrTheme } from '@/theme';
import type { TrainerRecentEarning } from '@/types/earnings';
import type { TrainerTransactionStatus } from '@/types/transactions';
import { formatPayoutDate } from '@/utils/earnings/earnings-formatters';
import { formatCurrency } from '@/utils/formatCurrency';

type EarningsView = 'Overview' | 'Transactions';

const PAGE_SIZE = 20;

function formatDashboardAmount(
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

const TRANSACTION_FILTERS: {
  label: string;
  value: TrainerTransactionStatus | null;
}[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Successful', value: 'successful' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

function SectionLabel({ children, color }: { children: string; color: string }) {
  return (
    <AppText variant="caption" color={color}>
      {children}
    </AppText>
  );
}

/**
 * Formats a decimal amount as currency.
 *
 * Accepts both numbers and decimal strings to match the current
 * transaction type while avoiding floating-point conversion when
 * the API supplies an amount as a string.
 */

function formatTransactionAmount(amount: number | string, currency: string): string {
  const amountString = String(amount);

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amountString) || !currency?.trim()) {
    return '—';
  }

  const numericAmount = Number(amountString);

  if (!Number.isFinite(numericAmount)) {
    return '—';
  }

  return formatCurrency(numericAmount, {
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTransactionDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatStatus(status: TrainerTransactionStatus): string {
  return status.toUpperCase();
}

export default function EarningsScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [activeView, setActiveView] = useState<EarningsView>('Overview');
  const [transactionStatus, setTransactionStatus] =
    useState<TrainerTransactionStatus | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);

  const earningsQuery = useTrainerEarnings();

  const transactionsQuery = useTrainerTransactions(
    {
      page: transactionPage,
      pageSize: PAGE_SIZE,
      ...(transactionStatus ? { status: transactionStatus } : {}),
    },
    {
      enabled: activeView === 'Transactions',
    },
  );

  const dashboard = earningsQuery.data?.data ?? null;
  const serviceError = earningsQuery.data?.error ?? null;

  const recentEarnings: TrainerRecentEarning[] = dashboard?.recentEarnings ?? [];

  const isOverview = activeView === 'Overview';
  const isTransactions = activeView === 'Transactions';

  // A disabled query is not the same as a successful empty response.
  const isNotConnected =
    !TRAINER_EARNINGS_QUERY_ENABLED &&
    earningsQuery.isPending &&
    earningsQuery.fetchStatus === 'idle';

  const isLoading = earningsQuery.isLoading;
  const hasError = earningsQuery.isError || Boolean(serviceError);

  const hasVerifiedEarnings = dashboard?.financialStatus === 'available';
  const hasNoEarnings = dashboard?.financialStatus === 'no_earnings';

  const financialDataUnavailable =
    dashboard?.financialStatus === 'unavailable' || hasError;

  const totalEarnings = hasVerifiedEarnings
    ? formatDashboardAmount(dashboard.totalEarnings, dashboard.currencyCode)
    : hasNoEarnings
      ? formatDashboardAmount(0, dashboard.currencyCode)
      : '—';

  const hasScheduledPayout =
    dashboard?.nextPayoutStatus === 'scheduled' && dashboard.nextPayoutAmount !== null;

  const nextPayoutAmount = hasScheduledPayout
    ? formatDashboardAmount(dashboard.nextPayoutAmount, dashboard.currencyCode)
    : '—';

  const nextPayoutDate = hasScheduledPayout
    ? formatPayoutDate(dashboard.nextPayoutDate)
    : null;

  const verificationLabel = isNotConnected
    ? 'AWAITING PAYMENT INTEGRATION'
    : isLoading
      ? 'LOADING FINANCIAL INFORMATION'
      : financialDataUnavailable
        ? 'FINANCIAL INFORMATION UNAVAILABLE'
        : hasVerifiedEarnings
          ? 'VERIFIED EARNINGS'
          : hasNoEarnings
            ? 'NO VERIFIED EARNINGS'
            : 'AWAITING VERIFIED EARNINGS';

  const emptyStateTitle = isNotConnected
    ? 'AWAITING PAYMENT INTEGRATION'
    : isLoading
      ? 'LOADING EARNINGS'
      : financialDataUnavailable
        ? 'EARNINGS UNAVAILABLE'
        : isOverview
          ? hasNoEarnings
            ? 'NO EARNINGS YET'
            : hasVerifiedEarnings
              ? 'EARNINGS SUMMARY AVAILABLE'
              : 'AWAITING VERIFIED EARNINGS'
          : 'TRANSACTION HISTORY UNAVAILABLE';

  const emptyStateDescription = isNotConnected
    ? 'Your earnings dashboard will become available when payment processing and the earnings service are configured.'
    : isLoading
      ? 'Your financial information is being retrieved.'
      : financialDataUnavailable
        ? 'We could not retrieve your financial information. Please try again.'
        : isOverview
          ? hasNoEarnings
            ? 'Your earnings will appear here after a booking is completed and its payment has been verified.'
            : hasVerifiedEarnings
              ? 'Your verified lifetime earnings are shown above. Detailed earnings analytics will appear here when available.'
              : 'Your earnings breakdown will appear when completed bookings have verified payments and recorded trainer earnings.'
          : 'Your verified payments, earnings adjustments and payout activity will appear here when transaction history becomes available.';

  const handleRetryEarnings = () => {
    if (!TRAINER_EARNINGS_QUERY_ENABLED) return;
    void earningsQuery.refetch();
  };

  const handleStatusChange = (status: TrainerTransactionStatus | null) => {
    setTransactionStatus(status);
    setTransactionPage(1);
  };

  const transactions = transactionsQuery.data?.transactions ?? [];
  const pagination = transactionsQuery.data?.pagination ?? null;

  const transactionIsLoading = transactionsQuery.isLoading;
  const transactionHasError = transactionsQuery.isError;

  const transactionHasNoResults =
    !transactionIsLoading && !transactionHasError && transactions.length === 0;

  const transactionEmptyTitle = transactionStatus
    ? 'NO MATCHING TRANSACTIONS'
    : 'NO TRANSACTIONS YET';

  const transactionEmptyDescription = transactionStatus
    ? 'There are no transactions matching this status. Try another filter.'
    : 'Your payment transactions will appear here when they become available.';

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl * 2,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View
              accessible={false}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.brand.red,
              }}
            />

            <SectionLabel color={colors.brand.red}>TRAINER WORKSPACE</SectionLabel>
          </View>

          <AppText variant="displayLarge" color={colors.text.primary}>
            EARNINGS.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{
              maxWidth: 340,
              lineHeight: 26,
            }}
          >
            Your training business, financial performance and payouts.
          </AppText>
        </View>

        {/* COMBINED TOTAL EARNINGS & NEXT PAYOUT CARD */}
        <View
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            overflow: 'hidden',
          }}
        >
          <View
            accessible={false}
            style={{
              height: 4,
              backgroundColor: colors.brand.red,
            }}
          />

          <View
            style={{
              padding: spacing.lg,
              gap: spacing.lg,
            }}
          >
            {/* TOTAL EARNINGS */}
            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <SectionLabel color={colors.text.secondary}>TOTAL EARNINGS</SectionLabel>

                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: colors.brand.redLight,
                  }}
                >
                  <AppText variant="caption" color={colors.brand.red}>
                    ALL TIME
                  </AppText>
                </View>
              </View>

              <AppText variant="displayLarge" color={colors.text.primary}>
                {totalEarnings}
              </AppText>

              <AppText variant="caption" color={colors.text.secondary}>
                Verified earnings after TRAINR commission.
              </AppText>
            </View>

            <View
              accessible={false}
              style={{
                height: 1,
                backgroundColor: colors.border.default,
              }}
            />

            {/* NEXT PAYOUT */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  flex: 1,
                  gap: spacing.sm,
                }}
              >
                <SectionLabel color={colors.text.secondary}>NEXT PAYOUT</SectionLabel>

                <AppText variant="h2" color={colors.text.primary}>
                  {nextPayoutAmount}
                </AppText>

                <AppText variant="caption" color={colors.text.secondary}>
                  {hasScheduledPayout
                    ? 'Verified earnings allocated to your next scheduled payout.'
                    : 'A payout amount and date will appear once a payout has been verified and scheduled.'}
                </AppText>
              </View>

              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 66,
                  minHeight: 66,
                  padding: spacing.sm,
                  borderRadius: 14,
                  backgroundColor: colors.brand.redLight,
                }}
              >
                <AppText variant="caption" color={colors.brand.red}>
                  {nextPayoutDate ? 'DATE' : 'PAYOUT'}
                </AppText>

                <AppText
                  variant="h3"
                  color={colors.brand.red}
                  style={{ textAlign: 'center' }}
                >
                  {nextPayoutDate ?? '—'}
                </AppText>
              </View>
            </View>

            {/* VERIFICATION STATUS */}
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border.default,
              }}
            >
              <View
                accessible={false}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.brand.red,
                }}
              />

              <AppText variant="caption" color={colors.text.secondary}>
                {verificationLabel}
              </AppText>
            </View>
          </View>
        </View>

        {/* OVERVIEW / TRANSACTIONS */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              padding: 4,
              borderRadius: 14,
              backgroundColor: colors.background.secondary,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            {(['Overview', 'Transactions'] as const).map((view) => {
              const selected = activeView === view;

              return (
                <Pressable
                  key={view}
                  accessibilityRole="button"
                  accessibilityLabel={view}
                  accessibilityHint={`Shows the ${view.toLowerCase()} section`}
                  accessibilityState={{ selected }}
                  onPress={() => setActiveView(view)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: spacing.md,
                    borderRadius: 11,
                    backgroundColor: selected ? colors.brand.red : 'transparent',
                  }}
                >
                  <AppText
                    variant="button"
                    color={selected ? '#FFFFFF' : colors.text.secondary}
                  >
                    {view}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {isOverview ? (
            /* OVERVIEW CONTENT */
            <View style={{ gap: spacing.md }}>
              {recentEarnings.length > 0 ? (
                <>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="h3" color={colors.text.primary}>
                      RECENT EARNINGS
                    </AppText>

                    <AppText variant="bodySmall" color={colors.text.secondary}>
                      Earnings from your completed and verified training sessions.
                    </AppText>
                  </View>

                  {recentEarnings.map((earning) => (
                    <View
                      key={earning.paymentId}
                      style={{
                        padding: spacing.lg,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.background.secondary,
                        gap: spacing.md,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: spacing.md,
                        }}
                      >
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <AppText variant="body" color={colors.text.primary}>
                            Training session
                          </AppText>

                          <AppText variant="caption" color={colors.text.tertiary}>
                            Completed {formatTransactionDate(earning.completedAt)}
                          </AppText>
                        </View>

                        <View
                          style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: colors.brand.redLight,
                          }}
                        >
                          <AppText variant="caption" color={colors.brand.red}>
                            VERIFIED
                          </AppText>
                        </View>
                      </View>

                      <View
                        accessible={false}
                        style={{
                          height: 1,
                          backgroundColor: colors.border.default,
                        }}
                      />

                      <View style={{ gap: spacing.sm }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: spacing.md,
                          }}
                        >
                          <SectionLabel color={colors.text.tertiary}>
                            SESSION VALUE
                          </SectionLabel>

                          <AppText variant="bodySmall" color={colors.text.primary}>
                            {formatDashboardAmount(
                              earning.grossAmount,
                              earning.currencyCode,
                            )}
                          </AppText>
                        </View>

                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: spacing.md,
                          }}
                        >
                          <SectionLabel color={colors.text.tertiary}>
                            TRAINR COMMISSION
                          </SectionLabel>

                          <AppText variant="bodySmall" color={colors.text.secondary}>
                            {formatDashboardAmount(
                              earning.commissionAmount,
                              earning.currencyCode,
                            )}
                          </AppText>
                        </View>

                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: spacing.md,
                          }}
                        >
                          <SectionLabel color={colors.text.secondary}>
                            YOUR EARNINGS
                          </SectionLabel>

                          <AppText variant="h3" color={colors.text.primary}>
                            {formatDashboardAmount(
                              earning.trainerNetAmount,
                              earning.currencyCode,
                            )}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.xl,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <View
                    accessible={false}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      backgroundColor: colors.brand.redLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText variant="h3" color={colors.brand.red}>
                      —
                    </AppText>
                  </View>

                  <View
                    style={{
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <AppText
                      variant="h3"
                      color={colors.text.primary}
                      style={{ textAlign: 'center' }}
                    >
                      {emptyStateTitle}
                    </AppText>

                    <AppText
                      variant="bodySmall"
                      color={colors.text.secondary}
                      style={{
                        textAlign: 'center',
                        lineHeight: 24,
                      }}
                    >
                      {emptyStateDescription}
                    </AppText>
                  </View>

                  {hasError && TRAINER_EARNINGS_QUERY_ENABLED && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading earnings"
                      accessibilityHint="Attempts to retrieve your financial information again"
                      disabled={earningsQuery.isFetching}
                      onPress={handleRetryEarnings}
                      style={{
                        paddingHorizontal: spacing.xl,
                        paddingVertical: spacing.md,
                        borderRadius: 12,
                        backgroundColor: colors.brand.red,
                        opacity: earningsQuery.isFetching ? 0.6 : 1,
                      }}
                    >
                      <AppText variant="button" color="#FFFFFF">
                        {earningsQuery.isFetching ? 'RETRYING...' : 'TRY AGAIN'}
                      </AppText>
                    </Pressable>
                  )}

                  <View
                    accessible={false}
                    style={{
                      alignSelf: 'stretch',
                      height: 1,
                      backgroundColor: colors.border.default,
                    }}
                  />

                  <AppText
                    variant="caption"
                    color={colors.text.tertiary}
                    style={{ textAlign: 'center' }}
                  >
                    Financial information will only be displayed after verification.
                  </AppText>
                </View>
              )}
            </View>
          ) : (
            /* TRANSACTIONS CONTENT */
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="h3" color={colors.text.primary}>
                  TRANSACTION HISTORY
                </AppText>

                <AppText variant="bodySmall" color={colors.text.secondary}>
                  Review payments associated with your training bookings.
                </AppText>
              </View>

              {/* STATUS FILTERS */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                {TRANSACTION_FILTERS.map((filter) => {
                  const selected = transactionStatus === filter.value;

                  return (
                    <Pressable
                      key={filter.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${filter.label} transactions`}
                      accessibilityState={{ selected }}
                      onPress={() => handleStatusChange(filter.value)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: selected ? colors.brand.red : colors.border.default,
                        backgroundColor: selected
                          ? colors.brand.red
                          : colors.background.secondary,
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={selected ? '#FFFFFF' : colors.text.secondary}
                      >
                        {filter.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* TRANSACTION LOADING STATE */}
              {transactionIsLoading && (
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    padding: spacing.xl,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <AppText variant="h3" color={colors.text.primary}>
                    LOADING TRANSACTIONS
                  </AppText>

                  <AppText variant="bodySmall" color={colors.text.secondary}>
                    Retrieving your transaction history.
                  </AppText>
                </View>
              )}

              {/* TRANSACTION ERROR STATE */}
              {transactionHasError && (
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    padding: spacing.xl,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <AppText variant="h3" color={colors.text.primary}>
                    TRANSACTIONS UNAVAILABLE
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                    style={{ textAlign: 'center', lineHeight: 24 }}
                  >
                    We could not retrieve your transaction history. Please try again.
                  </AppText>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading transactions"
                    accessibilityHint="Attempts to retrieve your transaction history again"
                    disabled={transactionsQuery.isFetching}
                    onPress={() => void transactionsQuery.refetch()}
                    style={{
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.md,
                      borderRadius: 12,
                      backgroundColor: colors.brand.red,
                      opacity: transactionsQuery.isFetching ? 0.6 : 1,
                    }}
                  >
                    <AppText variant="button" color="#FFFFFF">
                      {transactionsQuery.isFetching ? 'RETRYING...' : 'TRY AGAIN'}
                    </AppText>
                  </Pressable>
                </View>
              )}

              {/* TRANSACTION EMPTY STATE */}
              {transactionHasNoResults && (
                <View
                  style={{
                    padding: spacing.xl,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <View
                    accessible={false}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      backgroundColor: colors.brand.redLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText variant="h3" color={colors.brand.red}>
                      —
                    </AppText>
                  </View>

                  <AppText
                    variant="h3"
                    color={colors.text.primary}
                    style={{ textAlign: 'center' }}
                  >
                    {transactionEmptyTitle}
                  </AppText>

                  <AppText
                    variant="bodySmall"
                    color={colors.text.secondary}
                    style={{ textAlign: 'center', lineHeight: 24 }}
                  >
                    {transactionEmptyDescription}
                  </AppText>
                </View>
              )}

              {/* TRANSACTION LIST */}
              {!transactionIsLoading &&
                !transactionHasError &&
                transactions.map((transaction) => (
                  <View
                    key={transaction.id}
                    style={{
                      padding: spacing.lg,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      backgroundColor: colors.background.secondary,
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: spacing.md,
                      }}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText variant="body" color={colors.text.primary}>
                          Booking payment
                        </AppText>

                        <AppText variant="caption" color={colors.text.tertiary}>
                          {formatTransactionDate(transaction.createdAt)}
                        </AppText>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: colors.brand.redLight,
                        }}
                      >
                        <AppText variant="caption" color={colors.brand.red}>
                          {formatStatus(transaction.status)}
                        </AppText>
                      </View>
                    </View>

                    <View
                      accessible={false}
                      style={{
                        height: 1,
                        backgroundColor: colors.border.default,
                      }}
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing.md,
                      }}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <SectionLabel color={colors.text.tertiary}>AMOUNT</SectionLabel>

                        <AppText variant="h2" color={colors.text.primary}>
                          {formatTransactionAmount(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </AppText>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                        <SectionLabel color={colors.text.tertiary}>PROVIDER</SectionLabel>

                        <AppText variant="bodySmall" color={colors.text.secondary}>
                          Paystack
                        </AppText>
                      </View>
                    </View>

                    {transaction.paidAt && (
                      <AppText variant="caption" color={colors.text.tertiary}>
                        Paid {formatTransactionDate(transaction.paidAt)}
                      </AppText>
                    )}
                  </View>
                ))}

              {/* PAGINATION */}
              {pagination && pagination.totalPages > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                    paddingTop: spacing.sm,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous transaction page"
                    disabled={!pagination.hasPreviousPage || transactionsQuery.isFetching}
                    onPress={() =>
                      setTransactionPage((current) => Math.max(1, current - 1))
                    }
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      opacity:
                        !pagination.hasPreviousPage || transactionsQuery.isFetching
                          ? 0.4
                          : 1,
                    }}
                  >
                    <AppText variant="button" color={colors.text.secondary}>
                      PREVIOUS
                    </AppText>
                  </Pressable>

                  <AppText variant="caption" color={colors.text.secondary}>
                    Page {pagination.page} of {pagination.totalPages}
                  </AppText>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next transaction page"
                    disabled={!pagination.hasNextPage || transactionsQuery.isFetching}
                    onPress={() => setTransactionPage((current) => current + 1)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      opacity:
                        !pagination.hasNextPage || transactionsQuery.isFetching ? 0.4 : 1,
                    }}
                  >
                    <AppText variant="button" color={colors.text.secondary}>
                      NEXT
                    </AppText>
                  </Pressable>
                </View>
              )}

              {/* TRANSACTION COUNT */}
              {pagination && (
                <AppText
                  variant="caption"
                  color={colors.text.tertiary}
                  style={{ textAlign: 'center' }}
                >
                  {pagination.total} transaction
                  {pagination.total === 1 ? '' : 's'} found
                </AppText>
              )}
            </View>
          )}
        </View>

        {/* FOOTER */}
        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{
            textAlign: 'center',
            lineHeight: 19,
          }}
        >
          TRAINR FINANCIAL MANAGEMENT
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
