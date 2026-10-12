// src/providers/AuthProvider.tsx

import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/lib/supabase';

export type AccountType = 'gym_goer' | 'trainer';

export type UserProfile = {
  id: string;
  role: AccountType;
  account_type_selected: boolean;
  onboarding_completed: boolean;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  completeOnboardingLocally: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[Auth] State change:', event);
      console.log('[Auth] Session present:', Boolean(nextSession));

      if (!isMounted) return;

      setSession(nextSession);
      setIsLoading(false);
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

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async (id: string): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, role, account_type_selected, onboarding_completed, first_name, last_name, avatar_url',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        'Your profile could not be found. Please try signing out and signing in again.',
      );
    }

    if (data.role !== 'gym_goer' && data.role !== 'trainer') {
      throw new Error('Your profile contains an unsupported account type.');
    }

    return data as UserProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    setIsProfileLoading(true);
    setProfileError(null);

    try {
      const latestProfile = await loadProfile(userId);
      setProfile(latestProfile);
      setProfileError(null);
    } catch (error: unknown) {
      console.error('[Auth] Failed to refresh profile:', error);

      setProfile(null);
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Unable to load your profile. Please try again.',
      );

      throw error;
    } finally {
      setIsProfileLoading(false);
    }
  }, [loadProfile, userId]);

  const completeOnboardingLocally = useCallback(() => {
    setProfile((currentProfile) =>
      currentProfile
        ? {
            ...currentProfile,
            onboarding_completed: true,
          }
        : currentProfile,
    );
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    async function fetchProfile() {
      if (!userId) {
        setProfile(null);
        setProfileError(null);
        setIsProfileLoading(false);
        return;
      }

      setProfile(null);
      setProfileError(null);
      setIsProfileLoading(true);

      try {
        const latestProfile = await loadProfile(userId);

        if (isCurrentRequest) {
          setProfile(latestProfile);
          setProfileError(null);
        }
      } catch (error: unknown) {
        if (!isCurrentRequest) return;

        console.error('[Auth] Failed to load profile:', error);

        setProfile(null);
        setProfileError(
          error instanceof Error
            ? error.message
            : 'Unable to load your profile. Please try again.',
        );
      } finally {
        if (isCurrentRequest) {
          setIsProfileLoading(false);
        }
      }
    }

    void fetchProfile();

    return () => {
      isCurrentRequest = false;
    };
  }, [userId, profileRefreshKey, loadProfile]);

  const signOut = async () => {
    console.log('[Auth] Sign-out requested');

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[Auth] Failed to read session:', error.message);
      throw error;
    }

    console.log('[Auth] Session exists before sign-out:', Boolean(data.session));

    const result = await supabase.auth.signOut();

    if (result.error) {
      console.error('[Auth] Sign-out failed:', result.error.message);
      throw result.error;
    }

    setProfile(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isLoading,
        isProfileLoading,
        profileError,
        refreshProfile,
        completeOnboardingLocally,
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
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
