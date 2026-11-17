import type { FixedEventRepository } from '@/features/calendar';
import { getSupabaseClient } from '../client';

export function createSupabaseFixedEventRepository(userId: string): FixedEventRepository {
  const client = getSupabaseClient();
  return {
    async list({ startAt, endAt }) {
      const { data, error } = await client
        .from('v2_events')
        .select('id,title,start_at,end_at')
        .eq('user_id', userId)
        .eq('kind', 'fixed')
        .lt('start_at', endAt)
        .gt('end_at', startAt)
        .order('start_at')
        .order('id');
      if (error) throw error;
      return data.map(({ id, title, start_at, end_at }) => ({
        id,
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
