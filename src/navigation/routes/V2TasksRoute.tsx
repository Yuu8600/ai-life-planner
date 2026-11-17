import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

import { useV25Date } from './useV25Date';

function SignedInTasks({ userId }: { userId: string }) {
  const router = useRouter();
  const { filter, entry } = useLocalSearchParams<{ filter?: string; entry?: string }>();
  const { repository, settings } = useMemo(
    () => ({
      repository: createSupabaseTaskRepository(userId),
      settings: createSupabaseSettingsRepository(userId),
    }),
    [userId],
  );
  const { timezone, revision, now } = useV25Date(settings);
  return (
    <TasksScreen
      key={entry ?? filter ?? 'tasks'}
      repository={repository}
      refreshToken={revision}
      planningTimezone={timezone}
      now={now}
      recommendationMode
      initialFilter={filter === 'overdue' ? 'overdue' : undefined}
      onOpenGoals={() => router.navigate('/goals')}
      onOpenSteps={(taskId) => router.push({ pathname: '/action-steps', params: { taskId } })}
    />
  );
}

export default function V2TasksRoute() {
  const userId = useAuth().session?.user.id;
  return userId ? <SignedInTasks key={userId} userId={userId} /> : null;
}
