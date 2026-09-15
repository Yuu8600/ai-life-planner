import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';

export default function SettingsRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const repository = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId) : null),
    [userId],
  );

  return <SettingsScreen onPressBack={() => router.back()} repository={repository} />;
}
