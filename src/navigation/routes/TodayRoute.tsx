import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TodayScreen } from '@/features/today/TodayScreen';
import { createSupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';
import { createSupabasePlannedActionExecutionRepository } from '@/services/supabase/repositories/SupabasePlannedActionExecutionRepository';
import { createSupabaseActivityLogRepository } from '@/services/supabase/repositories/SupabaseActivityLogRepository';

export default function TodayRoute() {
  const calendarRepository = useMemo(() => createExpoCalendarRepository(), []);
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshToken((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
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
      calendarRepository={calendarRepository}
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
