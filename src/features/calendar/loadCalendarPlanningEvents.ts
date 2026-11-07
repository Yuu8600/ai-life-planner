import {
  bufferKey,
  eventBufferKey,
  loadEventBuffers,
  type CalendarEventBufferRepository,
} from './eventBuffers';
import { addLocalDays, getUtcDayBounds } from '@/features/today';
import type { CalendarRepository } from './repositories/CalendarRepository';

/** Adjacent timed events affect buffers only; the day's visible events stay unchanged. */
export async function loadCalendarPlanningEvents(
  repository: CalendarRepository,
  date: string,
  timezone: string,
  before: number,
  after: number,
  overrideRepository?: CalendarEventBufferRepository | null,
  endDayOffset: 0 | 1 = 0,
) {
  const overrides = await loadEventBuffers(overrideRepository);
  const maxBefore = Math.max(before, ...overrides.map((value) => value.bufferBeforeMinutes));
  const maxAfter = Math.max(after, ...overrides.map((value) => value.bufferAfterMinutes));
  const dates = [
    date,
    ...(maxAfter > 0 ? [addLocalDays(date, -1)] : []),
    ...(endDayOffset === 1 || maxBefore > 0 ? [addLocalDays(date, 1)] : []),
    ...(endDayOffset === 1 && maxBefore > 0 ? [addLocalDays(date, 2)] : []),
  ];
  const results = await Promise.all(
    dates.map((day) => repository.listEvents(getUtcDayBounds(day, timezone), day)),
  );
  const seen = new Set<string>();
  const calculationEvents = results
    .flatMap((result, index) =>
      result.events.filter(
        (event) =>
          index === 0 ||
          (endDayOffset === 1 && dates[index] === addLocalDays(date, 1)) ||
          !event.allDay,
      ),
    )
    .filter((event) => {
      const key = bufferKey(eventBufferKey(event));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { ...results[0], calculationEvents, overrides };
}
