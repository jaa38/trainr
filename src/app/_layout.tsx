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
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading || !navigationState?.key) {
      return;
    }

    const firstSegment = segments[0];
    const secondSegment = segments[1];

    // Allow authentication callbacks to finish processing.
    const isAuthCallback = firstSegment === 'auth' && secondSegment === 'callback';

    // Allow users to set a new password during recovery.
    const isPasswordReset =
      firstSegment === '(auth)' && secondSegment === 'reset-password';

    if (isAuthCallback || isPasswordReset) {
      return;
    }

    const isAuthScreen = firstSegment === '(auth)';
    const isWelcomeScreen = firstSegment === undefined;
    const isTabsScreen = firstSegment === '(tabs)';

    if (session && (isWelcomeScreen || isAuthScreen)) {
      console.log('[Navigation] Authenticated user: redirecting to tabs.');
      router.replace('/(tabs)');
      return;
    }

    if (!session && isTabsScreen) {
      console.log('[Navigation] Signed-out user: redirecting to sign-in.');
      router.replace('/(auth)/sign-in');
    }
  }, [isLoading, navigationState?.key, router, segments, session]);

  if (isLoading || !navigationState?.key) {
    return null;
  }

  return (
    <>
      <AnimatedSplashOverlay />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
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
      <ExpoThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthenticatedNavigation />
        </AuthProvider>
      </ExpoThemeProvider>
    </TrainrThemeProvider>
  );
}
