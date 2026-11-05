import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { PlannerPreviewScreen } from '@/features/planner/PlannerPreviewScreen';
import {
  DEFAULT_PLANNER_PROVIDER_ID,
  RuleBasedPlannerProvider,
  selectPlannerProvider,
  type PlannerProviderId,
} from '@/features/planner';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createEdgeFunctionPlannerProvider } from '@/services/supabase/providers/EdgeFunctionPlannerProvider';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';
import { createSupabasePlannerPersistenceRepository } from '@/services/supabase/repositories/SupabasePlannerPersistenceRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';
import { createSupabasePlannerReplanRepository } from '@/services/supabase/repositories/SupabasePlannerReplanRepository';

export default function AiRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; entry?: string }>();
  const mode = params.mode === 'replan' ? 'replan' : 'generate';
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const replanRepository = useMemo(
    () => (userId ? createSupabasePlannerReplanRepository() : null),
    [userId],
  );
  const returnToToday = useCallback(() => {
    router.setParams({ mode: undefined, entry: undefined });
    router.navigate('/today');
  }, [router]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [providerId, setProviderId] = useState<PlannerProviderId>(DEFAULT_PLANNER_PROVIDER_ID);
  const [openAiAvailability, setOpenAiAvailability] = useState<
    'available' | 'checking' | 'unavailable'
  >('checking');
  const hasFocused = useRef(false);
  const calendarRepository = useMemo(() => createExpoCalendarRepository(), []);
  const goalRepository = useMemo(
    () => (userId ? createSupabaseGoalRepository(userId) : null),
    [userId],
  );
  const ruleBasedProvider = useMemo(() => new RuleBasedPlannerProvider(), []);
  const openAiProvider = useMemo(() => createEdgeFunctionPlannerProvider(), []);
  const provider = useMemo(
    () =>
      selectPlannerProvider({ openai: openAiProvider, ruleBased: ruleBasedProvider }, providerId),
    [openAiProvider, providerId, ruleBasedProvider],
  );
  const persistenceRepository = useMemo(
    () => (userId ? createSupabasePlannerPersistenceRepository() : null),
    [userId],
  );
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

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setOpenAiAvailability('checking');
    });
    void openAiProvider
      .checkAvailability()
      .then((result) => {
        if (active) setOpenAiAvailability(result.available ? 'available' : 'unavailable');
      })
      .catch(() => {
        if (active) setOpenAiAvailability('unavailable');
      });
    return () => {
      active = false;
    };
  }, [openAiProvider, refreshToken, userId]);

  return (
    <PlannerPreviewScreen
      key={`${userId}-${mode}-${typeof params.entry === 'string' ? params.entry : ''}`}
      mode={mode}
      replanRepository={replanRepository}
      onReplanSaved={returnToToday}
      onCancelReplan={returnToToday}
      onPressToday={returnToToday}
      calendarRepository={calendarRepository}
      goalRepository={goalRepository}
      onOpenSettings={() => void Linking.openSettings()}
      onSelectProvider={setProviderId}
      openAiAvailability={userId ? openAiAvailability : 'unavailable'}
      persistenceRepository={persistenceRepository}
      provider={provider}
      refreshToken={refreshToken}
      settingsRepository={settingsRepository}
      taskRepository={taskRepository}
    />
  );
}
