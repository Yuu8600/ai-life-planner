import type { SupabaseClient } from '@supabase/supabase-js';
import {
  validateEventBuffer,
  bufferKey,
  type CalendarEventBufferRepository,
  type CalendarEventBufferOverride,
  type CalendarEventBufferKey,
} from '@/features/calendar';
import type { Database } from '../database.types';
import { getSupabaseClient } from '../client';

export class SupabaseCalendarEventBufferRepository implements CalendarEventBufferRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}
  async list(): Promise<CalendarEventBufferOverride[]> {
    const values: CalendarEventBufferOverride[] = [];
    let expected: number | null = null;
    while (true) {
      const { data, error, count } = await this.client
        .from('calendar_event_buffer_overrides')
        .select('*', { count: 'exact' })
        .eq('user_id', this.userId)
        .order('calendar_id')
        .order('event_id')
        .order('occurrence_start_at')
        .range(values.length, values.length + 499);
      if (error) throw error;
      if (!data || count === null || (expected !== null && expected !== count))
        throw new Error('Incomplete Calendar buffer read');
      expected = count;
      for (const row of data) {
        if (row.user_id !== this.userId) throw new Error('Unexpected Calendar buffer owner');
        const value = {
          calendarId: row.calendar_id,
          eventId: row.event_id,
          occurrenceStartAt: row.occurrence_start_at,
          bufferBeforeMinutes: row.buffer_before_minutes,
          bufferAfterMinutes: row.buffer_after_minutes,
        };
        validateEventBuffer(value);
        values.push(value);
      }
      if (values.length === expected) break;
      if (!data.length || values.length > expected)
        throw new Error('Incomplete Calendar buffer read');
    }
    if (new Set(values.map(bufferKey)).size !== values.length)
      throw new Error('Inconsistent Calendar buffer read');
    return values;
  }
  async upsert(value: CalendarEventBufferOverride): Promise<void> {
    validateEventBuffer(value);
    const { data, error } = await this.client
      .from('calendar_event_buffer_overrides')
      .upsert(
        {
          user_id: this.userId,
          calendar_id: value.calendarId,
          event_id: value.eventId,
          occurrence_start_at: new Date(value.occurrenceStartAt).toISOString(),
          buffer_before_minutes: value.bufferBeforeMinutes,
          buffer_after_minutes: value.bufferAfterMinutes,
        },
        { onConflict: 'user_id,calendar_id,event_id,occurrence_start_at' },
      )
      .select('user_id')
      .single();
    if (error) throw error;
    if (data?.user_id !== this.userId) throw new Error('Calendar buffer was not saved');
  }
  async remove(key: CalendarEventBufferKey): Promise<void> {
    bufferKey(key);
    const { error } = await this.client
      .from('calendar_event_buffer_overrides')
      .delete()
      .eq('user_id', this.userId)
      .eq('calendar_id', key.calendarId)
      .eq('event_id', key.eventId)
      .eq('occurrence_start_at', new Date(key.occurrenceStartAt).toISOString());
    if (error) throw error;
  }
}
export function createSupabaseCalendarEventBufferRepository(
  userId: string,
): CalendarEventBufferRepository {
  return new SupabaseCalendarEventBufferRepository(getSupabaseClient(), userId);
}
