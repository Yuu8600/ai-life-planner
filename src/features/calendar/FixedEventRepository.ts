import type { CalendarInterval } from './types';

type FixedEvent = CalendarInterval & { id: string; title: string };

export interface FixedEventRepository {
  list(day: CalendarInterval): Promise<FixedEvent[]>;
  add(date: string, event: Omit<FixedEvent, 'id'>): Promise<void>;
  remove(id: string): Promise<void>;
}
