import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { GoalsScreen } from '@/features/goals/GoalsScreen';
import { Notice } from '@/shared/components/Notice';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { useV25Date } from './useV25Date';

function SignedInGoals({ userId }: { userId: string }) {
  const router = useRouter();
  const { goals, tasks, settings } = useMemo(
    () => ({
      goals: createSupabaseGoalRepository(userId),
      tasks: createSupabaseTaskRepository(userId),
      settings: createSupabaseSettingsRepository(userId),
    }),
    [userId],
  );
  const { revision, timezone, error } = useV25Date(settings);
  return (
    <GoalsScreen
      compactActions
      repository={goals}
      taskRepository={timezone ? tasks : undefined}
      planningTimezone={timezone}
      refreshToken={revision}
      intro={error ? <Notice tone="warning" message={error} /> : undefined}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/tasks');
      }}
      onOpenAI={(goal) =>
        router.push({
          pathname: '/ai',
          params: {
            focusKind: 'goal',
            focusId: goal.id,
            focusTitle: goal.title,
            entry: String(Date.now()),
          },
        })
      }
    />
  );
}
export default function GoalLibraryRoute() {
  const userId = useAuth().session?.user.id;
  return userId ? <SignedInGoals key={userId} userId={userId} /> : null;
}
