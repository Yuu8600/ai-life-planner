import type { CalendarInterval } from './types';

export type FixedEvent = CalendarInterval & { id: string; title: string; planDate?: string };

export interface FixedEventRepository {
  list(day: CalendarInterval): Promise<FixedEvent[]>;
  add(date: string, event: Omit<FixedEvent, 'id'>): Promise<void>;
  update?(original: FixedEvent, input: Omit<FixedEvent, 'id'>): Promise<void>;
  remove(id: string): Promise<void>;
}
