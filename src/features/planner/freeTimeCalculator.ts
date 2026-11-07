import {
  effectiveEventBuffers,
  validateEventBuffer,
  type CalendarAvailability,
  type CalendarEvent,
  type CalendarEventStatus,
} from '@/features/calendar';
import { getPlanningWindow, getUtcDayBounds } from '@/features/today';

import type {
  FreeTimeCalculationInput,
  FreeTimeCalculationResult,
  FreeTimeSlot,
  TimeInterval,
} from './types';

const MILLISECONDS_PER_MINUTE = 60 * 1_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type NumericInterval = {
  end: number;
  start: number;
};

type BlockingCalendarEvent = {
  availability: CalendarAvailability | null | undefined;
  status: CalendarEventStatus | null | undefined;
};

export class FreeTimeCalculationError extends Error {
  readonly code = 'INVALID_FREE_TIME_INPUT';

  constructor(message: string) {
    super(message);
    this.name = 'FreeTimeCalculationError';
  }
}

function toNumericInterval(interval: TimeInterval, label: string): NumericInterval {
  const start = Date.parse(interval.startAt);
  const end = Date.parse(interval.endAt);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new FreeTimeCalculationError(`${label} must have valid increasing UTC instants.`);
  }

  return { end, start };
}

function toTimeInterval({ end, start }: NumericInterval): TimeInterval {
  return {
    endAt: new Date(end).toISOString(),
    startAt: new Date(start).toISOString(),
  };
}

function validateAllDayRange(event: CalendarEvent): void {
  if (
    !event.allDayStartDate ||
    !event.allDayEndDate ||
    !DATE_ONLY_PATTERN.test(event.allDayStartDate) ||
    !DATE_ONLY_PATTERN.test(event.allDayEndDate) ||
    event.allDayStartDate >= event.allDayEndDate
  ) {
    throw new FreeTimeCalculationError('All-day event must have a valid exclusive date range.');
  }
}

function validateMinimumFreeMinutes(minimumFreeMinutes: number): void {
  if (!Number.isSafeInteger(minimumFreeMinutes) || minimumFreeMinutes <= 0) {
    throw new FreeTimeCalculationError('minimumFreeMinutes must be a positive integer.');
  }
}

export function isBlockingCalendarEvent(event: BlockingCalendarEvent): boolean {
  return event.status !== 'canceled' && event.availability !== 'free';
}

export function clampIntervalToWindow(
  interval: TimeInterval,
  window: TimeInterval,
): TimeInterval | null {
  const source = toNumericInterval(interval, 'Interval');
  const bounds = toNumericInterval(window, 'Window');
  const clamped: NumericInterval = {
    end: Math.min(source.end, bounds.end),
    start: Math.max(source.start, bounds.start),
  };

  return clamped.start < clamped.end ? toTimeInterval(clamped) : null;
}

export function mergeTimeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .map((interval) => toNumericInterval(interval, 'Busy interval'))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (sorted.length === 0) return [];

  const merged: NumericInterval[] = [{ ...sorted[0] }];

  for (const interval of sorted.slice(1)) {
    const current = merged[merged.length - 1];

    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged.map(toTimeInterval);
}

function calculateFreeSlots(
  planningWindow: TimeInterval,
  busyIntervals: readonly TimeInterval[],
  minimumFreeMinutes: number,
): FreeTimeSlot[] {
  const planning = toNumericInterval(planningWindow, 'Planning window');
  const busy = busyIntervals.map((interval) => toNumericInterval(interval, 'Busy interval'));
  const candidates: NumericInterval[] = [];
  let cursor = planning.start;

  for (const interval of busy) {
    if (cursor < interval.start) candidates.push({ end: interval.start, start: cursor });
    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < planning.end) candidates.push({ end: planning.end, start: cursor });

  return candidates
    .map(({ end, start }) => ({
      ...toTimeInterval({ end, start }),
      durationMinutes: (end - start) / MILLISECONDS_PER_MINUTE,
    }))
    .filter(({ durationMinutes }) => durationMinutes >= minimumFreeMinutes);
}

export function calculateFreeTime({
  planningEndDayOffset = 0,
  calendarEventBufferOverrides = [],
  calendarBufferBeforeMinutes = 0,
  calendarBufferAfterMinutes = 0,
  events,
  minimumFreeMinutes,
  planningEnd,
  planningStart,
  selectedDate,
  timezone,
}: FreeTimeCalculationInput): FreeTimeCalculationResult {
  validateMinimumFreeMinutes(minimumFreeMinutes);
  calendarEventBufferOverrides.forEach(validateEventBuffer);
  for (const minutes of [calendarBufferBeforeMinutes, calendarBufferAfterMinutes]) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240)
      throw new FreeTimeCalculationError(
        'Calendar buffers must be integers from 0 to 240 minutes.',
      );
  }

  const planningWindow = getPlanningWindow(selectedDate, {
    planningStart,
    planningEnd,
    planningEndDayOffset,
    timezone,
  });
  toNumericInterval(planningWindow, 'Planning window');

  const blockingIntervals: TimeInterval[] = [];

  for (const event of events) {
    if (!isBlockingCalendarEvent(event)) continue;

    if (event.allDay) {
      validateAllDayRange(event);
      const allDay = clampIntervalToWindow(
        {
          startAt: getUtcDayBounds(event.allDayStartDate!, timezone).startAt,
          endAt: getUtcDayBounds(event.allDayEndDate!, timezone).startAt,
        },
        planningWindow,
      );
      if (allDay) blockingIntervals.push(allDay);
      continue;
    }

    const interval = toNumericInterval(event, 'Calendar event');
    const { before, after } = effectiveEventBuffers(
      event,
      calendarBufferBeforeMinutes,
      calendarBufferAfterMinutes,
      calendarEventBufferOverrides,
    );
    const clamped = clampIntervalToWindow(
      {
        endAt: new Date(interval.end + after * MILLISECONDS_PER_MINUTE).toISOString(),
        startAt: new Date(interval.start - before * MILLISECONDS_PER_MINUTE).toISOString(),
      },
      planningWindow,
    );
    if (clamped) blockingIntervals.push(clamped);
  }

  const busyIntervals = mergeTimeIntervals(blockingIntervals);

  return {
    busyIntervals,
    freeSlots: calculateFreeSlots(planningWindow, busyIntervals, minimumFreeMinutes),
    planningWindow,
  };
}
