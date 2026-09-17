import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { PlannerPreviewScreen } from '@/features/planner/PlannerPreviewScreen';
import { RuleBasedPlannerProvider } from '@/features/planner';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

export default function AiRoute() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshToken, setRefreshToken] = useState(0);
  const hasFocused = useRef(false);
  const calendarRepository = useMemo(() => createExpoCalendarRepository(), []);
  const goalRepository = useMemo(
    () => (userId ? createSupabaseGoalRepository(userId) : null),
    [userId],
  );
  const provider = useMemo(() => new RuleBasedPlannerProvider(), []);
  const settingsRepository = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId) : null),
    [userId],
  );
  const taskRepository = useMemo(
    () => (userId ? createSupabaseTaskRepository(userId) : null),
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshToken((current) => current + 1);
    });

    return () => subscription.remove();
  }, []);

  return (
    <PlannerPreviewScreen
      calendarRepository={calendarRepository}
      goalRepository={goalRepository}
      onOpenSettings={() => void Linking.openSettings()}
      provider={provider}
      refreshToken={refreshToken}
      settingsRepository={settingsRepository}
      taskRepository={taskRepository}
    />
  );
}
