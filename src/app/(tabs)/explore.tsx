import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { supabase } from '@/lib/supabase';
import { useTrainrTheme } from '@/theme';

type ConnectionStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ExploreScreen() {
  const theme = useTrainrTheme();
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [message, setMessage] = useState('Run the test to verify your connection.');

  const [authCheckStatus, setAuthCheckStatus] = useState<ConnectionStatus>('idle');
  const [authCheckMessage, setAuthCheckMessage] = useState(
    'Sign in to test authenticated Edge Function access.',
  );

  async function testConnection() {
    setStatus('loading');
    setMessage('Connecting to Supabase...');

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      if (!url || !key) {
        throw new Error('Supabase environment variables are missing.');
      }

      const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/health`, {
        headers: {
          apikey: key,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase responded with status ${response.status}.`);
      }

      setStatus('success');
      setMessage(
        data.session
          ? 'Supabase is reachable. An existing session was found.'
          : 'Supabase is reachable. No active session was found.',
      );
    } catch {
      setStatus('error');
      setMessage('Connection failed. Check your .env values, network, and Metro logs.');
    }
  }

  async function testAuthenticatedFunction() {
    setAuthCheckStatus('loading');
    setAuthCheckMessage('Checking your authenticated session...');

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session?.access_token) {
        throw new Error('Please sign in before running this test.');
      }

      const { data: result, error: functionError } = await supabase.functions.invoke(
        'auth-check',
        {
          method: 'GET',
        },
      );

      if (functionError) {
        throw functionError;
      }

      if (!result?.ok || result.authenticated !== true) {
        throw new Error('The diagnostic function did not confirm authentication.');
      }

      setAuthCheckStatus('success');
      setAuthCheckMessage('Authenticated request successful. No payment was created.');
    } catch (error) {
      setAuthCheckStatus('error');
      setAuthCheckMessage(
        error instanceof Error
          ? error.message
          : 'Authentication check failed. Check the app logs.',
      );
    }
  }

  const statusColor =
    status === 'success'
      ? theme.colors.success
      : status === 'error'
        ? theme.colors.error
        : theme.colors.text.secondary;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.sizes.screenPadding,
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.background.primary,
      }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="h1">Backend check</AppText>
        <AppText variant="body" color={theme.colors.text.secondary}>
          Verify that TRAINR can communicate with its Supabase backend.
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.default,
          backgroundColor: theme.colors.surface.default,
        }}
      >
        <AppText variant="h3">Supabase connection</AppText>

        <AppText variant="body" color={statusColor} accessibilityLiveRegion="polite">
          {status === 'success'
            ? 'Connection successful'
            : status === 'error'
              ? 'Connection failed'
              : status === 'loading'
                ? 'Testing connection...'
                : 'Not tested yet'}
        </AppText>

        <AppText variant="body" color={theme.colors.text.secondary}>
          {message}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test Supabase connection"
          accessibilityState={{ disabled: status === 'loading' }}
          disabled={status === 'loading'}
          onPress={testConnection}
          style={({ pressed }) => ({
            minHeight: theme.sizes.buttonLarge,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            opacity: status === 'loading' ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          {status === 'loading' ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <AppText variant="buttonLarge" color={theme.colors.text.inverse}>
              Test connection
            </AppText>
          )}
        </Pressable>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.default,
          backgroundColor: theme.colors.surface.default,
        }}
      >
        <AppText variant="h3">Authenticated Edge Function</AppText>

        <AppText
          variant="body"
          color={
            authCheckStatus === 'success'
              ? theme.colors.success
              : authCheckStatus === 'error'
                ? theme.colors.error
                : theme.colors.text.secondary
          }
          accessibilityLiveRegion="polite"
        >
          {authCheckStatus === 'success'
            ? 'Authentication successful'
            : authCheckStatus === 'error'
              ? 'Authentication check failed'
              : authCheckStatus === 'loading'
                ? 'Checking authentication...'
                : 'Not tested yet'}
        </AppText>

        <AppText variant="body" color={theme.colors.text.secondary}>
          {authCheckMessage}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test authenticated Edge Function"
          accessibilityState={{ disabled: authCheckStatus === 'loading' }}
          disabled={authCheckStatus === 'loading'}
          onPress={testAuthenticatedFunction}
          style={({ pressed }) => ({
            minHeight: theme.sizes.buttonLarge,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            opacity: authCheckStatus === 'loading' ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          {authCheckStatus === 'loading' ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <AppText variant="buttonLarge" color={theme.colors.text.inverse}>
              Test authenticated function
            </AppText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
