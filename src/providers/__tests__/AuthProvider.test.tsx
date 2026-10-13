
import React from 'react';

import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { Pressable, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              role: 'gym_goer',
              first_name: 'Test',
              last_name: 'User',
              onboarding_completed: false,
              account_type_selected: true,
            },
            error: null,
          }),
        })),
      })),
    })),
  },
}));

const mockSupabase = jest.mocked(supabase);
const unsubscribe = jest.fn();
const mockSubscriptionCallback = jest.fn();

let authStateCallback:
  | ((event: string, session: Session | null) => void)
  | undefined;

function createMockSession(): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: 'test-user-id',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

function AuthConsumer() {
  const { session, user, isLoading, signOut } = useAuth();

  return (
    <View>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="session">
        {session ? 'authenticated' : 'signed-out'}
      </Text>
      <Text testID="user-id">{user?.id ?? 'no-user'}</Text>

      <Pressable
        testID="sign-out"
        onPress={() => {
          void signOut();
        }}
      >
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}

async function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

class TestErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; message: string }
> {
  state = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message,
    };
  }

  render() {
    if (this.state.hasError) {
      return <Text testID="caught-error">{this.state.message}</Text>;
    }

    return this.props.children;
  }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = undefined;

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback as typeof authStateCallback;
      mockSubscriptionCallback.mockImplementation(callback);

      return {
        data: {
          subscription: {
            id: 'test-subscription',
            callback: mockSubscriptionCallback,
            unsubscribe,
          },
        },
      };
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabase.auth.signOut.mockResolvedValue({
      error: null,
    });
  });

  it('restores a signed-out session', async () => {
    const { getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
      expect(getByTestId('session').props.children).toBe('signed-out');
      expect(getByTestId('user-id').props.children).toBe('no-user');
    });

    expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('restores an authenticated session', async () => {
    const session = createMockSession();

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const { getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
      expect(getByTestId('session').props.children).toBe('authenticated');
      expect(getByTestId('user-id').props.children).toBe(session.user.id);
    });
  });

  it('updates the session when an auth state change occurs', async () => {
    const { getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    const session = createMockSession();

    await act(async () => {
      authStateCallback?.('SIGNED_IN', session);
    });

    await waitFor(() => {
      expect(getByTestId('session').props.children).toBe('authenticated');
      expect(getByTestId('user-id').props.children).toBe(session.user.id);
    });
  });

  it('updates the session when the user signs out', async () => {
    const session = createMockSession();

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const { getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('session').props.children).toBe('authenticated');
    });

    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(getByTestId('session').props.children).toBe('signed-out');
      expect(getByTestId('user-id').props.children).toBe('no-user');
    });
  });

  it('calls Supabase signOut when requested', async () => {
    const { getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    await act(async () => {
      fireEvent.press(getByTestId('sign-out'));
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows an error when useAuth is used outside AuthProvider', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const { getByTestId } = await render(
        <TestErrorBoundary>
          <AuthConsumer />
        </TestErrorBoundary>,
      );

      await waitFor(() => {
        expect(getByTestId('caught-error').props.children).toBe(
          'useAuth must be used within an AuthProvider.',
        );
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it('unsubscribes from auth state changes on unmount', async () => {
    const { unmount, getByTestId } = await renderAuthProvider();

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });

    await unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
