import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { GoalsScreen } from '@/features/goals/GoalsScreen';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';

export default function GoalsRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const repository = useMemo(
    () => (userId ? createSupabaseGoalRepository(userId) : null),
    [userId],
  );

  return (
    <GoalsScreen
      compactActions
      repository={repository}
      onBack={() => router.navigate('/tasks')}
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
