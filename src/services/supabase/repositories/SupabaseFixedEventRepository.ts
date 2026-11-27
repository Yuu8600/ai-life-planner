import type { FixedEventRepository } from '@/features/calendar';
import { getSupabaseClient } from '../client';

export function createSupabaseFixedEventRepository(userId: string): FixedEventRepository {
  const client = getSupabaseClient();
  return {
    async list({ startAt, endAt }) {
      const { data, error } = await client
        .from('v2_events')
        .select('id,title,start_at,end_at,plan_date')
        .eq('user_id', userId)
        .eq('kind', 'fixed')
        .lt('start_at', endAt)
        .gt('end_at', startAt)
        .order('start_at')
        .order('id');
      if (error) throw error;
      return data.map(({ id, title, start_at, end_at, plan_date }) => ({
        id,
        planDate: plan_date,
        title,
        startAt: start_at,
        endAt: end_at,
      }));
    },
    async add(date, event) {
      const { error } = await client.from('v2_events').insert({
        user_id: userId,
        plan_date: date,
        kind: 'fixed',
        title: event.title,
        start_at: event.startAt,
        end_at: event.endAt,
      });
      if (error) throw error;
    },
    async update(original, input) {
      const { data, error } = await client
        .from('v2_events')
        .update({ title: input.title, start_at: input.startAt, end_at: input.endAt })
        .eq('user_id', userId)
        .eq('kind', 'fixed')
        .eq('id', original.id)
        .eq('start_at', original.startAt)
        .eq('end_at', original.endAt)
        .eq('title', original.title)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('予定が変更または削除されました。閉じて再読み込みしてください。');
    },
    async remove(id) {
      const { error } = await client
        .from('v2_events')
        .delete()
        .eq('user_id', userId)
        .eq('kind', 'fixed')
        .eq('id', id);
      if (error) throw error;
    },
  };
}
