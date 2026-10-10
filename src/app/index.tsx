import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { colors, spacing, radius } = useTrainrTheme();

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
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h1" color={colors.text.primary}>
              TRAINR
            </AppText>

            <AppText
              variant="caption"
              color={colors.text.tertiary}
              style={{
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Your fitness journey starts here
            </AppText>
          </View>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: colors.surface.muted,
              borderWidth: 1,
              borderColor: colors.border.default,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="button" color={colors.text.primary}>
              JD
            </AppText>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="displayLarge" color={colors.text.primary}>
            BUILD YOUR
          </AppText>

          <AppText variant="displayLarge" color={colors.brand.red}>
            STRONGER SELF.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: spacing.xs }}
          >
            Find your trainer. Build your routine. Make every session count.
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find your trainer"
          onPress={() => {}}
          style={{
            backgroundColor: colors.brand.red,
            borderRadius: radius.lg,
            minHeight: 56,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <AppText variant="buttonLarge" color={colors.brand.white}>
            FIND YOUR TRAINER
          </AppText>

          <AppText
            variant="buttonLarge"
            color={colors.brand.white}
            style={{ fontSize: 22 }}
          >
            →
          </AppText>
        </Pressable>

        <View style={{ gap: spacing.md }}>
          <AppText variant="h2" color={colors.text.primary}>
            YOUR FITNESS
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 132,
                padding: spacing.lg,
                gap: spacing.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.surface.subtle,
              }}
            >
              <AppText variant="caption" color={colors.text.secondary}>
                WORKOUTS
              </AppText>

              <AppText variant="metricLarge" color={colors.text.primary}>
                0
              </AppText>

              <AppText variant="bodySmall" color={colors.text.tertiary}>
                Sessions completed
              </AppText>
            </View>

            <View
              style={{
                flex: 1,
                minHeight: 132,
                padding: spacing.lg,
                gap: spacing.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.surface.subtle,
              }}
            >
              <AppText variant="caption" color={colors.text.secondary}>
                TRAINING
              </AppText>

              <AppText variant="metricLarge" color={colors.text.primary}>
                —
              </AppText>

              <AppText variant="bodySmall" color={colors.text.tertiary}>
                Your next session
              </AppText>
            </View>
          </View>
        </View>

        <View
          style={{
            padding: spacing.lg,
            gap: spacing.sm,
            borderRadius: radius.lg,
            backgroundColor: colors.surface.muted,
          }}
        >
          <AppText variant="h3" color={colors.text.primary}>
            READY TO GET STARTED?
          </AppText>

          <AppText variant="body" color={colors.text.secondary}>
            Discover personal trainers who can help you reach your fitness goals.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
