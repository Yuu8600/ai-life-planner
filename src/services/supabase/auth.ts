import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { getSupabaseClient } from './client';

export type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpResult = {
  session: Session | null;
  user: User | null;
};

export type SupabaseAuthService = {
  getCurrentSession: typeof getCurrentSession;
  loginWithPassword: typeof loginWithPassword;
  logout: typeof logout;
  signupWithPassword: typeof signupWithPassword;
  startAuthAutoRefresh: typeof startAuthAutoRefresh;
  subscribeToAuthState: typeof subscribeToAuthState;
};

export async function loginWithPassword({ email, password }: AuthCredentials): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error('ログインセッションを取得できませんでした。');
  }

  return data.session;
}

export async function signupWithPassword({
  email,
  password,
}: AuthCredentials): Promise<SignUpResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  return {
    session: data.session,
    user: data.user,
  };
}

export async function logout(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });

  if (error) {
    throw error;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export function subscribeToAuthState(listener: AuthStateListener): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange(listener);

  return () => data.subscription.unsubscribe();
}

export function startAuthAutoRefresh(): () => void {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const updateRefreshState = (state: AppStateStatus) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  updateRefreshState(AppState.currentState);
  const subscription = AppState.addEventListener('change', updateRefreshState);

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}

export const supabaseAuthService: SupabaseAuthService = {
  getCurrentSession,
  loginWithPassword,
  logout,
  signupWithPassword,
  startAuthAutoRefresh,
  subscribeToAuthState,
};
