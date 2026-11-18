import { FunctionsHttpError } from '@supabase/supabase-js';
import type {
  ChatRepository,
  DraftItem,
  MessageCursor,
  MessagePage,
  Usage,
} from '@/features/ai-chat/v2/repository';
import { getSupabaseClient } from '../client';
import type { Json } from '../database.types';

const errors: Record<string, string> = {
  CALENDAR_INPUT: '共有内容を送信できません。日時と選択件数を確認してください。',
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
  async function listMessages(thread: string, cursor?: MessageCursor): Promise<MessagePage> {
    const pageSize = 100;
    // Preserve the full timestamp from Postgres and use the ID to break ties.
    let query = client
      .from('v2_messages')
      .select('id,role,body,created_at')
      .eq('user_id', userId)
      .eq('thread_id', thread);
    if (cursor) {
      if (
        !/^[a-f0-9-]{36}$/i.test(cursor.id) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          cursor.createdAt,
        )
      )
        throw new Error('Invalid message cursor');
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);
    if (error) throw error;
    const page = data.slice(0, pageSize);
    const oldest = page.at(-1);
    return {
      messages: page.reverse().map(({ id, role, body }) => ({
        id,
        role: role === 'user' ? 'user' : 'assistant',
        body,
      })),
      olderCursor:
        oldest && data.length > pageSize ? { id: oldest.id, createdAt: oldest.created_at } : null,
    };
  }

  return {
    listOlder: listMessages,
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
        listMessages(thread),
        client
          .from('v2_drafts')
          .select(
            'id,revision,approved_at,rejected_at,applied_keys,items,v26_task_edit_receipts(task_id,undone_at)',
          )
          .eq('user_id', userId)
          .eq('thread_id', thread)
          .order('created_at', { ascending: false }),
      ]);
      if (drafts.error) throw drafts.error;
      return {
        ...messages,
        drafts: drafts.data.map((item) => ({
          id: item.id,
          revision: item.revision,
          approvedAt: item.approved_at,
          rejectedAt: item.rejected_at,
          appliedKeys: item.applied_keys ?? undefined,
          undoTaskIds:
            item.v26_task_edit_receipts
              ?.filter((receipt) => !receipt.undone_at)
              .map((receipt) => receipt.task_id) ?? [],
          items: Array.isArray(item.items)
            ? (item.items as DraftItem[]).filter(
                (draft) =>
                  !!draft &&
                  typeof draft.key === 'string' &&
                  typeof draft.title === 'string' &&
                  ['task', 'goal', 'step', 'plan', 'policy'].includes(draft.kind),
              )
            : [],
        })),
      };
    },
    async send(threadId, prompt, date, draftId, focus, calendar) {
      const result = await client.functions.invoke<{ ephemeralReply?: string }>('v2-chat', {
        method: 'POST',
        body: {
          threadId,
          prompt,
          date,
          draftId,
          ...(calendar ? { calendar } : {}),
          focus: focus && { kind: focus.kind, id: focus.id },
        },
      });
      if (result.error) await chatError(result.error);
      if (calendar && typeof result.data?.ephemeralReply === 'string')
        return result.data.ephemeralReply;
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
    async reject(draft) {
      const { error } = await client.rpc('v26_reject_draft', {
        p_id: draft.id,
        p_revision: draft.revision,
      });
      if (error)
        throw new Error(errors[error.code] ?? '却下できませんでした。再試行してください。');
    },
    async undoTaskEdit(draftId, taskId) {
      const { error } = await client.rpc('v26_undo_task_edit', {
        p_draft: draftId,
        p_task: taskId,
      });
      if (error)
        throw new Error(
          error.code === '40001'
            ? '承認後にタスクが変更されたため取り消せません。'
            : '編集を取り消せませんでした。',
        );
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
