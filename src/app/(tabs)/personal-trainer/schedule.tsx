import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type ScheduleView = 'Upcoming' | 'Availability' | 'History';

const views: ScheduleView[] = ['Upcoming', 'Availability', 'History'];

export default function ScheduleScreen() {
  const { colors, spacing } = useTrainrTheme();
  const [activeView, setActiveView] = useState<ScheduleView>('Upcoming');

  const content = {
    Upcoming: {
      title: 'NO UPCOMING SESSIONS',
      description:
        'Confirmed client appointments will appear here when bookings are connected.',
    },
    Availability: {
      title: 'SET YOUR AVAILABILITY',
      description:
        'Your available training days and time slots can be managed here once scheduling is implemented.',
    },
    History: {
      title: 'NO SESSION HISTORY',
      description:
        'Completed and cancelled appointments will appear here when session records are available.',
    },
  }[activeView];

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
            SCHEDULE.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Plan your time. Show up for your clients.
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {views.map((view) => {
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
                  justifyContent: 'center',
                  paddingHorizontal: spacing.xs,
                  paddingVertical: spacing.md,
                  borderRadius: 12,
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
                  {view}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            padding: spacing.xl,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: colors.brand.red,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="h2" color="#FFFFFF">
              {activeView === 'Availability'
                ? '＋'
                : activeView === 'History'
                  ? '✓'
                  : '◷'}
            </AppText>
          </View>

          <AppText
            variant="h3"
            color={colors.text.primary}
            style={{ textAlign: 'center' }}
          >
            {content.title}
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ textAlign: 'center', lineHeight: 24 }}
          >
            {content.description}
          </AppText>
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
            SESSION CHECKLIST
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Review the booking details.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Prepare the client&apos;s workout.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Record session completion when available.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
