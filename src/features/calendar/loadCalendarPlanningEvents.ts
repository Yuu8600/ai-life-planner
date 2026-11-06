import { addLocalDays, getUtcDayBounds } from '@/features/today';
import type { CalendarRepository } from './repositories/CalendarRepository';

/** Adjacent timed events affect buffers only; the day's visible events stay unchanged. */
export async function loadCalendarPlanningEvents(
  repository: CalendarRepository,
  date: string,
  timezone: string,
  before: number,
  after: number,
) {
  const dates = [
    date,
    ...(after > 0 ? [addLocalDays(date, -1)] : []),
    ...(before > 0 ? [addLocalDays(date, 1)] : []),
  ];
  const results = await Promise.all(
    dates.map((day) => repository.listEvents(getUtcDayBounds(day, timezone), day)),
  );
  const seen = new Set<string>();
  const calculationEvents = results
    .flatMap((result, index) => result.events.filter((event) => index === 0 || !event.allDay))
    .filter((event) => {
      const key = JSON.stringify([
        event.calendarId,
        event.id,
        event.instanceId,
        event.startAt,
        event.endAt,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { ...results[0], calculationEvents };
}
