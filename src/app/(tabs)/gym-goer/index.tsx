import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useAuth } from '@/providers/AuthProvider';
import { useTrainrTheme } from '@/theme';

export default function HomeTabScreen() {
  const { colors, spacing, mode } = useTrainrTheme();
  const { signOut } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (error) {
      console.error('[Home] Sign-out or navigation failed:', error);

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const appIcon =
    mode === 'dark'
      ? require('../../../../assets/images/icons/darkModeAppIcon.png')
      : require('../../../../assets/images/icons/lightModeAppIcon.png');

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
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xxxl,
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
              YOUR FITNESS. YOUR JOURNEY.
            </AppText>
          </View>

          {/* Theme-aware App Icon */}
          <Image
            source={appIcon}
            accessibilityLabel="TRAINR app icon"
            resizeMode="contain"
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
            }}
          />
        </View>

        {/* Welcome Section */}
        <View
          style={{
            gap: spacing.sm,
            marginBottom: spacing.xl,
          }}
        >
          <AppText
            variant="caption"
            color={colors.brand.red}
            style={{
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            YOUR NEXT CHAPTER
          </AppText>

          <AppText variant="displayLarge" color={colors.text.primary}>
            WELCOME
          </AppText>

          <AppText variant="displayLarge" color={colors.brand.red}>
            BACK.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{
              lineHeight: 24,
              marginTop: spacing.xs,
            }}
          >
            Your fitness journey continues here. Stay focused, keep showing up, and make
            every session count.
          </AppText>
        </View>

        {/* Fitness Feature Card */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
            gap: spacing.md,
            marginBottom: spacing.xl,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.brand.red,
            }}
          />

          <AppText variant="h2" color={colors.text.primary}>
            BUILT THROUGH GRIT.
          </AppText>

          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ lineHeight: 24 }}
          >
            Every challenge builds resilience. Every session moves you closer to your
            potential.
          </AppText>

          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              backgroundColor: colors.brand.red,
            }}
          >
            <AppText variant="button" color="#FFFFFF">
              KEEP MOVING
            </AppText>
          </View>
        </View>

        {/* Sign Out Section */}
        <View
          style={{
            paddingTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          {errorMessage ? (
            <View
              accessibilityRole="alert"
              style={{
                padding: spacing.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.brand.red,
                backgroundColor: colors.background.secondary,
              }}
            >
              <AppText variant="bodySmall" color={colors.text.error}>
                {errorMessage}
              </AppText>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of TRAINR"
            accessibilityState={{
              disabled: isSigningOut,
              busy: isSigningOut,
            }}
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => ({
              minHeight: 54,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.primary,
              opacity: isSigningOut ? 0.6 : pressed ? 0.75 : 1,
            })}
          >
            <AppText variant="buttonLarge" color={colors.text.primary}>
              {isSigningOut ? 'Signing Out…' : 'Sign Out'}
            </AppText>
          </Pressable>

          <AppText
            variant="caption"
            color={colors.text.tertiary}
            style={{ textAlign: 'center' }}
          >
            KEEP SHOWING UP. YOUR WORK ADDS UP.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
