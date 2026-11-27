import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { ActionStepsScreen } from '@/features/recommendations/ActionStepsScreen';
import { createSupabaseRecommendationRepository } from '@/services/supabase/repositories/SupabaseRecommendationRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

import { ActionStepsExitGuard } from '@/navigation/ActionStepsExitGuard';
import { useV25Date } from './useV25Date';

export default function ActionStepsRoute() {
  const userId = useAuth().session?.user.id;
  const { taskId, minutes } = useLocalSearchParams<{ taskId?: string; minutes?: string }>();
  return userId && typeof taskId === 'string' ? (
    <SignedInActionSteps
      key={`${userId}:${taskId}`}
      userId={userId}
      taskId={taskId}
      minutes={minutes}
    />
  ) : null;
}

function SignedInActionSteps({
  userId,
  taskId,
  minutes,
}: {
  userId: string;
  taskId: string;
  minutes?: string;
}) {
  const router = useRouter();
  const deps = useMemo(
    () => ({
      repository: createSupabaseRecommendationRepository(userId),
      tasks: createSupabaseTaskRepository(userId),
    }),
    [userId],
  );
  const settings = useMemo(() => createSupabaseSettingsRepository(userId), [userId]);
  const { date, revision, error, refresh } = useV25Date(settings);

  return (
    <ActionStepsScreen
      ExitGuard={ActionStepsExitGuard}
      date={date ?? undefined}
      revision={revision}
      dayError={error}
      refreshDay={refresh}
      {...deps}
      taskId={taskId}
      initialMinutes={
        minutes === '15' || minutes === '30' || minutes === '60' || minutes === '120'
          ? Number(minutes)
          : undefined
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
