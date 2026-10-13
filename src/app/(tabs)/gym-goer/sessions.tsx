import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type SessionTab = 'Upcoming' | 'History';

export default function SessionsScreen() {
  const { colors, spacing } = useTrainrTheme();
  const [activeTab, setActiveTab] = useState<SessionTab>('Upcoming');

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
            YOUR BOOKINGS
          </AppText>
          <AppText variant="displayLarge" color={colors.text.primary}>
            SESSIONS.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Your training appointments, all in one place.
          </AppText>
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
          {(['Upcoming', 'History'] as const).map((tab) => {
            const selected = activeTab === tab;

            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab)}
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
                  {tab}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            padding: spacing.xl,
            alignItems: 'center',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: colors.brand.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="h2" color="#FFFFFF">
              {activeTab === 'Upcoming' ? '＋' : '✓'}
            </AppText>
          </View>

          <AppText
            variant="h3"
            color={colors.text.primary}
            style={{ textAlign: 'center' }}
          >
            {activeTab === 'Upcoming' ? 'NO UPCOMING SESSIONS' : 'NO SESSION HISTORY'}
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ textAlign: 'center', lineHeight: 24 }}
          >
            {activeTab === 'Upcoming'
              ? 'Your confirmed bookings will appear here. Discover a personal trainer to get started.'
              : 'Your completed training sessions will appear here once you start training.'}
          </AppText>

          {activeTab === 'Upcoming' && (
            <AppText variant="caption" color={colors.text.tertiary}>
              Trainer discovery and booking integration coming next.
            </AppText>
          )}
        </View>

        <View
          style={{
            padding: spacing.lg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border.default,
            gap: spacing.sm,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            BEFORE YOUR SESSION
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            • Check your appointment details.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            • Arrive ready to train.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            • Contact your trainer if plans change.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
