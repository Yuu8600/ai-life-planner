import { getLocalDate, type LocalDate } from '@/features/today';

import type { FreeTimeSlot } from './types';

const MILLISECONDS_PER_MINUTE = 60_000;

export type ClipPlannerFreeSlotsInput = {
  date: LocalDate;
  freeSlots: readonly FreeTimeSlot[];
  minimumFreeMinutes: number;
  now: Date;
  timezone: string;
};

/** Restrict Planner availability without changing the Calendar's full-day free-time result. */
export function clipPlannerFreeSlots({
  date,
  freeSlots,
  minimumFreeMinutes,
  now,
  timezone,
}: ClipPlannerFreeSlotsInput): FreeTimeSlot[] {
  const currentDate = getLocalDate(now, timezone);
  if (date < currentDate) return [];
  if (date > currentDate) return [...freeSlots];

  const cutoff = Math.ceil(now.getTime() / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;

  return freeSlots.flatMap((slot): FreeTimeSlot[] => {
    const start = Math.max(Date.parse(slot.startAt), cutoff);
    const end = Date.parse(slot.endAt);
    const durationMinutes = (end - start) / MILLISECONDS_PER_MINUTE;

    if (start >= end || durationMinutes < minimumFreeMinutes) return [];

    return [
      {
        startAt: new Date(start).toISOString(),
        endAt: slot.endAt,
        durationMinutes,
      },
    ];
  });
}
