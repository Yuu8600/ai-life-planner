import { getUtcDayBounds } from '@/features/today';

import type { CalendarEvent, CalendarInterval } from './types';

export type AgendaAvailability = 'all' | 'partial' | 'none';

export function recommendationIntervals(
  device: readonly CalendarEvent[],
  fixed: readonly CalendarInterval[],
  timezone: string,
): CalendarInterval[] {
  return [
    ...fixed,
    ...device.flatMap((event) => {
      if (event.status === 'canceled' || event.availability === 'free') return [];
      if (!event.allDay) return [event];
      if (
        (event.availability !== 'busy' && event.availability !== 'unavailable') ||
        !event.allDayStartDate ||
        !event.allDayEndDate
      )
        return [];
      return [
        {
          startAt: getUtcDayBounds(event.allDayStartDate, timezone).startAt,
          endAt: getUtcDayBounds(event.allDayEndDate, timezone).startAt,
        },
      ];
    }),
  ];
}

export function nextCalendarWindow(
  events: readonly CalendarInterval[],
  now: number,
  endOfDay: number,
) {
  const intervals = events
    .map((event) => [Date.parse(event.startAt), Date.parse(event.endAt)] as const)
    .filter(([start, end]) => end > now && start < end && start < endOfDay)
    .sort(([left], [right]) => left - right);
  const next = intervals[0];
  if (!next) return { minutes: null, until: null };
  if (next[0] <= now) {
    let end = next[1];
    for (const [start, finish] of intervals.slice(1)) {
      if (start > end) break;
      end = Math.max(end, finish);
    }
    return { minutes: 0, until: Math.min(end, endOfDay) };
  }
  return { minutes: Math.floor((next[0] - now) / 60000), until: next[0] };
}
