import type { CalendarEvent, CalendarInterval } from '../types';

export type CalendarPermissionStatus = 'denied' | 'granted' | 'undetermined';

export type CalendarPermission = {
  canAskAgain: boolean;
  status: CalendarPermissionStatus;
};

export type CalendarEventsResult = {
  calendarCount: number;
  discardedEventCount: number;
  events: CalendarEvent[];
};

export interface CalendarRepository {
  getPermission(): Promise<CalendarPermission>;
  listEvents(interval: CalendarInterval, localDate: string): Promise<CalendarEventsResult>;
  requestPermission(): Promise<CalendarPermission>;
}
