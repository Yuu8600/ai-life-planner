import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { AccountSection, useAuth } from '@/features/auth';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { SettingsExitControl } from '@/navigation/SettingsExitControl';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';

export default function V2SettingsRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const repository = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId, { includeTaskGap: true }) : null),
    [userId],
  );
  return (
    <SettingsScreen
      CloseControl={SettingsExitControl}
      planningAccessory={
        userId ? (
          <Card>
            <SectionHeader title="高度な時間割" />
            <ActionButton
              label="時間割を開く"
              variant="secondary"
              onPress={() => router.push('/advanced-planner')}
            />
            <ActionButton
              label="固定・生活予定を管理"
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/advanced-planner', params: { plannerMode: 'calendar' } })
              }
            />
          </Card>
        ) : null
      }
      sections={[]}
      accountSection={<AccountSection />}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      repository={repository}
    />
  );
}
