import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useTrainrTheme } from '@/theme';

type AccountType = 'gym_goer' | 'trainer';

type CallbackParams = {
  flow?: string | string[];
  flow_id?: string | string[];
  code?: string | string[];
  access_token?: string | string[];
  refresh_token?: string | string[];
  account_type?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
};

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAccountType(value: string | undefined): value is AccountType {
  return value === 'gym_goer' || value === 'trainer';
}

export default function AuthCallbackScreen() {
  const { colors, spacing } = useTrainrTheme();

  const {
    flow: rawFlow,
    flow_id: rawFlowId,
    code: rawCode,
    access_token: rawAccessToken,
    refresh_token: rawRefreshToken,
    account_type: rawAccountType,
    error: rawError,
    error_description: rawErrorDescription,
  } = useLocalSearchParams<CallbackParams>();

  const flow = getParam(rawFlow);
  const flowId = getParam(rawFlowId);
  const code = getParam(rawCode);
  const accessToken = getParam(rawAccessToken);
  const refreshToken = getParam(rawRefreshToken);
  const accountTypeParam = getParam(rawAccountType);
  const authError = getParam(rawError);
  const errorDescription = getParam(rawErrorDescription);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const [message, setMessage] = useState(
    flow === 'recovery'
      ? 'Preparing your password reset...'
      : 'Verifying your email address...',
  );

  const [debugInfo, setDebugInfo] = useState('Waiting for authentication parameters...');

  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    const hasCode = Boolean(code);
    const hasTokens = Boolean(accessToken && refreshToken);
    const hasAuthError = Boolean(authError || errorDescription);

    if (!hasCode && !hasTokens && !hasAuthError) {
      return;
    }

    hasProcessed.current = true;

    let mounted = true;
    let redirectTimeout: ReturnType<typeof setTimeout> | undefined;

    async function processCallback() {
      try {
        if (authError || errorDescription) {
          throw new Error(
            errorDescription || authError || 'Authentication could not be completed.',
          );
        }

        if (code) {
          setDebugInfo('Authentication code received. Exchanging for a session...');

          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(
            code,
            flowId ? { flowId } : undefined,
          );

          if (sessionError) {
            throw sessionError;
          }
        } else if (accessToken && refreshToken) {
          setDebugInfo('Authentication tokens received. Establishing a session...');

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }
        } else {
          throw new Error(
            'The authentication link did not contain usable details. Please request a new link.',
          );
        }

        if (!mounted) {
          return;
        }

        // Password recovery must not change the account type.
        if (flow === 'recovery') {
          setStatus('success');
          setMessage(
            'Your recovery link has been verified. You can now choose a new password.',
          );
          setDebugInfo('Password recovery session established.');

          redirectTimeout = setTimeout(() => {
            if (mounted) {
              router.replace('/(auth)/reset-password');
            }
          }, 1200);

          return;
        }

        // Save the selected account type through the protected RPC.
        if (isAccountType(accountTypeParam)) {
          setDebugInfo('Saving your selected account type...');

          const { error: roleError } = await supabase.rpc('select_initial_account_type', {
            requested_role: accountTypeParam,
          });

          if (roleError) {
            throw new Error(
              'Your email has been verified, but we could not save your account type. Please sign in and try again.',
            );
          }
        }

        if (!mounted) {
          return;
        }

        setStatus('success');
        setMessage('Your email has been verified. Welcome to TRAINR!');
        setDebugInfo('Email verification completed successfully.');

        redirectTimeout = setTimeout(() => {
          if (!mounted) {
            return;
          }

          if (isAccountType(accountTypeParam)) {
            router.replace(
              accountTypeParam === 'trainer'
                ? '/(tabs)/personal-trainer'
                : '/(tabs)/gym-goer',
            );
          } else {
            router.replace('/(tabs)');
          }
        }, 1200);
      } catch (callbackError) {
        if (!mounted) {
          return;
        }

        setStatus('error');

        setMessage(
          callbackError instanceof Error
            ? callbackError.message
            : flow === 'recovery'
              ? 'We could not verify your password recovery link. Please request a new one.'
              : 'We could not verify your email. Please request a new link.',
        );

        setDebugInfo('Authentication processing failed.');
      }
    }

    void processCallback();

    return () => {
      mounted = false;

      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [
    flow,
    flowId,
    code,
    accessToken,
    refreshToken,
    accountTypeParam,
    authError,
    errorDescription,
  ]);

  const waitingForParameters =
    status === 'loading' &&
    !code &&
    !accessToken &&
    !refreshToken &&
    !authError &&
    !errorDescription;

  const isRecovery = flow === 'recovery';

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
            ? isRecovery
              ? 'PREPARING.'
              : 'VERIFYING.'
            : status === 'success'
              ? isRecovery
                ? 'LINK VERIFIED.'
                : 'VERIFIED.'
              : 'UNSUCCESSFUL.'}
        </AppText>

        <AppText
          variant="body"
          color={colors.text.secondary}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {message}
        </AppText>

        {__DEV__ && (
          <AppText variant="caption" color={colors.text.secondary}>
            {waitingForParameters
              ? 'Waiting for authentication parameters from the callback URL...'
              : debugInfo}
          </AppText>
        )}

        {status === 'loading' && (
          <ActivityIndicator
            size="large"
            color={colors.brand.red}
            accessibilityLabel={
              isRecovery ? 'Preparing password reset' : 'Verifying your email'
            }
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
