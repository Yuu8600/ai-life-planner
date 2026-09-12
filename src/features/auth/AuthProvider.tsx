import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AuthCredentials,
  type SignUpResult,
  type SupabaseAuthService,
  supabaseAuthService,
} from '@/services/supabase/auth';

type AuthContextValue = {
  isRestoring: boolean;
  restorationError: Error | null;
  session: Session | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: AuthCredentials) => Promise<SignUpResult>;
};

type AuthProviderProps = {
  children: ReactNode;
  service?: SupabaseAuthService;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('認証状態を確認できませんでした。');
}

export function AuthProvider({ children, service = supabaseAuthService }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restorationError, setRestorationError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let hasReceivedAuthEvent = false;
    let unsubscribe: () => void = () => undefined;
    let stopAutoRefresh: () => void = () => undefined;

    try {
      unsubscribe = service.subscribeToAuthState((_event, nextSession) => {
        hasReceivedAuthEvent = true;

        if (isMounted) {
          setSession(nextSession);
          setRestorationError(null);
        }
      });
      stopAutoRefresh = service.startAuthAutoRefresh();
    } catch (error) {
      const restorationFailure = toError(error);

      void Promise.resolve().then(() => {
        if (isMounted) {
          setRestorationError(restorationFailure);
          setIsRestoring(false);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
        stopAutoRefresh();
      };
    }

    void service
      .getCurrentSession()
      .then((restoredSession) => {
        if (isMounted && !hasReceivedAuthEvent) {
          setSession(restoredSession);
        }
      })
      .catch((error: unknown) => {
        if (isMounted && !hasReceivedAuthEvent) {
          setSession(null);
          setRestorationError(toError(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoring(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe();
      stopAutoRefresh();
    };
  }, [service]);

  const signIn = useCallback(
    async (credentials: AuthCredentials) => {
      setRestorationError(null);
      const nextSession = await service.loginWithPassword(credentials);
      setSession(nextSession);
    },
    [service],
  );

  const signUp = useCallback(
    async (credentials: AuthCredentials) => {
      setRestorationError(null);
      const result = await service.signupWithPassword(credentials);

      if (result.session) {
        setSession(result.session);
      }

      return result;
    },
    [service],
  );

  const signOut = useCallback(async () => {
    await service.logout();
    setSession(null);
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({ isRestoring, restorationError, session, signIn, signOut, signUp }),
    [isRestoring, restorationError, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuthはAuthProvider内で使用してください。');
  }

  return value;
}
