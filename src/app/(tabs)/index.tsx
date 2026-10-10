import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

export default function HomeTabScreen() {
  const { colors, spacing } = useTrainrTheme();

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
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="h1" color={colors.text.primary}>
            TRAINR
          </AppText>
          <AppText variant="caption" color={colors.text.tertiary}>
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="displayLarge" color={colors.text.primary}>
            WELCOME BACK.
          </AppText>
          <AppText variant="body" color={colors.text.secondary}>
            Your fitness journey continues here.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
