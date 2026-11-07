import {
  getPlanningDate,
  getPlanningWindow,
  getPlanningInstant,
  formatPlanningTime,
} from '@/features/today';
import {
  calculateFreeTime,
  RuleBasedPlannerProvider,
  approvePlannerProposal,
  PlannerPreviewStaleError,
} from '@/features/planner';
import { loadPlannerInput } from '@/features/planner/loadPlannerInput';
import { generatePlannerPreview } from '@/features/planner/plannerPreview';
import { DemoRepositories } from '@/services/demo/DemoRepositories';
import {
  loadCalendarPlanningEvents,
  intersectsCalendarDay,
  type CalendarEvent,
} from '@/features/calendar';
import { createSettingsFormValues, validateSettingsForm } from '@/features/settings/validation';
import { DEMO_SETTINGS } from '@/services/demo/sampleData';

const settings = {
  ...DEMO_SETTINGS,
  planningStart: '09:00',
  planningEnd: '02:00',
  planningEndDayOffset: 1 as const,
};
it.each([
  ['2026-11-07T14:59:00Z', '2026-11-07'],
  ['2026-11-07T15:00:00Z', '2026-11-07'],
  ['2026-11-07T15:30:00Z', '2026-11-07'],
  ['2026-11-07T16:59:00Z', '2026-11-07'],
  ['2026-11-07T17:00:00Z', '2026-11-08'],
  ['2026-11-07T18:00:00Z', '2026-11-08'],
  ['2026-12-31T16:59:00Z', '2026-12-31'],
  ['2027-01-31T16:59:00Z', '2027-01-31'],
])('resolves planning date at %s', (instant, date) =>
  expect(getPlanningDate(new Date(instant), settings)).toBe(date),
);
it('keeps offset zero on the calendar date and handles midnight and exactly 24 wall-clock hours', () => {
  expect(
    getPlanningDate(new Date('2026-11-07T15:30Z'), {
      ...settings,
      planningEnd: '23:59',
      planningEndDayOffset: 0,
    }),
  ).toBe('2026-11-08');
  expect(getPlanningWindow('2026-11-07', settings)).toEqual({
    startAt: '2026-11-07T00:00:00.000Z',
    endAt: '2026-11-07T17:00:00.000Z',
  });
  expect(
    getPlanningWindow('2026-11-07', { ...settings, planningStart: '00:00', planningEnd: '00:00' }),
  ).toEqual({ startAt: '2026-11-06T15:00:00.000Z', endAt: '2026-11-07T15:00:00.000Z' });
  expect(formatPlanningTime('2026-11-07T16:00Z', '2026-11-07', settings.timezone)).toBe(
    '翌日 01:00',
  );
});
it.each([
  ['2026-03-08', '02:30'],
  ['2026-11-01', '01:30'],
])('rejects missing/folded NY local time %s %s', (date, time) =>
  expect(() => getPlanningInstant(date, time, 'America/New_York')).toThrow(),
);
it.each([
  ['2026-03-08', 23],
  ['2026-11-01', 25],
])('keeps local midnight boundaries through DST %s', (date, hours) => {
  const window = getPlanningWindow(date, {
    ...settings,
    timezone: 'America/New_York',
    planningStart: '00:00',
    planningEnd: '00:00',
  });
  expect((Date.parse(window.endAt) - Date.parse(window.startAt)) / 3600000).toBe(hours);
});
it.each([
  ['09:00', '09:00', '0'],
  ['09:00', '10:00', '1'],
  ['09:00', '24:00', '1'],
  ['09:00', '02:00', '2'],
])('rejects invalid Settings %s %s %s', (start, end, offset) => {
  expect(
    validateSettingsForm({
      ...createSettingsFormValues(settings),
      planningStart: start,
      planningEnd: end,
      planningEndDayOffset: offset,
    }).input,
  ).toBeNull();
});
it('preserves minute precision and serializes next-day settings', () => {
  const value = validateSettingsForm({
    ...createSettingsFormValues(settings),
    planningStart: '20:17',
    planningEnd: '01:59',
  });
  expect(value.input).toEqual({ ...settings, planningStart: '20:17', planningEnd: '01:59' });
});
function event(
  startAt: string,
  endAt: string,
  changes: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: startAt,
    calendarId: 'cal',
    instanceId: null,
    title: 'night',
    startAt,
    endAt,
    allDay: false,
    allDayStartDate: null,
    allDayEndDate: null,
    availability: 'busy',
    status: 'confirmed',
    calendarTitle: null,
    location: null,
    timeZone: null,
    ...changes,
  };
}
const calc = (events: CalendarEvent[]) =>
  calculateFreeTime({ ...settings, selectedDate: '2026-11-07', events, minimumFreeMinutes: 1 });
it('blocks overnight timed events and only the correct part of all-day exclusive date ranges', () => {
  expect(calc([event('2026-11-07T15:30Z', '2026-11-07T16:30Z')]).busyIntervals).toEqual([
    { startAt: '2026-11-07T15:30:00.000Z', endAt: '2026-11-07T16:30:00.000Z' },
  ]);
  expect(
    calc([
      event('2026-11-07T15:00Z', '2026-11-08T15:00Z', {
        allDay: true,
        allDayStartDate: '2026-11-08',
        allDayEndDate: '2026-11-09',
      }),
    ]).busyIntervals,
  ).toEqual([{ startAt: '2026-11-07T15:00:00.000Z', endAt: '2026-11-07T17:00:00.000Z' }]);
  expect(
    calc([
      event('2026-11-06T15:00Z', '2026-11-07T15:00Z', {
        allDay: true,
        allDayStartDate: '2026-11-07',
        allDayEndDate: '2026-11-08',
      }),
    ]).busyIntervals,
  ).toEqual([{ startAt: '2026-11-07T00:00:00.000Z', endAt: '2026-11-07T15:00:00.000Z' }]);
});
it('loads the activity end day plus buffer neighbors, preserving all-day and individual zero', async () => {
  const demo = new DemoRepositories();
  const overnight = event('2026-11-07T16:00Z', '2026-11-07T16:30Z');
  await demo.eventBufferRepository.upsert({
    calendarId: 'cal',
    eventId: overnight.id,
    occurrenceStartAt: overnight.startAt,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
  });
  const listEvents = jest.fn(async (bounds: { startAt: string; endAt: string }, date: string) => ({
    events: [overnight].filter((e) => intersectsCalendarDay(e, bounds, date)),
    calendarCount: 1,
    discardedEventCount: 0,
  }));
  const loaded = await loadCalendarPlanningEvents(
    { ...demo.calendarRepository, listEvents },
    '2026-11-07',
    settings.timezone,
    30,
    30,
    demo.eventBufferRepository,
    1,
  );
  expect(listEvents).toHaveBeenCalledTimes(4);
  expect(loaded.events).toEqual([]);
  expect(loaded.calculationEvents).toHaveLength(1);
  expect(
    calculateFreeTime({
      ...settings,
      selectedDate: '2026-11-07',
      events: loaded.calculationEvents,
      calendarEventBufferOverrides: loaded.overrides,
      calendarBufferBeforeMinutes: 30,
      calendarBufferAfterMinutes: 30,
      minimumFreeMinutes: 1,
    }).busyIntervals,
  ).toEqual([{ startAt: '2026-11-07T16:00:00.000Z', endAt: '2026-11-07T16:30:00.000Z' }]);
});
it.each(['rule-based', 'openai'])(
  'generates, saves, executes and rejects stale overnight %s previews in Demo',
  async (id) => {
    const demo = new DemoRepositories();
    await demo.settingsRepository.updateProfilePlanningSettings(settings);
    demo.advanceToOvernight();
    const dependencies = {
      calendarRepository: demo.calendarRepository,
      eventBufferRepository: demo.eventBufferRepository,
      settingsRepository: demo.settingsRepository,
      taskRepository: demo.taskRepository,
      goalRepository: demo.goalRepository,
      now: demo.now,
    };
    const provider = {
      id,
      generate: (input: Parameters<RuleBasedPlannerProvider['generate']>[0]) =>
        new RuleBasedPlannerProvider().generate(input),
    };
    const preview = await generatePlannerPreview({ ...dependencies, provider });
    if (!preview.ok) throw Error('Expected preview');
    expect(preview.input.date).toBe('2026-11-06');
    expect(preview.proposal.actions[0].startAt).toBe('2026-11-06T16:00:00.000Z');
    await approvePlannerProposal(demo.persistenceRepository, preview, dependencies);
    const today = await demo.todayRepository.getToday();
    expect(today.localDate).toBe('2026-11-06');
    expect(today.plan?.actions.length).toBeGreaterThan(0);
    await demo.executionRepository.transition({
      actionId: today.plan!.actions[0].id,
      targetStatus: 'completed',
    });
    if (today.plan!.actions[1])
      await demo.executionRepository.transition({
        actionId: today.plan!.actions[1].id,
        targetStatus: 'skipped',
      });
    expect((await demo.activityLogRepository.listForPlanDate('2026-11-06'))[0].planDate).toBe(
      '2026-11-06',
    );
    const before = (await demo.todayRepository.getToday()).plan;
    await demo.settingsRepository.updateProfilePlanningSettings({
      ...settings,
      planningEnd: '01:00',
    });
    await expect(
      approvePlannerProposal(demo.persistenceRepository, preview, dependencies),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    await demo.settingsRepository.updateProfilePlanningSettings(settings);
    expect((await demo.todayRepository.getToday()).plan).toEqual(before);
    const fresh = await loadPlannerInput(dependencies);
    expect(fresh.date).toBe('2026-11-06');
  },
);
