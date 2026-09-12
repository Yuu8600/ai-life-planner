import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { getSupabaseEnvironment } from './env';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client;
  }

  const { publishableKey, url } = getSupabaseEnvironment();

  client = createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: localStorage,
    },
  });

  return client;
}
