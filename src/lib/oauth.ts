import type { Provider } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export type OAuthProvider = Extract<Provider, 'google' | 'apple' | 'facebook'>;

export type OAuthResult =
  | { success: true }
  | { success: false; cancelled: true }
  | { success: false; cancelled?: false; error: string };

const providerNames: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

export async function signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    const redirectTo = Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.url) {
      return {
        success: false,
        error: `Unable to start ${providerNames[provider]} sign-in.`,
      };
    }

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
      return { success: false, cancelled: true };
    }

    if (browserResult.type !== 'success' || !browserResult.url) {
      return {
        success: false,
        error: `${providerNames[provider]} sign-in did not complete.`,
      };
    }

    const callbackUrl = new URL(browserResult.url);
    const authorizationCode = callbackUrl.searchParams.get('code');
    const callbackError =
      callbackUrl.searchParams.get('error_description') ??
      callbackUrl.searchParams.get('error');

    if (callbackError) {
      return { success: false, error: callbackError };
    }

    if (!authorizationCode) {
      return {
        success: false,
        error: 'No authorization code was returned. Please try again.',
      };
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(authorizationCode);

    if (exchangeError) {
      return { success: false, error: exchangeError.message };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Unable to complete sign-in. Please check your connection and try again.',
    };
  }
}
