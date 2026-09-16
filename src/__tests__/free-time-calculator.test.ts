import type { CalendarEvent } from '@/features/calendar';
import {
  calculateFreeTime,
  FreeTimeCalculationError,
  isBlockingCalendarEvent,
} from '@/features/planner';

const TOKYO_PLANNING_WINDOW = {
  endAt: '2026-09-16T14:00:00.000Z',
  startAt: '2026-09-15T23:00:00.000Z',
};

const defaultInput = {
  events: [] as CalendarEvent[],
  minimumFreeMinutes: 20,
  planningEnd: '23:00',
  planningStart: '08:00',
  selectedDate: '2026-09-16',
  timezone: 'Asia/Tokyo',
};

function timedEvent(
  startAt: string,
  endAt: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    allDay: false,
    allDayEndDate: null,
    allDayStartDate: null,
    availability: 'busy',
    calendarId: 'calendar-1',
    calendarTitle: 'テスト',
    endAt,
    id: `${startAt}:${endAt}`,
    instanceId: null,
    location: null,
    startAt,
    status: 'confirmed',
    timeZone: 'Asia/Tokyo',
    title: '予定',
    ...overrides,
  };
}

function allDayEvent(
  allDayStartDate: string,
  allDayEndDate: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    ...timedEvent(`${allDayStartDate}T00:00:00.000Z`, `${allDayEndDate}T00:00:00.000Z`),
    allDay: true,
    allDayEndDate,
    allDayStartDate,
    ...overrides,
  };
}

function intervals(result: readonly { endAt: string; startAt: string }[]) {
  return result.map(({ endAt, startAt }) => ({ endAt, startAt }));
}

describe('FreeTimeCalculator', () => {
  it('returns the whole planning window when there are no events', () => {
    const result = calculateFreeTime(defaultInput);

    expect(result.planningWindow).toEqual(TOKYO_PLANNING_WINDOW);
    expect(result.busyIntervals).toEqual([]);
    expect(result.freeSlots).toEqual([{ ...TOKYO_PLANNING_WINDOW, durationMinutes: 900 }]);
  });

  it('subtracts one busy event from the planning window', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T01:00:00.000Z')],
    });

    expect(intervals(result.freeSlots)).toEqual([
      { endAt: '2026-09-16T00:00:00.000Z', startAt: '2026-09-15T23:00:00.000Z' },
      { endAt: '2026-09-16T14:00:00.000Z', startAt: '2026-09-16T01:00:00.000Z' },
    ]);
  });

  it('merges overlapping events', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [
        timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T01:30:00.000Z'),
        timedEvent('2026-09-16T01:00:00.000Z', '2026-09-16T03:00:00.000Z'),
      ],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T03:00:00.000Z', startAt: '2026-09-16T00:00:00.000Z' },
    ]);
  });

  it('merges events whose boundaries touch', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [
        timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T01:00:00.000Z'),
        timedEvent('2026-09-16T01:00:00.000Z', '2026-09-16T02:00:00.000Z'),
      ],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T02:00:00.000Z', startAt: '2026-09-16T00:00:00.000Z' },
    ]);
  });

  it('merges a contained event into its containing interval', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [
        timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T03:00:00.000Z'),
        timedEvent('2026-09-16T01:00:00.000Z', '2026-09-16T02:00:00.000Z'),
      ],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T03:00:00.000Z', startAt: '2026-09-16T00:00:00.000Z' },
    ]);
  });

  it('ignores an event wholly outside the planning window', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [timedEvent('2026-09-15T22:00:00.000Z', '2026-09-15T22:30:00.000Z')],
    });

    expect(result.busyIntervals).toEqual([]);
    expect(result.freeSlots).toEqual([{ ...TOKYO_PLANNING_WINDOW, durationMinutes: 900 }]);
  });

  it('clamps an event crossing the planning start', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [timedEvent('2026-09-15T22:00:00.000Z', '2026-09-16T00:00:00.000Z')],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T00:00:00.000Z', startAt: '2026-09-15T23:00:00.000Z' },
    ]);
  });

  it('clamps an event crossing the planning end', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [timedEvent('2026-09-16T13:00:00.000Z', '2026-09-16T17:00:00.000Z')],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T14:00:00.000Z', startAt: '2026-09-16T13:00:00.000Z' },
    ]);
  });

  it('returns no free slots when an event covers the whole planning window', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [timedEvent('2026-09-15T22:00:00.000Z', '2026-09-16T16:00:00.000Z')],
    });

    expect(result.busyIntervals).toEqual([TOKYO_PLANNING_WINDOW]);
    expect(result.freeSlots).toEqual([]);
  });

  it.each([
    ['08:19', 0],
    ['08:20', 1],
    ['08:21', 1],
  ])('applies a 20-minute minimum to a slot ending at %s', (planningEnd, expectedCount) => {
    const result = calculateFreeTime({
      ...defaultInput,
      minimumFreeMinutes: 20,
      planningEnd,
      planningStart: '08:00',
    });

    expect(result.freeSlots).toHaveLength(expectedCount);
  });

  it.each([
    ['free', 'confirmed', false],
    ['busy', 'confirmed', true],
    ['tentative', 'confirmed', true],
    ['unavailable', 'confirmed', true],
    ['unknown', 'confirmed', true],
    [null, 'confirmed', true],
    ['busy', 'canceled', false],
  ] as const)(
    'treats availability=%s and status=%s as blocking=%s',
    (availability, status, expected) => {
      expect(isBlockingCalendarEvent({ availability, status })).toBe(expected);
    },
  );

  it('blocks the whole window for a blocking single-day all-day event', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [allDayEvent('2026-09-16', '2026-09-17')],
    });

    expect(result.busyIntervals).toEqual([TOKYO_PLANNING_WINDOW]);
    expect(result.freeSlots).toEqual([]);
  });

  it('does not block for a free all-day event', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [allDayEvent('2026-09-16', '2026-09-17', { availability: 'free' })],
    });

    expect(result.busyIntervals).toEqual([]);
  });

  it('does not block for a canceled all-day event', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [allDayEvent('2026-09-16', '2026-09-17', { status: 'canceled' })],
    });

    expect(result.busyIntervals).toEqual([]);
  });

  it('uses an exclusive end date for a multi-day all-day event', () => {
    const event = allDayEvent('2026-09-15', '2026-09-18');

    expect(
      calculateFreeTime({ ...defaultInput, events: [event], selectedDate: '2026-09-17' }).freeSlots,
    ).toEqual([]);
    expect(
      calculateFreeTime({ ...defaultInput, events: [event], selectedDate: '2026-09-18' })
        .busyIntervals,
    ).toEqual([]);
  });

  it('clamps a cross-midnight timed event independently on both local dates', () => {
    const event = timedEvent('2026-09-16T14:00:00.000Z', '2026-09-16T16:00:00.000Z');
    const firstDay = calculateFreeTime({
      ...defaultInput,
      events: [event],
      minimumFreeMinutes: 1,
      planningEnd: '23:59',
      planningStart: '00:00',
    });
    const secondDay = calculateFreeTime({
      ...defaultInput,
      events: [event],
      minimumFreeMinutes: 1,
      planningEnd: '23:59',
      planningStart: '00:00',
      selectedDate: '2026-09-17',
    });

    expect(firstDay.busyIntervals).toEqual([
      { endAt: '2026-09-16T14:59:00.000Z', startAt: '2026-09-16T14:00:00.000Z' },
    ]);
    expect(secondDay.busyIntervals).toEqual([
      { endAt: '2026-09-16T16:00:00.000Z', startAt: '2026-09-16T15:00:00.000Z' },
    ]);
  });

  it('converts an Asia/Tokyo planning window to the correct UTC instants', () => {
    expect(calculateFreeTime(defaultInput).planningWindow).toEqual(TOKYO_PLANNING_WINDOW);
  });

  it('resolves a planning window across a New York daylight-saving transition', () => {
    const result = calculateFreeTime({
      events: [],
      minimumFreeMinutes: 1,
      planningEnd: '04:00',
      planningStart: '00:00',
      selectedDate: '2024-03-10',
      timezone: 'America/New_York',
    });

    expect(result.planningWindow).toEqual({
      endAt: '2024-03-10T08:00:00.000Z',
      startAt: '2024-03-10T05:00:00.000Z',
    });
    expect(result.freeSlots[0].durationMinutes).toBe(180);
  });

  it('does not depend on input event order', () => {
    const events = [
      timedEvent('2026-09-16T09:00:00.000Z', '2026-09-16T10:00:00.000Z'),
      timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T01:00:00.000Z'),
      timedEvent('2026-09-16T04:00:00.000Z', '2026-09-16T05:00:00.000Z'),
    ];

    expect(calculateFreeTime({ ...defaultInput, events })).toEqual(
      calculateFreeTime({ ...defaultInput, events: [...events].reverse() }),
    );
  });

  it('calculates free slots after merging multiple overlapping busy intervals', () => {
    const result = calculateFreeTime({
      ...defaultInput,
      events: [
        timedEvent('2026-09-16T00:00:00.000Z', '2026-09-16T01:00:00.000Z'),
        timedEvent('2026-09-16T03:00:00.000Z', '2026-09-16T04:00:00.000Z'),
        timedEvent('2026-09-16T03:30:00.000Z', '2026-09-16T05:00:00.000Z'),
        timedEvent('2026-09-16T09:00:00.000Z', '2026-09-16T10:00:00.000Z'),
      ],
    });

    expect(result.busyIntervals).toEqual([
      { endAt: '2026-09-16T01:00:00.000Z', startAt: '2026-09-16T00:00:00.000Z' },
      { endAt: '2026-09-16T05:00:00.000Z', startAt: '2026-09-16T03:00:00.000Z' },
      { endAt: '2026-09-16T10:00:00.000Z', startAt: '2026-09-16T09:00:00.000Z' },
    ]);
    expect(intervals(result.freeSlots)).toEqual([
      { endAt: '2026-09-16T00:00:00.000Z', startAt: '2026-09-15T23:00:00.000Z' },
      { endAt: '2026-09-16T03:00:00.000Z', startAt: '2026-09-16T01:00:00.000Z' },
      { endAt: '2026-09-16T09:00:00.000Z', startAt: '2026-09-16T05:00:00.000Z' },
      { endAt: '2026-09-16T14:00:00.000Z', startAt: '2026-09-16T10:00:00.000Z' },
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid minimumFreeMinutes: %s', (value) => {
    expect(() => calculateFreeTime({ ...defaultInput, minimumFreeMinutes: value })).toThrow(
      FreeTimeCalculationError,
    );
  });

  it('rejects an invalid blocking event interval', () => {
    const event = timedEvent('invalid', '2026-09-16T01:00:00.000Z');

    expect(() => calculateFreeTime({ ...defaultInput, events: [event] })).toThrow(
      FreeTimeCalculationError,
    );
  });
});
