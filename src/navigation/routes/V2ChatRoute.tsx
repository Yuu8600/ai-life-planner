import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';

export default function V2ChatRoute() {
  const userId = useAuth().session?.user.id;
  const router = useRouter();
  const repository = useMemo(
    () => (userId ? createSupabaseChatRepository(userId) : null),
    [userId],
  );
  return repository ? (
    <ChatScreen
      key={userId}
      repository={repository}
      reviewPlan={(plan) =>
        router.navigate({
          pathname: '/today',
          params: { date: plan.date, taskId: plan.taskId ?? undefined, review: String(Date.now()) },
        })
      }
    />
  ) : null;
}
