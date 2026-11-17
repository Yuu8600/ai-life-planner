import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { ActionStepsScreen } from '@/features/recommendations/ActionStepsScreen';
import { createSupabaseRecommendationRepository } from '@/services/supabase/repositories/SupabaseRecommendationRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

export default function ActionStepsRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { taskId, minutes } = useLocalSearchParams<{ taskId?: string; minutes?: string }>();
  const deps = useMemo(
    () =>
      userId
        ? {
            repository: createSupabaseRecommendationRepository(userId),
            tasks: createSupabaseTaskRepository(userId),
          }
        : null,
    [userId],
  );
  if (!deps || typeof taskId !== 'string') return null;

  return (
    <ActionStepsScreen
      key={`${userId}:${taskId}`}
      {...deps}
      taskId={taskId}
      initialMinutes={
        minutes === '15' || minutes === '30' || minutes === '60' ? Number(minutes) : undefined
      }
      close={() => (router.canGoBack() ? router.back() : router.replace('/tasks'))}
      openAI={(task) =>
        router.push({
          pathname: '/ai',
          params: {
            focusKind: 'task',
            focusId: task.id,
            focusTitle: task.title,
            entry: String(Date.now()),
          },
        })
      }
    />
  );
}
