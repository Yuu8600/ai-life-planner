import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TodayScreen } from '@/features/today/TodayScreen';
import { createSupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';
import { createSupabasePlannedActionExecutionRepository } from '@/services/supabase/repositories/SupabasePlannedActionExecutionRepository';
import { createSupabaseActivityLogRepository } from '@/services/supabase/repositories/SupabaseActivityLogRepository';

export default function TodayRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshToken, setRefreshToken] = useState(0);
  const hasFocused = useRef(false);
  const plannerEntry = useRef(0);
  const openPlanner = (mode: 'generate' | 'replan') => {
    plannerEntry.current += 1;
    router.push({
      pathname: '/ai',
      params: { mode, entry: `${Date.now()}-${plannerEntry.current}` },
    });
  };
  const repository = useMemo(
    () => (userId ? createSupabaseTodayRepository(userId) : null),
    [userId],
  );
  const executionRepository = useMemo(
    () => (userId ? createSupabasePlannedActionExecutionRepository() : null),
    [userId],
  );
  const activityLogRepository = useMemo(
    () => (userId ? createSupabaseActivityLogRepository(userId) : null),
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        setRefreshToken((current) => current + 1);
      } else {
        hasFocused.current = true;
      }
    }, []),
  );

  return (
    <TodayScreen
      onPressAi={() => openPlanner('generate')}
      onPressReplan={() => openPlanner('replan')}
      onPressSettings={() => router.push('/settings')}
      refreshToken={refreshToken}
      repository={repository}
      executionRepository={executionRepository}
      activityLogRepository={activityLogRepository}
    />
  );
}
