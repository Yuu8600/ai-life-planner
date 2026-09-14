import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TodayScreen } from '@/features/today/TodayScreen';
import { createSupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';

export default function TodayRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const repository = useMemo(
    () => (userId ? createSupabaseTodayRepository(userId) : null),
    [userId],
  );

  return (
    <TodayScreen
      onPressAi={() => router.push('/ai')}
      onPressSettings={() => router.push('/settings')}
      repository={repository}
    />
  );
}
