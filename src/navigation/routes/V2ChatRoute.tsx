import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import type { ChatFocus } from '@/features/ai-chat/v2/repository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';
import { getUtcDayBounds } from '@/features/today';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';

export default function V2ChatRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { focusKind, focusId, focusTitle, entry, date, intent } = useLocalSearchParams<{
    focusKind?: string;
    focusId?: string;
    focusTitle?: string;
    entry?: string;
    date?: string;
    intent?: string;
  }>();
  const focus: ChatFocus | undefined =
    (focusKind === 'task' || focusKind === 'goal') && focusId && focusTitle
      ? { kind: focusKind, id: focusId, title: focusTitle }
      : undefined;
  const repository = useMemo(
    () => (userId ? createSupabaseChatRepository(userId) : null),
    [userId],
  );
  return repository ? (
    <ChatScreen
      key={`${userId}:${entry ?? ''}`}
      focus={focus}
      initialDate={date}
      loadGoals={userId ? () => createSupabaseTaskRepository(userId).listGoalOptions() : undefined}
      taskEditIntent={intent === 'edit'}
      readCalendar={
        userId
          ? async (day) => {
              const calendar = createExpoCalendarRepository();
              const [permission, settings] = await Promise.all([
                calendar.getPermission(),
                createSupabaseSettingsRepository(userId).getProfilePlanningSettings(),
              ]);
              if (permission.status !== 'granted') throw new Error('Calendar permission');
              const result = await calendar.listEvents(
                getUtcDayBounds(day, settings.timezone),
                day,
              );
              if (!result.calendarCount) throw new Error('No readable calendars');
              return { events: result.events, timezone: settings.timezone };
            }
          : undefined
      }
      repository={repository}
      openApplied={(recommendations) => router.navigate(recommendations ? '/today' : '/tasks')}
      reviewPlan={(plan) =>
        router.push({
          pathname: '/advanced-planner',
          params: { date: plan.date, taskId: plan.taskId ?? undefined, review: String(Date.now()) },
        })
      }
    />
  ) : null;
}
