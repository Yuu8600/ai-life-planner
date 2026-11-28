import { useMemo } from 'react';
import { useRouter } from 'expo-router';
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
      sections={[]}
      accountSection={<AccountSection />}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      repository={repository}
    />
  );
}
