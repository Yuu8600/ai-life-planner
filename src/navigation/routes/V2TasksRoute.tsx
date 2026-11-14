import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

export default function V2TasksRoute() {
  const router = useRouter();
  const userId = useAuth().session?.user.id;
  const repository = useMemo(
    () => (userId ? createSupabaseTaskRepository(userId) : null),
    [userId],
  );
  const settings = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId) : null),
    [userId],
  );
  const [profile, setProfile] = useState<{ userId: string; timezone: string }>();
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRefresh((value) => value + 1);
      if (settings && userId)
        void settings.getProfilePlanningSettings().then(
          ({ timezone }) => {
            if (active) setProfile({ userId, timezone });
          },
          () => {
            if (active) setProfile(undefined);
          },
        );
      return () => {
        active = false;
      };
    }, [settings, userId]),
  );
  return (
    <TasksScreen
      key={userId}
      repository={repository}
      refreshToken={refresh}
      onReplanTask={(taskId, date) =>
        router.navigate({
          pathname: '/today',
          params: { taskId, date, review: String(Date.now()) },
        })
      }
      planningTimezone={profile?.userId === userId ? profile?.timezone : undefined}
    />
  );
}
