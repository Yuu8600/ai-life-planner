import type { CalendarEvent } from './types';

export function nextCalendarWindow(
  events: readonly CalendarEvent[],
  now: number,
  endOfDay: number,
) {
  const intervals = events
    .filter(
      (event) =>
        event.status !== 'canceled' &&
        event.availability !== 'free' &&
        (!event.allDay || event.availability === 'busy' || event.availability === 'unavailable'),
    )
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
