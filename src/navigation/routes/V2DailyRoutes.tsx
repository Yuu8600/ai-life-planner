import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { LegacyPlanHistory } from '@/features/planner/v2/LegacyPlanHistory';
import { createSupabaseActivityLogRepository } from '@/services/supabase/repositories/SupabaseActivityLogRepository';
import { createSupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';
import { DailyPlanningScreen } from '@/features/planner/v2/DailyPlanningScreen';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseDailyPlanningRepository } from '@/services/supabase/repositories/SupabaseDailyPlanningRepository';
import { createSupabaseCalendarEventBufferRepository } from '@/services/supabase/repositories/SupabaseCalendarEventBufferRepository';

function DailyRoute({ mode }: { mode: 'today' | 'calendar' }) {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { taskId, date, review } = useLocalSearchParams<{
    taskId?: string;
    date?: string;
    review?: string;
  }>();
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
  const legacy = useMemo(
    () =>
      userId && mode === 'today'
        ? {
            plans: createSupabaseTodayRepository(userId),
            activities: createSupabaseActivityLogRepository(userId),
          }
        : null,
    [userId, mode],
  );
  if (!deps) return null;
  return (
    <DailyPlanningScreen
      key={`${userId}-${review ?? ''}-${mode === 'today' ? (date ?? '') : ''}`}
      deps={deps}
      mode={mode}
      initialDate={mode === 'today' ? date : undefined}
      review={mode === 'today' ? review : undefined}
      initialTaskId={mode === 'today' && typeof taskId === 'string' ? taskId : undefined}
      renderLegacyHistory={
        legacy ? (day) => <LegacyPlanHistory key={day} date={day} {...legacy} /> : undefined
      }
      openDayPlan={(day) =>
        router.navigate({
          pathname: '/today',
          params: { date: day, taskId: undefined, review: undefined },
        })
      }
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
