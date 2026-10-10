import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

export default function HomeScreen() {
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

          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            YOUR FITNESS. YOUR JOURNEY.
          </AppText>
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
            Whether you want to reach your fitness goals or help others reach theirs, your
            next chapter starts here.
          </AppText>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: 'auto',
            paddingTop: spacing.xl,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.brand.red,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <AppText variant="buttonLarge" color="#FFFFFF">
              Join Us
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.brand.red,
              backgroundColor: colors.background.primary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <AppText variant="buttonLarge" color={colors.brand.red}>
              Lock In
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
