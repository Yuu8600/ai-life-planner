import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
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
      planningAccessory={
        planner ? (
          <Card>
            <SectionHeader title="高度なPlanner" />
            <ActionButton
              label="時間割Plannerを開く"
              variant="secondary"
              onPress={() => router.push('/advanced-planner')}
            />
            <ActionButton
              label="Plannerの固定・生活予定を管理"
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/advanced-planner', params: { plannerMode: 'calendar' } })
              }
            />
          </Card>
        ) : null
      }
      advancedSettings={
        planner ? <PlannerGapSettings key={userId} repository={planner} /> : undefined
      }
      sections={[]}
      accountSection={<AccountSection />}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      repository={repository}
    />
  );
}
