import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[Auth] State change:', event);
      console.log('[Auth] Session present:', Boolean(nextSession));

      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          console.error(
            '[Auth] Failed to restore authentication session:',
            error.message,
          );
          setSession(null);
        } else {
          setSession(data.session);
        }

        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        console.error('[Auth] Unexpected error restoring session:', error);
        setSession(null);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('[Auth] Sign-out requested');

    const { data, error } = await supabase.auth.getSession();

    console.log('[Auth] Session exists before sign-out:', Boolean(data.session));

    if (error) {
      console.error('[Auth] Failed to read session:', error.message);
      throw error;
    }

    const result = await supabase.auth.signOut();

    if (result.error) {
      console.error('[Auth] Sign-out failed:', result.error.message);
      throw result.error;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    console.log('[Auth] Session exists after sign-out:', Boolean(sessionData.session));

    if (sessionError) {
      console.error('[Auth] Failed to verify sign-out:', sessionError.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
