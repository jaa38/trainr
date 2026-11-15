
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Wallet,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainerPayoutManagement } from '@/hooks/payouts/useTrainerPayoutManagement';
import { useTrainrTheme } from '@/theme';

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return 'Not available';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_verification: 'Pending verification',
    verified: 'Verified',
    rejected: 'Rejected',
    disabled: 'Disabled',
    pending_approval: 'Pending approval',
    approved: 'Approved',
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return labels[status] ?? status.replaceAll('_', ' ');
}

export default function PayoutManagementScreen() {
  const router = useRouter();
  const { colors, spacing } = useTrainrTheme();

  const {
    data: result,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useTrainerPayoutManagement();

  const payoutData = result?.data;
  const payoutAccounts = payoutData?.payoutAccounts ?? [];
  const payoutHistory = payoutData?.payoutHistory ?? [];
  const payoutAvailability = payoutData?.payoutAvailability;

  const cardStyle = {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.secondary,
    gap: spacing.md,
  };

  const mutedText = colors.text.secondary;

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
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to trainer profile"
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            alignSelf: 'flex-start',
            paddingVertical: spacing.sm,
          }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />

          <AppText variant="body" color={colors.text.primary}>
            Back
          </AppText>
        </Pressable>

        {/* Screen Header */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            FINANCIAL MANAGEMENT
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            PAYOUTS.
          </AppText>

          <AppText variant="body" color={mutedText}>
            Manage your payout account, review payout history and track
            payment status.
          </AppText>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={cardStyle}>
            <RefreshCw size={24} color={colors.brand.red} />

            <AppText variant="h2" color={colors.text.primary}>
              Loading payout information
            </AppText>

            <AppText variant="body" color={mutedText}>
              Retrieving your payout account and payment history.
            </AppText>
          </View>
        )}

        {/* Error State */}
        {isError && (
          <View style={cardStyle}>
            <AlertCircle size={26} color={colors.brand.red} />

            <AppText variant="h2" color={colors.text.primary}>
              Unable to load payouts
            </AppText>

            <AppText variant="body" color={mutedText}>
              We couldn't retrieve your payout information. Please try again.
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => refetch()}
              style={{
                alignSelf: 'flex-start',
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="body" color="#FFFFFF">
                Try again
              </AppText>
            </Pressable>
          </View>
        )}

        {/* Payout Information */}
        {!isLoading && !isError && payoutData && (
          <>
            {/* Payout Availability */}
            <View style={cardStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Wallet size={22} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  Payout availability
                </AppText>
              </View>

              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: 20,
                  backgroundColor: colors.brand.redLight,
                }}
              >
                <AppText variant="caption" color={colors.brand.red}>
                  {payoutAvailability?.payoutsEnabled
                    ? 'Payouts enabled'
                    : 'Currently unavailable'}
                </AppText>
              </View>

              <AppText variant="body" color={mutedText}>
                {payoutAvailability?.payoutsEnabled
                  ? 'Payout availability is enabled. Your balance and payout eligibility are subject to the applicable payout rules.'
                  : 'Payout processing has not yet been enabled. You can review your account information and payout history, but transfers are not currently available.'}
              </AppText>

              {payoutAvailability?.availableBalance !== null &&
                payoutAvailability?.availableBalance !== undefined &&
                payoutAvailability.currencyCode && (
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="caption" color={mutedText}>
                      Available balance
                    </AppText>

                    <AppText variant="h2" color={colors.text.primary}>
                      {formatCurrency(
                        payoutAvailability.availableBalance,
                        payoutAvailability.currencyCode,
                      )}
                    </AppText>
                  </View>
                )}
            </View>

            {/* Payout Account */}
            <View style={cardStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <CreditCard size={22} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  Payout account
                </AppText>
              </View>

              {payoutAccounts.length === 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    No payout account found
                  </AppText>

                  <AppText variant="body" color={mutedText}>
                    Your payout destination will appear here once an account
                    has been configured.
                  </AppText>
                </View>
              ) : (
                payoutAccounts.map((account) => (
                  <View
                    key={account.id}
                    style={{
                      padding: spacing.md,
                      borderRadius: 14,
                      backgroundColor: colors.background.primary,
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                      }}
                    >
                      <AppText variant="body" color={colors.text.primary}>
                        {account.destinationType
                          .replaceAll('_', ' ')
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </AppText>

                      {account.isDefault && (
                        <AppText variant="caption" color={colors.brand.red}>
                          DEFAULT
                        </AppText>
                      )}
                    </View>

                    <AppText variant="h2" color={colors.text.primary}>
                      {account.maskedAccountLabel ?? 'Details unavailable'}
                    </AppText>

                    <AppText variant="caption" color={mutedText}>
                      {account.countryCode} · {account.currencyCode}
                    </AppText>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                      }}
                    >
                      {account.verificationStatus === 'verified' ? (
                        <CheckCircle2
                          size={16}
                          color={colors.brand.red}
                        />
                      ) : (
                        <Clock3 size={16} color={mutedText} />
                      )}

                      <AppText variant="caption" color={mutedText}>
                        {getStatusLabel(account.verificationStatus)}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Payout History */}
            <View style={cardStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Clock3 size={22} color={colors.brand.red} />

                <AppText variant="h2" color={colors.text.primary}>
                  Payout history
                </AppText>
              </View>

              <AppText variant="caption" color={mutedText}>
                YOUR RECENT PAYOUTS
              </AppText>

              {payoutHistory.length === 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="body" color={colors.text.primary}>
                    No payout history yet
                  </AppText>

                  <AppText variant="body" color={mutedText}>
                    Your payout records will appear here when payouts have
                    been created.
                  </AppText>
                </View>
              ) : (
                payoutHistory.map((payout) => (
                  <View
                    key={payout.id}
                    style={{
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.default,
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText
                          variant="body"
                          color={colors.text.primary}
                        >
                          {formatDate(payout.createdAt)}
                        </AppText>

                        <AppText variant="caption" color={mutedText}>
                          {payout.marketId}
                        </AppText>
                      </View>

                      <AppText
                        variant="body"
                        color={colors.text.primary}
                      >
                        {formatCurrency(payout.amount, payout.currencyCode)}
                      </AppText>
                    </View>

                    <AppText variant="caption" color={mutedText}>
                      {getStatusLabel(payout.status)}
                    </AppText>

                    {payout.failureMessage && (
                      <AppText variant="caption" color={colors.brand.red}>
                        {payout.failureMessage}
                      </AppText>
                    )}

                    {payout.paidAt && (
                      <AppText variant="caption" color={mutedText}>
                        Paid on {formatDate(payout.paidAt)}
                      </AppText>
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* Refresh */}
        {!isLoading && !isError && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh payout information"
            onPress={() => refetch()}
            disabled={isRefetching}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
            }}
          >
            <RefreshCw
              size={16}
              color={colors.text.secondary}
            />

            <AppText variant="caption" color={mutedText}>
              {isRefetching ? 'Refreshing...' : 'Refresh payout information'}
            </AppText>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
