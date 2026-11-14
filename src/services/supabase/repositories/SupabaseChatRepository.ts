import { FunctionsHttpError } from '@supabase/supabase-js';
import type { ChatRepository, DraftItem, Usage } from '@/features/ai-chat/v2/repository';
import { getSupabaseClient } from '../client';
import type { Json } from '../database.types';

const errors: Record<string, string> = {
  AUTH: 'もう一度ログインしてください。',
  BUDGET: '今月のAI推定予算の範囲に収まりません。計画や下書きは引き続き利用できます。',
  UNCONFIGURED: 'AIはまだ設定されていません。',
  BUSY: '前のAIリクエストが処理中です。少し待ってから再試行してください。',
  MODEL: 'AIから回答を取得できませんでした。',
  CONTEXT_SIZE: '会話の文脈が長すぎます。新しい会話で短く相談してください。',
  '40001': '保存内容が更新されました。最新状態を読み込んでください。',
};

async function chatError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const result: unknown = await error.context.json().catch(() => null);
    if (result && typeof result === 'object' && 'code' in result && typeof result.code === 'string')
      throw new Error(errors[result.code] ?? 'AIに接続できませんでした。');
  }
  throw new Error('AIに接続できませんでした。');
}

export function createSupabaseChatRepository(userId: string): ChatRepository {
  const client = getSupabaseClient();
  return {
    async listThreads() {
      const result = await client
        .from('v2_threads')
        .select('id,title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data;
    },
    async createThread(title) {
      const result = await client.from('v2_threads').insert({ title }).select('id,title').single();
      if (result.error) throw result.error;
      return result.data;
    },
    async open(thread) {
      const [messages, drafts] = await Promise.all([
        client
          .from('v2_messages')
          .select('id,role,body')
          .eq('user_id', userId)
          .eq('thread_id', thread)
          .order('created_at', { ascending: false })
          .limit(100),
        client
          .from('v2_drafts')
          .select('id,revision,approved_at,items')
          .eq('user_id', userId)
          .eq('thread_id', thread)
          .order('created_at', { ascending: false }),
      ]);
      if (messages.error) throw messages.error;
      if (drafts.error) throw drafts.error;
      return {
        messages: messages.data
          .reverse()
          .map((item) => ({ ...item, role: item.role === 'user' ? 'user' : 'assistant' })),
        drafts: drafts.data.map((item) => ({
          id: item.id,
          revision: item.revision,
          approvedAt: item.approved_at,
          items: item.items as DraftItem[],
        })),
      };
    },
    async send(threadId, prompt, date, draftId) {
      const result = await client.functions.invoke('v2-chat', {
        method: 'POST',
        body: { threadId, prompt, date, draftId },
      });
      if (result.error) await chatError(result.error);
    },
    async usage() {
      const { data, error } = await client.functions.invoke<Usage>('v2-chat', { method: 'GET' });
      if (error) await chatError(error);
      if (!data || typeof data.remainingMicros !== 'number')
        throw new Error('残り予算を取得できませんでした。');
      return data;
    },
    async edit(draft, items) {
      const { error } = await client.rpc('v2_edit_draft', {
        p_id: draft.id,
        p_revision: draft.revision,
        p_items: items as Json,
      });
      if (error) throw new Error(errors[error.code] ?? '下書きを更新できませんでした。');
    },
    async approve(draft, selected) {
      const { error } = await client.rpc('v2_approve_draft', {
        p_id: draft.id,
        p_revision: draft.revision,
        p_selected: selected,
      });
      if (error)
        throw new Error(
          errors[error.code] ?? '承認できませんでした。関連するGoalや入力内容を確認してください。',
        );
    },
  };
}
