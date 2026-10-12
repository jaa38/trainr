import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as ExpoThemeProvider,
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { TrainrThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();

function AuthenticatedNavigation() {
  const { session, isLoading, profile, isProfileLoading, profileError } =
    useAuth();

  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    console.log('[Navigation] Auth state:', {
      sessionPresent: Boolean(session),
      isLoading,
      isProfileLoading,
      profileFound: Boolean(profile),
      accountTypeSelected: profile?.account_type_selected ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? null,
      profileRole: profile?.role ?? null,
      profileError,
    });
  }, [session, isLoading, isProfileLoading, profile, profileError]);

  useEffect(() => {
    if (isLoading || !navigationState?.key) {
      return;
    }

    const firstSegment = segments[0];
    const secondSegment = segments[1];

    const isAuthCallback =
      firstSegment === 'auth' && secondSegment === 'callback';

    const isPasswordReset =
      firstSegment === '(auth)' && secondSegment === 'reset-password';

    if (isAuthCallback || isPasswordReset) {
      return;
    }

    const isAuthScreen = firstSegment === '(auth)';
    const isWelcomeScreen = firstSegment === undefined;
    const isTabsScreen = firstSegment === '(tabs)';
    const isOnboardingScreen = firstSegment === '(onboarding)';

    // Signed-out users cannot access authenticated screens.
    if (!session) {
      if (isTabsScreen || isOnboardingScreen) {
        router.replace('/(auth)/sign-in');
      }
      return;
    }

    // Wait for the profile query to finish.
    if (isProfileLoading || (!profile && !profileError)) {
      return;
    }

    if (profileError) {
      console.error(
        '[Navigation] Profile could not be loaded:',
        profileError,
      );
      return;
    }

    if (!profile) {
      console.error(
        '[Navigation] No profile found after loading completed.',
      );
      return;
    }

    // Account selection must happen before onboarding.
    if (!profile.account_type_selected) {
      if (!isTabsScreen || segments[1] !== undefined) {
        router.replace('/(tabs)');
      }
      return;
    }

    const homeRoute =
      profile.role === 'trainer'
        ? '/(tabs)/personal-trainer'
        : '/(tabs)/gym-goer';

    const onboardingRoute =
      profile.role === 'trainer'
        ? '/(onboarding)/personal-trainer'
        : '/(onboarding)/gym-goer';

    // Incomplete users must stay within their role's onboarding flow.
    if (!profile.onboarding_completed) {
      const isAllowedOnboardingRoute =
        isOnboardingScreen &&
        (profile.role === 'trainer'
          ? secondSegment === 'personal-trainer' ||
            secondSegment === 'personal-trainer-details'
          : secondSegment === 'gym-goer' ||
            secondSegment === 'gym-goer-details' ||
            secondSegment === 'gym-goer-goals' ||
            secondSegment === 'gym-goer-preferences');

      if (!isAllowedOnboardingRoute) {
        router.replace(onboardingRoute);
      }

      return;
    }

    // Completed users should not return to onboarding or role selection.
    if (
      isWelcomeScreen ||
      isAuthScreen ||
      isOnboardingScreen ||
      !isTabsScreen
    ) {
      router.replace(homeRoute);
      return;
    }

    if (segments[1] === undefined) {
      router.replace(homeRoute);
    }
  }, [
    isLoading,
    isProfileLoading,
    navigationState?.key,
    profile,
    profileError,
    router,
    segments,
    session,
  ]);

  if (
    isLoading ||
    !navigationState?.key ||
    (Boolean(session) && isProfileLoading)
  ) {
    return null;
  }

  return (
    <>
      <AnimatedSplashOverlay />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="auth/callback" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'BarlowCondensed-Bold': BarlowCondensed_700Bold,
    'BarlowCondensed-ExtraBold': BarlowCondensed_800ExtraBold,
    'BarlowCondensed-Black': BarlowCondensed_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <TrainrThemeProvider mode="system">
      <ExpoThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <AuthProvider>
          <AuthenticatedNavigation />
        </AuthProvider>
      </ExpoThemeProvider>
    </TrainrThemeProvider>
  );
}