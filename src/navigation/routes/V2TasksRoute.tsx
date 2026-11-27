import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { createSupabaseRecommendationRepository } from '@/services/supabase/repositories/SupabaseRecommendationRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

import { useV25Date } from './useV25Date';

function SignedInTasks({ userId }: { userId: string }) {
  const router = useRouter();
  const { filter, entry } = useLocalSearchParams<{ filter?: string; entry?: string }>();
  const { repository, settings, recommendations } = useMemo(
    () => ({
      repository: createSupabaseTaskRepository(userId),
      settings: createSupabaseSettingsRepository(userId),
      recommendations: createSupabaseRecommendationRepository(userId),
    }),
    [userId],
  );
  const { timezone, revision, now, error, refresh } = useV25Date(settings);
  return (
    <TasksScreen
      repository={repository}
      refreshToken={revision}
      planningTimezone={timezone}
      now={now}
      recommendationMode
      recommendations={recommendations}
      dayError={error}
      retryDay={refresh}
      initialFilter={filter === 'overdue' ? 'overdue' : undefined}
      filterEntry={entry}
      onAskAI={(task) =>
        router.push({
          pathname: '/ai',
          params: {
            intent: 'edit',
            focusKind: 'task',
            focusId: task.id,
            focusTitle: task.title,
            entry: String(Date.now()),
          },
        })
      }
      onOpenGoals={() => router.push('/goal-library')}
      onOpenSteps={(taskId) => router.push({ pathname: '/action-steps', params: { taskId } })}
    />
  );
}

export default function V2TasksRoute() {
  const userId = useAuth().session?.user.id;
  return userId ? <SignedInTasks key={userId} userId={userId} /> : null;
}
