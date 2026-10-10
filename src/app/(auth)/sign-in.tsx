import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

export default function SignInScreen() {
  const { colors, spacing } = useTrainrTheme();

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        padding: spacing.lg,
        backgroundColor: colors.background.primary,
      }}
    >
      <View style={{ gap: spacing.lg }}>
        <AppText variant="h1" color={colors.text.primary}>
          WELCOME BACK
        </AppText>

        <AppText variant="body" color={colors.text.secondary}>
          Sign in to continue your TRAINR journey.
        </AppText>

        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <AppText variant="buttonLarge" color={colors.brand.red}>
            Back to welcome
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
