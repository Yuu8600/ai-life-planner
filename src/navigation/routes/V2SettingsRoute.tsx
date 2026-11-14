import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { AccountSection, useAuth } from '@/features/auth';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { PlannerGapSettings } from '@/features/settings/components/PlannerGapSettings';
import { SettingsExitControl } from '@/navigation/SettingsExitControl';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseDailyPlanningRepository } from '@/services/supabase/repositories/SupabaseDailyPlanningRepository';

export default function V2SettingsRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const repository = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId) : null),
    [userId],
  );
  const planner = useMemo(
    () => (userId ? createSupabaseDailyPlanningRepository(userId) : null),
    [userId],
  );
  return (
    <SettingsScreen
      CloseControl={SettingsExitControl}
      accountSection={
        <>
          {planner ? <PlannerGapSettings key={userId} repository={planner} /> : null}
          <AccountSection />
        </>
      }
      onPressBack={() => router.back()}
      repository={repository}
    />
  );
}
