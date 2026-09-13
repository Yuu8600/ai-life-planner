import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

export default function TasksRoute() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshToken, setRefreshToken] = useState(0);
  const hasFocused = useRef(false);
  const repository = useMemo(
    () => (userId ? createSupabaseTaskRepository(userId) : null),
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        setRefreshToken((current) => current + 1);
      } else {
        hasFocused.current = true;
      }
    }, []),
  );

  return <TasksScreen refreshToken={refreshToken} repository={repository} />;
}
