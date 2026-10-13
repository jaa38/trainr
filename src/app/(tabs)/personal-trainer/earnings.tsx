import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type EarningsView = 'Overview' | 'Transactions';

export default function EarningsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const [activeView, setActiveView] = useState<EarningsView>('Overview');

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.brand.red}>
            TRAINER WORKSPACE
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            EARNINGS.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Track your revenue and manage your training business.
          </AppText>
        </View>

        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.sm,
          }}
        >
          <AppText variant="caption" color={colors.text.secondary}>
            TOTAL EARNINGS
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            —
          </AppText>

          <AppText variant="bodySmall" color={colors.text.secondary}>
            Earnings will appear when payment records are connected.
          </AppText>

          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.brand.redLight,
            }}
          >
            <AppText variant="caption" color={colors.brand.red}>
              AWAITING PAYMENT INTEGRATION
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {[
            {
              title: 'Pending',
              description: 'Unsettled payments',
            },
            {
              title: 'Settled',
              description: 'Completed payouts',
            },
          ].map((item) => (
            <View
              key={item.title}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border.default,
                gap: spacing.sm,
              }}
            >
              <AppText variant="h3" color={colors.text.primary}>
                —
              </AppText>
              <AppText variant="button" color={colors.text.primary}>
                {item.title}
              </AppText>
              <AppText variant="caption" color={colors.text.secondary}>
                {item.description}
              </AppText>
            </View>
          ))}
        </View>

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
                accessibilityState={{ selected }}
                onPress={() => setActiveView(view)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 10,
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

        <View
          style={{
            alignItems: 'center',
            padding: spacing.xl,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border.default,
            gap: spacing.md,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            {activeView === 'Overview' ? 'NO EARNINGS DATA YET' : 'NO TRANSACTIONS YET'}
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ textAlign: 'center', lineHeight: 24 }}
          >
            {activeView === 'Overview'
              ? 'Your revenue summaries and earnings breakdown will appear when TRAINR has recorded payment data.'
              : 'Payments, refunds and payout records will appear here after the payment system is integrated.'}
          </AppText>
        </View>

        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{ textAlign: 'center' }}
        >
          NO FINANCIAL VALUES ARE DISPLAYED UNTIL VERIFIED RECORDS ARE AVAILABLE.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
