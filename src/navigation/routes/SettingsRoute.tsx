import { SettingsExitControl } from '@/navigation/SettingsExitControl';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { AccountSection, useAuth } from '@/features/auth';
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

  return (
    <SettingsScreen
      CloseControl={SettingsExitControl}
      accountSection={<AccountSection />}
      onPressBack={() => router.back()}
      repository={repository}
    />
  );
}
