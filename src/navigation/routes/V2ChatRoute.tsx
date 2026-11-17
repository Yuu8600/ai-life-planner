import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import type { ChatFocus } from '@/features/ai-chat/v2/repository';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';

export default function V2ChatRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const { focusKind, focusId, focusTitle, entry } = useLocalSearchParams<{
    focusKind?: string;
    focusId?: string;
    focusTitle?: string;
    entry?: string;
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
      repository={repository}
      reviewPlan={(plan) =>
        router.push({
          pathname: '/advanced-planner',
          params: { date: plan.date, taskId: plan.taskId ?? undefined, review: String(Date.now()) },
        })
      }
    />
  ) : null;
}
