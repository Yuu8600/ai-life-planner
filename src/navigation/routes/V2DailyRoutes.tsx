import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { DailyPlanningScreen } from '@/features/planner/v2/DailyPlanningScreen';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseDailyPlanningRepository } from '@/services/supabase/repositories/SupabaseDailyPlanningRepository';
import { createSupabaseCalendarEventBufferRepository } from '@/services/supabase/repositories/SupabaseCalendarEventBufferRepository';

function DailyRoute({ mode }: { mode: 'today' | 'calendar' }) {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const deps = useMemo(
    () =>
      userId
        ? {
            repository: createSupabaseDailyPlanningRepository(userId),
            calendar: createExpoCalendarRepository(),
            buffers: createSupabaseCalendarEventBufferRepository(userId),
          }
        : null,
    [userId],
  );
  if (!deps) return null;
  return (
    <DailyPlanningScreen
      key={userId}
      deps={deps}
      mode={mode}
      initialTaskId={mode === 'today' && typeof taskId === 'string' ? taskId : undefined}
      openSettings={() => router.push('/settings')}
    />
  );
}

export function TodayRoute() {
  return <DailyRoute mode="today" />;
}
export function CalendarRoute() {
  return <DailyRoute mode="calendar" />;
}
