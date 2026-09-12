import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { getSupabaseClient } from './client';

export type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

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
