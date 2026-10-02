import { clipPlannerFreeSlots } from '@/features/planner/clipPlannerFreeSlots';
import { calculateFreeTime, type FreeTimeSlot } from '@/features/planner';

const date = '2026-09-26';
const fullDaySlot: FreeTimeSlot = {
  startAt: '2026-09-25T23:00:00.000Z',
  endAt: '2026-09-26T14:00:00.000Z',
  durationMinutes: 900,
};

function clip(
  now: string,
  overrides: Partial<Parameters<typeof clipPlannerFreeSlots>[0]> = {},
): FreeTimeSlot[] {
  return clipPlannerFreeSlots({
    date,
    freeSlots: [fullDaySlot],
    minimumFreeMinutes: 20,
    now: new Date(now),
    timezone: 'Asia/Tokyo',
    ...overrides,
  });
}

describe('clipPlannerFreeSlots', () => {
  it('keeps the full slot before the planning start today', () => {
    expect(clip('2026-09-25T22:00:00.000Z')).toEqual([fullDaySlot]);
  });

  it('clips a slot containing the current instant and recalculates its duration', () => {
    const slot: FreeTimeSlot = {
      startAt: '2026-09-26T08:00:00.000Z',
      endAt: '2026-09-26T10:00:00.000Z',
      durationMinutes: 120,
    };

    expect(clip('2026-09-26T09:00:00.000Z', { freeSlots: [slot] })).toEqual([
      { ...slot, startAt: '2026-09-26T09:00:00.000Z', durationMinutes: 60 },
    ]);
  });

  it('removes finished slots while retaining later slots', () => {
    const pastSlot: FreeTimeSlot = {
      startAt: '2026-09-25T23:00:00.000Z',
      endAt: '2026-09-26T00:00:00.000Z',
      durationMinutes: 60,
    };
    const laterSlot: FreeTimeSlot = {
      startAt: '2026-09-26T10:00:00.000Z',
      endAt: '2026-09-26T11:00:00.000Z',
      durationMinutes: 60,
    };

    expect(clip('2026-09-26T09:00:00.000Z', { freeSlots: [pastSlot, laterSlot] })).toEqual([
      laterSlot,
    ]);
  });

  it('returns no slots after the planning end today', () => {
    expect(clip('2026-09-26T14:01:00.000Z')).toEqual([]);
  });

  it('does not change slots on a future profile-local date', () => {
    const futureSlot: FreeTimeSlot = {
      startAt: '2026-09-26T23:00:00.000Z',
      endAt: '2026-09-27T14:00:00.000Z',
      durationMinutes: 900,
    };

    expect(
      clip('2026-09-26T09:14:23.000Z', { date: '2026-09-27', freeSlots: [futureSlot] }),
    ).toEqual([futureSlot]);
  });

  it('returns no slots on a past profile-local date', () => {
    expect(clip('2026-09-26T09:14:23.000Z', { date: '2026-09-25' })).toEqual([]);
  });

  it('uses the profile timezone even when the UTC date differs', () => {
    const midnightSlot: FreeTimeSlot = {
      startAt: '2026-09-25T15:00:00.000Z',
      endAt: '2026-09-25T15:45:00.000Z',
      durationMinutes: 45,
    };

    expect(clip('2026-09-25T15:14:23.000Z', { freeSlots: [midnightSlot] })).toEqual([
      {
        ...midnightSlot,
        startAt: '2026-09-25T15:15:00.000Z',
        durationMinutes: 30,
      },
    ]);
  });

  it('rounds 18:14:23 up to 18:15 in Asia/Tokyo', () => {
    expect(clip('2026-09-26T09:14:23.000Z')).toEqual([
      {
        ...fullDaySlot,
        startAt: '2026-09-26T09:15:00.000Z',
        durationMinutes: 285,
      },
    ]);
  });

  it('rounds a nonzero millisecond up but keeps an exact minute', () => {
    expect(clip('2026-09-26T09:14:00.001Z')[0].startAt).toBe('2026-09-26T09:15:00.000Z');
    expect(clip('2026-09-26T09:14:00.000Z')[0].startAt).toBe('2026-09-26T09:14:00.000Z');
  });

  it('drops a clipped remainder shorter than minimumFreeMinutes', () => {
    const shortRemainderSlot: FreeTimeSlot = {
      startAt: '2026-09-26T09:00:00.000Z',
      endAt: '2026-09-26T09:30:00.000Z',
      durationMinutes: 30,
    };

    expect(clip('2026-09-26T09:14:23.000Z', { freeSlots: [shortRemainderSlot] })).toEqual([]);
  });

  it('does not change the full-day FreeTimeCalculator result used by Calendar', () => {
    const result = calculateFreeTime({
      events: [],
      minimumFreeMinutes: 20,
      planningEnd: '23:00',
      planningStart: '08:00',
      selectedDate: date,
      timezone: 'Asia/Tokyo',
    });

    expect(clip('2026-09-26T09:14:23.000Z', { freeSlots: result.freeSlots })).toEqual([
      {
        ...fullDaySlot,
        startAt: '2026-09-26T09:15:00.000Z',
        durationMinutes: 285,
      },
    ]);
    expect(result.freeSlots).toEqual([fullDaySlot]);
    expect(result.planningWindow).toEqual({
      startAt: fullDaySlot.startAt,
      endAt: fullDaySlot.endAt,
    });
  });
});
