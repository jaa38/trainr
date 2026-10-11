import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useTrainrTheme } from '@/theme';

type CallbackParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function getCallbackParams(url: string): CallbackParams {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);

  // Supabase may return tokens in the URL fragment.
  const fragment = parsedUrl.hash.replace(/^#/, '');
  const fragmentParams = new URLSearchParams(fragment);

  const get = (key: keyof CallbackParams) =>
    params.get(key) ?? fragmentParams.get(key) ?? undefined;

  return {
    code: get('code'),
    access_token: get('access_token'),
    refresh_token: get('refresh_token'),
    error: get('error'),
    error_description: get('error_description'),
  };
}

export default function AuthCallbackScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const [message, setMessage] = useState('Verifying your email address...');

  const hasProcessed = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function handleCallback(url: string | null) {
      if (!url || hasProcessed.current) return;

      console.log('[AuthCallback] Received callback URL:', Boolean(url));

      let params: CallbackParams;

      try {
        params = getCallbackParams(url);
      } catch {
        if (mounted) {
          setStatus('error');
          setMessage(
            'The verification link could not be read. Please request a new link.',
          );
        }
        return;
      }

      console.log('[AuthCallback] Has code:', Boolean(params.code));
      console.log('[AuthCallback] Has access token:', Boolean(params.access_token));
      console.log('[AuthCallback] Has refresh token:', Boolean(params.refresh_token));
      console.log('[AuthCallback] Has error:', Boolean(params.error));

      if (
        !params.code &&
        !(params.access_token && params.refresh_token) &&
        !params.error &&
        !params.error_description
      ) {
        console.log('[AuthCallback] No authentication parameters found.');
        return;
      }

      hasProcessed.current = true;

      try {
        if (params.error || params.error_description) {
          throw new Error(
            params.error_description || params.error || 'Email verification failed.',
          );
        }

        if (params.code) {
          console.log('[AuthCallback] Exchanging code for session.');

          const { error } = await supabase.auth.exchangeCodeForSession(params.code);

          if (error) throw error;
        } else if (params.access_token && params.refresh_token) {
          console.log('[AuthCallback] Setting session from tokens.');

          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (error) throw error;
        } else {
          throw new Error(
            'The verification link did not contain usable authentication details. Please request a new email.',
          );
        }

        if (!mounted) return;

        console.log('[AuthCallback] Authentication succeeded.');

        setStatus('success');
        setMessage('Your email has been verified. Welcome to TRAINR!');

        setTimeout(() => {
          if (mounted) router.replace('/(tabs)');
        }, 800);
      } catch (err) {
        if (!mounted) return;

        console.error(
          '[AuthCallback] Verification failed:',
          err instanceof Error ? err.message : 'Unknown error',
        );

        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'We could not verify your email. Please request a new link.',
        );
      }
    }

    // Handle a link that launched the app.
    void Linking.getInitialURL().then(handleCallback);

    // Handle a link received while the app is already open.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleCallback(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <View
        style={{
          flex: 1,
          padding: spacing.lg,
          justifyContent: 'center',
          gap: spacing.lg,
        }}
      >
        <AppText variant="h1" color={colors.text.primary}>
          TRAINR
        </AppText>

        <AppText
          variant="displayLarge"
          color={status === 'error' ? colors.text.error : colors.brand.red}
        >
          {status === 'loading'
            ? 'VERIFYING.'
            : status === 'success'
              ? 'VERIFIED.'
              : 'NOT VERIFIED.'}
        </AppText>

        <AppText
          variant="body"
          color={colors.text.secondary}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {message}
        </AppText>

        {status === 'loading' && (
          <ActivityIndicator
            size="large"
            color={colors.brand.red}
            accessibilityLabel="Verifying your email"
          />
        )}

        {status === 'error' && (
          <Button fullWidth onPress={() => router.replace('/(auth)/sign-in')}>
            Return to Sign In
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
