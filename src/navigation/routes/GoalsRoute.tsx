import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { GoalsScreen } from '@/features/goals/GoalsScreen';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';

export default function GoalsRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshToken, setRefreshToken] = useState(0);
  const repository = useMemo(
    () => (userId ? createSupabaseGoalRepository(userId) : null),
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      setRefreshToken((value) => value + 1);
    }, []),
  );

  return (
    <GoalsScreen
      compactActions
      refreshToken={refreshToken}
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
