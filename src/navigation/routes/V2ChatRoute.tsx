import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import type { ChatFocus } from '@/features/ai-chat/v2/repository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';
import { readCalendarForShare } from '@/features/ai-chat/v2/readCalendarForShare';
import { createSupabaseFixedEventRepository } from '@/services/supabase/repositories/SupabaseFixedEventRepository';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';

export default function V2ChatRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { focusKind, focusId, focusTitle, entry, date, intent, prepareCalendar } =
    useLocalSearchParams<{
      focusKind?: string;
      focusId?: string;
      focusTitle?: string;
      entry?: string;
      date?: string;
      intent?: string;
      prepareCalendar?: string;
    }>();
  const focus: ChatFocus | undefined =
    (focusKind === 'task' || focusKind === 'goal') && focusId && focusTitle
      ? { kind: focusKind, id: focusId, title: focusTitle }
      : undefined;
  const repository = useMemo(
    () => (userId ? createSupabaseChatRepository(userId) : null),
    [userId],
  );
  const readCalendar = useMemo(
    () =>
      userId
        ? async (day: string) => {
            const settings =
              await createSupabaseSettingsRepository(userId).getProfilePlanningSettings();
            return readCalendarForShare(
              day,
              settings.timezone,
              createExpoCalendarRepository(),
              createSupabaseFixedEventRepository(userId),
            );
          }
        : undefined,
    [userId],
  );
  return repository ? (
    <ChatScreen
      key={`${userId}:${entry ?? ''}`}
      focus={focus}
      initialDate={date}
      prepareCalendar={prepareCalendar === '1'}
      loadGoals={userId ? () => createSupabaseTaskRepository(userId).listGoalOptions() : undefined}
      taskEditIntent={intent === 'edit'}
      readCalendar={readCalendar}
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
