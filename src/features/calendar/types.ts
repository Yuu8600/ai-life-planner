export type CalendarAvailability =
  'busy' | 'free' | 'tentative' | 'unavailable' | 'not-supported' | 'unknown';

export type CalendarEventStatus = 'confirmed' | 'tentative' | 'canceled' | 'unknown';

export type CalendarEvent = {
  allDay: boolean;
  allDayEndDate: string | null;
  allDayStartDate: string | null;
  availability: CalendarAvailability;
  calendarId: string;
  calendarTitle: string | null;
  endAt: string;
  id: string;
  instanceId: string | null;
  location: string | null;
  startAt: string;
  status: CalendarEventStatus;
  timeZone: string | null;
  title: string;
};

export type CalendarInterval = {
  endAt: string;
  startAt: string;
};
