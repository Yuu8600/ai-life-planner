import {
  intersectsCalendarDay,
  loadCalendarPlanningEvents,
  type CalendarEvent,
  type CalendarRepository,
} from '@/features/calendar';
import { generatePlannerPreview } from '@/features/planner/plannerPreview';
import {
  approvePlannerProposal,
  RuleBasedPlannerProvider,
  calculateFreeTime,
} from '@/features/planner';
import { loadPlannerInput } from '@/features/planner/loadPlannerInput';
import { DemoRepositories } from '@/services/demo/DemoRepositories';
import { getUtcDayBounds } from '@/features/today';

function event(
  startAt: string,
  endAt: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    startAt,
    endAt,
    allDay: false,
    allDayStartDate: null,
    allDayEndDate: null,
    availability: 'busy',
    status: 'confirmed',
    id: startAt,
    calendarId: 'cal',
    calendarTitle: null,
    instanceId: null,
    location: null,
    timeZone: null,
    title: 'event',
    ...overrides,
  };
}
const base = {
  selectedDate: '2026-11-06',
  timezone: 'UTC',
  planningStart: '08:00',
  planningEnd: '18:00',
  minimumFreeMinutes: 1,
};
const meeting = event('2026-11-06T10:00:00Z', '2026-11-06T11:00:00Z');
function reader(events: CalendarEvent[]): jest.Mocked<CalendarRepository> {
  return {
    getPermission: jest.fn(async () => ({ status: 'granted' as const, canAskAgain: true })),
    requestPermission: jest.fn(),
    listEvents: jest.fn<
      ReturnType<CalendarRepository['listEvents']>,
      Parameters<CalendarRepository['listEvents']>
    >(async (bounds, date) => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: events.filter((item) => intersectsCalendarDay(item, bounds, date)),
    })),
  };
}

describe('Calendar buffer calculation', () => {
  it.each([
    [15, 30, '09:45', '11:30'],
    [15, 0, '09:45', '11:00'],
    [0, 30, '10:00', '11:30'],
    [0, 0, '10:00', '11:00'],
  ])('expands before=%i after=%i', (before, after, start, end) => {
    const result = calculateFreeTime({
      ...base,
      events: [meeting],
      calendarBufferBeforeMinutes: before,
      calendarBufferAfterMinutes: after,
    });
    expect(result.busyIntervals).toEqual([
      { startAt: `2026-11-06T${start}:00.000Z`, endAt: `2026-11-06T${end}:00.000Z` },
    ]);
    if (!before && !after)
      expect(result).toEqual(calculateFreeTime({ ...base, events: [meeting] }));
  });
  it('merges touching buffers, clamps and applies minimum duration after expansion', () => {
    const result = calculateFreeTime({
      ...base,
      minimumFreeMinutes: 30,
      calendarBufferBeforeMinutes: 15,
      calendarBufferAfterMinutes: 30,
      events: [
        event('2026-11-06T07:00Z', '2026-11-06T08:00Z'),
        meeting,
        event('2026-11-06T11:45Z', '2026-11-06T17:10Z'),
      ],
    });
    expect(result.busyIntervals).toEqual([
      { startAt: '2026-11-06T08:00:00.000Z', endAt: '2026-11-06T08:30:00.000Z' },
      { startAt: '2026-11-06T09:45:00.000Z', endAt: '2026-11-06T17:40:00.000Z' },
    ]);
    expect(result.freeSlots).toEqual([
      {
        startAt: '2026-11-06T08:30:00.000Z',
        endAt: '2026-11-06T09:45:00.000Z',
        durationMinutes: 75,
      },
    ]);
  });
  it.each([{ availability: 'free' as const }, { status: 'canceled' as const }])(
    'does not expand or block nonblocking events: %o',
    (overrides) => {
      expect(
        calculateFreeTime({
          ...base,
          events: [{ ...meeting, ...overrides }],
          calendarBufferBeforeMinutes: 240,
          calendarBufferAfterMinutes: 240,
        }).busyIntervals,
      ).toEqual([]);
    },
  );
  it.each(['tentative', 'unknown', 'not-supported', 'unavailable'] as const)(
    'preserves blocking semantics for %s',
    (availability) => {
      expect(
        calculateFreeTime({
          ...base,
          events: [{ ...meeting, availability }],
          calendarBufferAfterMinutes: 30,
        }).busyIntervals[0].endAt,
      ).toBe('2026-11-06T11:30:00.000Z');
    },
  );
  it('preserves date-only all-day behavior without bleeding into adjacent days', () => {
    const allDay = {
      ...meeting,
      allDay: true,
      allDayStartDate: '2026-11-06',
      allDayEndDate: '2026-11-07',
    };
    expect(
      calculateFreeTime({
        ...base,
        events: [allDay],
        calendarBufferBeforeMinutes: 240,
        calendarBufferAfterMinutes: 240,
      }).freeSlots,
    ).toEqual([]);
    expect(
      calculateFreeTime({
        ...base,
        selectedDate: '2026-11-07',
        events: [allDay],
        calendarBufferBeforeMinutes: 240,
        calendarBufferAfterMinutes: 240,
      }).busyIntervals,
    ).toEqual([]);
  });
  it.each([-1, 241, 1.5, NaN, Infinity])('rejects invalid buffer %s', (value) => {
    expect(() =>
      calculateFreeTime({ ...base, events: [], calendarBufferBeforeMinutes: value }),
    ).toThrow();
    expect(() =>
      calculateFreeTime({ ...base, events: [], calendarBufferAfterMinutes: value }),
    ).toThrow();
  });
  it.each([
    [
      '2026-11-01',
      'America/New_York',
      '2026-11-01T03:30:00Z',
      '2026-11-01T03:50:00Z',
      '2026-11-02T05:10:00Z',
      '2026-11-02T05:30:00Z',
      '2026-11-01T04:20:00.000Z',
      '2026-11-02T04:40:00.000Z',
    ],
    [
      '2026-03-08',
      'America/New_York',
      '2026-03-08T04:30:00Z',
      '2026-03-08T04:50:00Z',
      '2026-03-09T04:10:00Z',
      '2026-03-09T04:30:00Z',
      '2026-03-08T05:20:00.000Z',
      '2026-03-09T03:40:00.000Z',
    ],
    [
      '2026-11-06',
      'Asia/Tokyo',
      '2026-11-05T14:30:00Z',
      '2026-11-05T14:50:00Z',
      '2026-11-06T15:10:00Z',
      '2026-11-06T15:30:00Z',
      '2026-11-05T15:20:00.000Z',
      '2026-11-06T14:40:00.000Z',
    ],
  ])(
    'loads adjacent dates across timezone/DST: %s %s',
    async (date, timezone, prevStart, prevEnd, nextStart, nextEnd, freeStart, freeEnd) => {
      const repository = reader([event(prevStart, prevEnd), event(nextStart, nextEnd)]);
      const result = await loadCalendarPlanningEvents(repository, date, timezone, 30, 30);
      expect(repository.listEvents).toHaveBeenCalledTimes(3);
      expect(repository.listEvents).toHaveBeenCalledWith(getUtcDayBounds(date, timezone), date);
      expect(result.events).toHaveLength(0);
      expect(result.calculationEvents).toHaveLength(2);
      const free = calculateFreeTime({
        ...base,
        selectedDate: date,
        timezone,
        planningStart: '00:00',
        planningEnd: '23:59',
        events: result.calculationEvents,
        calendarBufferBeforeMinutes: 30,
        calendarBufferAfterMinutes: 30,
      });
      expect(free.freeSlots).toEqual([
        {
          startAt: freeStart,
          endAt: freeEnd,
          durationMinutes: (Date.parse(freeEnd) - Date.parse(freeStart)) / 60000,
        },
      ]);
    },
  );
  it('keeps zero-buffer loading to one call and deduplicates multi-day timed occurrences', async () => {
    const spanning = event('2026-11-05T23:30Z', '2026-11-06T00:30Z');
    const repository = reader([spanning]);
    await loadCalendarPlanningEvents(repository, base.selectedDate, 'UTC', 0, 0);
    expect(repository.listEvents).toHaveBeenCalledTimes(1);
    const loaded = await loadCalendarPlanningEvents(repository, base.selectedDate, 'UTC', 15, 30);
    expect(loaded.events).toHaveLength(1);
    expect(loaded.calculationEvents).toHaveLength(1);
  });
  it('safely fails when an adjacent-day read fails', async () => {
    const repository = reader([]);
    repository.listEvents.mockRejectedValueOnce(new Error('calendar failure'));
    await expect(
      loadCalendarPlanningEvents(repository, base.selectedDate, 'UTC', 15, 0),
    ).rejects.toThrow('calendar failure');
  });
  it('persists Demo buffers and provides the same calculation to Calendar and Planner without mutating saved plans', async () => {
    const demo = new DemoRepositories();
    const settings = await demo.settingsRepository.getProfilePlanningSettings();
    expect(settings.calendarBufferBeforeMinutes).toBe(0);
    expect(settings.calendarBufferAfterMinutes).toBe(0);
    const dependencies = {
      settingsRepository: demo.settingsRepository,
      calendarRepository: demo.calendarRepository,
      goalRepository: demo.goalRepository,
      taskRepository: demo.taskRepository,
      now: demo.now,
    };
    const preview = await generatePlannerPreview({
      ...dependencies,
      provider: new RuleBasedPlannerProvider(),
    });
    if (!preview.ok) throw new Error('Expected initial Preview');
    await approvePlannerProposal(demo.persistenceRepository, preview, dependencies);
    const savedBefore = await demo.todayRepository.getToday();
    expect(savedBefore.plan).not.toBeNull();
    const changed = {
      ...settings,
      calendarBufferBeforeMinutes: 15,
      calendarBufferAfterMinutes: 30,
    };
    await demo.settingsRepository.updateProfilePlanningSettings(changed);
    expect(await demo.settingsRepository.getProfilePlanningSettings()).toEqual(changed);
    const planBefore = await demo.todayRepository.getToday();
    expect(planBefore.plan).toEqual(savedBefore.plan);
    const input = await loadPlannerInput({
      settingsRepository: demo.settingsRepository,
      calendarRepository: demo.calendarRepository,
      goalRepository: demo.goalRepository,
      taskRepository: demo.taskRepository,
      now: demo.now,
    });
    const events = await loadCalendarPlanningEvents(
      demo.calendarRepository,
      input.date,
      changed.timezone,
      15,
      30,
    );
    const calculated = calculateFreeTime({
      ...changed,
      selectedDate: input.date,
      events: events.calculationEvents,
    });
    expect(input.freeSlots).toEqual(calculated.freeSlots);
    expect(calculated.freeSlots.reduce((total, slot) => total + slot.durationMinutes, 0)).toBe(525);
    expect(await demo.todayRepository.getToday()).toEqual(planBefore);
    expect(input.calendarEvents).toHaveLength(3);
  });
});
