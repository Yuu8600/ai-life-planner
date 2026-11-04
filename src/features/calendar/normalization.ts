import { addLocalDays, getLocalDate, getUtcDayBounds } from '@/features/today';

import type {
  CalendarAvailability,
  CalendarEvent,
  CalendarEventStatus,
  CalendarInterval,
} from './types';

type NormalizedEvents = {
  discardedEventCount: number;
  events: CalendarEvent[];
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readOptionalIdentifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return readRequiredString(value);
}

function toIsoInstant(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCalendarDate(value: unknown, timeZone: string): string | null {
  const instant = toIsoInstant(value);
  return instant ? getLocalDate(new Date(instant), timeZone) : null;
}

function normalizeAvailability(value: unknown): CalendarAvailability {
  switch (value) {
    case 'busy':
    case 'free':
    case 'tentative':
    case 'unavailable':
      return value;
    case 'notSupported':
    case 'not-supported':
      return 'not-supported';
    default:
      return 'unknown';
  }
}

function normalizeStatus(value: unknown): CalendarEventStatus {
  switch (value) {
    case 'confirmed':
    case 'tentative':
    case 'canceled':
      return value;
    default:
      return 'unknown';
  }
}

export function intersectsHalfOpenInterval(
  event: Pick<CalendarEvent, 'endAt' | 'startAt'>,
  interval: CalendarInterval,
): boolean {
  const eventStart = Date.parse(event.startAt);
  const eventEnd = Date.parse(event.endAt);
  const intervalStart = Date.parse(interval.startAt);
  const intervalEnd = Date.parse(interval.endAt);

  return (
    Number.isFinite(eventStart) &&
    Number.isFinite(eventEnd) &&
    Number.isFinite(intervalStart) &&
    Number.isFinite(intervalEnd) &&
    eventStart < eventEnd &&
    intervalStart < intervalEnd &&
    eventStart < intervalEnd &&
    eventEnd > intervalStart
  );
}

export function occursOnCalendarDate(
  event: Pick<CalendarEvent, 'allDayEndDate' | 'allDayStartDate'>,
  localDate: string,
): boolean {
  const { allDayEndDate, allDayStartDate } = event;

  return (
    DATE_ONLY_PATTERN.test(localDate) &&
    allDayStartDate !== null &&
    allDayEndDate !== null &&
    allDayStartDate < allDayEndDate &&
    allDayStartDate <= localDate &&
    localDate < allDayEndDate
  );
}

export function intersectsCalendarDay(
  event: CalendarEvent,
  interval: CalendarInterval,
  localDate: string,
): boolean {
  return event.allDay
    ? occursOnCalendarDate(event, localDate)
    : intersectsHalfOpenInterval(event, interval);
}

export function normalizeCalendarEvent(
  value: unknown,
  calendarTitles: ReadonlyMap<string, string>,
  allDayTimeZone?: string,
): CalendarEvent | null {
  const event = asRecord(value);
  if (!event) return null;

  const id = readRequiredString(event.id);
  const calendarId = readRequiredString(event.calendarId);
  const startAt = toIsoInstant(event.startDate);
  const endAt = toIsoInstant(event.endDate);
  const allDay = event.allDay === true;
  const dateTimeZone = allDayTimeZone ?? 'UTC';
  const allDayStartDate = allDay ? toCalendarDate(event.startDate, dateTimeZone) : null;
  let allDayEndDate = allDay ? toCalendarDate(event.endDate, dateTimeZone) : null;
  // EventKit can end all-day events at 23:59:59. Convert that inclusive final day
  // to our exclusive date boundary; keep already-exclusive midnight unchanged.
  if (
    allDayTimeZone &&
    allDayEndDate &&
    endAt &&
    Date.parse(endAt) > Date.parse(getUtcDayBounds(allDayEndDate, dateTimeZone).startAt)
  ) {
    allDayEndDate = addLocalDays(allDayEndDate, 1);
  }

  if (
    !id ||
    !calendarId ||
    !startAt ||
    !endAt ||
    Date.parse(startAt) >= Date.parse(endAt) ||
    (allDay && (!allDayStartDate || !allDayEndDate || allDayStartDate >= allDayEndDate))
  ) {
    return null;
  }

  return {
    allDay,
    allDayEndDate,
    allDayStartDate,
    availability: normalizeAvailability(event.availability),
    calendarId,
    calendarTitle: calendarTitles.get(calendarId) ?? null,
    endAt,
    id,
    instanceId: readOptionalIdentifier(event.instanceId),
    location: readRequiredString(event.location),
    startAt,
    status: normalizeStatus(event.status),
    timeZone: readRequiredString(event.timeZone),
    title: readRequiredString(event.title) ?? 'タイトルなし',
  };
}

export function normalizeCalendarEvents(
  values: readonly unknown[],
  calendarTitles: ReadonlyMap<string, string>,
  interval: CalendarInterval,
  localDate: string,
  allDayTimeZone?: string,
): NormalizedEvents {
  const events: CalendarEvent[] = [];
  let discardedEventCount = 0;

  for (const value of values) {
    const event = normalizeCalendarEvent(value, calendarTitles, allDayTimeZone);
    if (!event) {
      discardedEventCount += 1;
      continue;
    }

    if (intersectsCalendarDay(event, interval, localDate)) events.push(event);
  }

  events.sort((left, right) => {
    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
    return (
      left.startAt.localeCompare(right.startAt) ||
      left.endAt.localeCompare(right.endAt) ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
    );
  });

  return { discardedEventCount, events };
}
