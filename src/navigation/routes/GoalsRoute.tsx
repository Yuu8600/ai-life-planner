import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import { GoalsScreen } from '@/features/goals/GoalsScreen';
import { createSupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';

export default function GoalsRoute() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const repository = useMemo(
    () => (userId ? createSupabaseGoalRepository(userId) : null),
    [userId],
  );

  return <GoalsScreen repository={repository} />;
}
