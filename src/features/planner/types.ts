import type { CalendarEventBufferOverride, CalendarEvent } from '@/features/calendar';

export type TimeInterval = {
  endAt: string;
  startAt: string;
};

export type FreeTimeSlot = TimeInterval & {
  durationMinutes: number;
};

export type FreeTimeCalculationInput = {
  calendarEventBufferOverrides?: readonly CalendarEventBufferOverride[];
  calendarBufferBeforeMinutes?: number;
  calendarBufferAfterMinutes?: number;
  events: readonly CalendarEvent[];
  minimumFreeMinutes: number;
  planningEnd: string;
  planningStart: string;
  selectedDate: string;
  timezone: string;
};

export type FreeTimeCalculationResult = {
  busyIntervals: TimeInterval[];
  freeSlots: FreeTimeSlot[];
  planningWindow: TimeInterval;
};
