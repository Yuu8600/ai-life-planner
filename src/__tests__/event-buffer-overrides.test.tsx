import { selectDuration } from '@/testUtils/timeSelection';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  eventBufferKey,
  effectiveEventBuffers,
  loadCalendarPlanningEvents,
  type CalendarEvent,
  type CalendarEventBufferOverride,
} from '@/features/calendar';
import { EventBufferEditor } from '@/features/calendar/components/EventBufferEditor';
import {
  calculateFreeTime,
  RuleBasedPlannerProvider,
  approvePlannerProposal,
} from '@/features/planner';
import { generatePlannerPreview } from '@/features/planner/plannerPreview';
import { DemoRepositories } from '@/services/demo/DemoRepositories';
import { SupabaseCalendarEventBufferRepository } from '@/services/supabase/repositories/SupabaseCalendarEventBufferRepository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/services/supabase/database.types';

// Keep the repository's client import from installing SQLite localStorage in Jest.
jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const event: CalendarEvent = {
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  availability: 'busy',
  status: 'confirmed',
  calendarId: 'cal',
  id: 'recurring',
  instanceId: 'volatile',
  startAt: '2026-11-06T10:00:00Z',
  endAt: '2026-11-06T11:00:00Z',
  calendarTitle: null,
  location: null,
  timeZone: null,
  title: 'same title',
};
const override: CalendarEventBufferOverride = {
  ...eventBufferKey(event),
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
};
const base = {
  events: [event],
  selectedDate: '2026-11-06',
  timezone: 'UTC',
  planningStart: '08:00',
  planningEnd: '18:00',
  minimumFreeMinutes: 1,
  calendarBufferBeforeMinutes: 30,
  calendarBufferAfterMinutes: 30,
};

it('resolves both individual values including zero and matches occurrence rather than title or instanceId', () => {
  expect(effectiveEventBuffers(event, 30, 30, [])).toEqual({ before: 30, after: 30 });
  expect(effectiveEventBuffers(event, 240, 240, [override])).toEqual({ before: 0, after: 15 });
  expect(
    effectiveEventBuffers(
      { ...event, startAt: '2026-11-06T10:00:00.000Z', instanceId: 'changed' } as CalendarEvent,
      30,
      30,
      [override],
    ),
  ).toEqual({ before: 0, after: 15 });
  for (const changed of [
    { ...event, startAt: '2026-11-07T10:00Z' },
    { ...event, id: 'different' },
    { ...event, calendarId: 'other' },
  ])
    expect(effectiveEventBuffers(changed, 30, 30, [override])).toEqual({ before: 30, after: 30 });
});
it('overrides common buffers in the existing merge/clamp calculation without mutating events', () => {
  const original = JSON.stringify(event);
  const result = calculateFreeTime({ ...base, calendarEventBufferOverrides: [override] });
  expect(result.busyIntervals).toEqual([
    { startAt: '2026-11-06T10:00:00.000Z', endAt: '2026-11-06T11:15:00.000Z' },
  ]);
  expect(calculateFreeTime({ ...base, calendarEventBufferOverrides: [] })).toEqual(
    calculateFreeTime(base),
  );
  expect(JSON.stringify(event)).toBe(original);
});
it.each([{ availability: 'free' as const }, { status: 'canceled' as const }])(
  'does not block excluded events with individual buffers: %o',
  (change) => {
    expect(
      calculateFreeTime({
        ...base,
        events: [{ ...event, ...change }],
        calendarEventBufferOverrides: [override],
      }).busyIntervals,
    ).toEqual([]);
  },
);
it('preserves all-day semantics and does not expand all-day dates', () => {
  const allDay = {
    ...event,
    allDay: true,
    allDayStartDate: '2026-11-05',
    allDayEndDate: '2026-11-06',
  };
  expect(
    calculateFreeTime({
      ...base,
      events: [allDay],
      calendarEventBufferOverrides: [{ ...override, bufferAfterMinutes: 240 }],
    }).busyIntervals,
  ).toEqual([]);
});
it('loads adjacent occurrences for individual-only buffers, keeps display day unchanged and fails closed', async () => {
  const demo = new DemoRepositories();
  await demo.eventBufferRepository.upsert({
    ...override,
    occurrenceStartAt: '2026-11-05T23:50:00Z',
    bufferAfterMinutes: 30,
  });
  const adjacent = { ...event, startAt: '2026-11-05T23:50:00Z', endAt: '2026-11-05T23:59:00Z' };
  const listEvents = jest.fn(async (_bounds: unknown, date: string) => ({
    calendarCount: 1,
    discardedEventCount: 0,
    events: date === '2026-11-05' ? [adjacent] : [],
  }));
  const repo = { ...demo.calendarRepository, listEvents };
  const loaded = await loadCalendarPlanningEvents(
    repo,
    '2026-11-06',
    'UTC',
    0,
    0,
    demo.eventBufferRepository,
  );
  expect(listEvents).toHaveBeenCalledTimes(2);
  expect(loaded.events).toEqual([]);
  expect(
    calculateFreeTime({
      ...base,
      planningStart: '00:00',
      events: loaded.calculationEvents,
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      calendarEventBufferOverrides: loaded.overrides,
    }).busyIntervals[0].endAt,
  ).toBe('2026-11-06T00:29:00.000Z');
  const failing = {
    ...demo.eventBufferRepository,
    list: jest.fn(async () => {
      throw new Error('fetch failed');
    }),
  };
  await expect(
    loadCalendarPlanningEvents(repo, '2026-11-06', 'UTC', 0, 0, failing),
  ).rejects.toThrow('fetch failed');
});
it('saves, isolates Demo instances, retains individual values across common changes, deletes and resets on reload', async () => {
  const demo = new DemoRepositories();
  await demo.eventBufferRepository.upsert(override);
  await demo.settingsRepository.updateProfilePlanningSettings({
    ...(await demo.settingsRepository.getProfilePlanningSettings()),
    calendarBufferBeforeMinutes: 240,
  });
  expect(await demo.eventBufferRepository.list()).toEqual([override]);
  expect(await new DemoRepositories().eventBufferRepository.list()).toEqual([]);
  await demo.eventBufferRepository.remove(override);
  expect(effectiveEventBuffers(event, 240, 30, await demo.eventBufferRepository.list())).toEqual({
    before: 240,
    after: 30,
  });
});
it('prevents double submission, preserves errors, supports zero and resetting to common', async () => {
  let finish!: () => void;
  const upsert = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const remove = jest.fn(async () => {}),
    close = jest.fn(),
    saved = jest.fn();
  const props = {
    event,
    timeLabel: '10:00–11:00',
    commonBefore: 30,
    commonAfter: 30,
    repository: { list: async () => [], upsert, remove },
    onClose: close,
    onSaved: saved,
  };
  const screen = await render(<EventBufferEditor {...props} />);
  await fireEvent.press(screen.getByText('この予定だけ変更する'));
  await selectDuration(screen, 'この予定の前の余白', '1.5');
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(upsert).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('この予定の前の余白の詳細（分）'), '0');
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  await fireEvent.press(screen.getByText('余白設定を保存'));
  await fireEvent.press(screen.getByText('保存中…'));
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ bufferBeforeMinutes: 0, bufferAfterMinutes: 30 }),
  );
  await act(async () => finish());
  expect(saved).toHaveBeenCalledTimes(1);
  await screen.unmount();
  const reset = await render(<EventBufferEditor {...props} individual={override} />);
  await fireEvent.press(reset.getByText('共通設定を使う'));
  await fireEvent.press(reset.getByText('余白設定を保存'));
  expect(remove).toHaveBeenCalledWith(eventBufferKey(event));
});
it('keeps editor open with a safe error after a failed save', async () => {
  const close = jest.fn();
  const screen = await render(
    <EventBufferEditor
      event={event}
      timeLabel="10:00–11:00"
      commonBefore={0}
      commonAfter={0}
      individual={override}
      repository={{
        list: async () => [],
        upsert: async () => {
          throw new Error('private secret');
        },
        remove: async () => {},
      }}
      onClose={close}
      onSaved={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByText('余白設定を保存'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByText(/private secret/)).toBeNull();
});

function adapter(
  pages: {
    data: Database['public']['Tables']['calendar_event_buffer_overrides']['Row'][];
    count: number | null;
    error: null | Error;
  }[],
) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    range: jest.fn(async () => pages.shift()),
    upsert: jest.fn(),
    single: jest.fn(async () => ({ data: { user_id: 'owner' }, error: null })),
    delete: jest.fn(),
  };
  for (const key of ['select', 'eq', 'order', 'upsert', 'delete'] as const)
    builder[key].mockReturnValue(builder);
  const from = jest.fn(() => builder);
  return {
    repository: new SupabaseCalendarEventBufferRepository(
      { from } as unknown as SupabaseClient<Database>,
      'owner',
    ),
    builder,
  };
}
function row(index: number) {
  return {
    user_id: 'owner',
    calendar_id: 'cal',
    event_id: String(index),
    occurrence_start_at: event.startAt,
    buffer_before_minutes: 0,
    buffer_after_minutes: 15,
    created_at: event.startAt,
    updated_at: event.startAt,
  };
}
it('paginates by actual rows and exact count even when the server cap is lower than the requested page', async () => {
  const { repository, builder } = adapter([
    { data: [row(0), row(1)], count: 5, error: null },
    { data: [row(2), row(3)], count: 5, error: null },
    { data: [row(4)], count: 5, error: null },
  ]);
  expect(await repository.list()).toHaveLength(5);
  expect(builder.range.mock.calls).toEqual([
    [0, 499],
    [2, 501],
    [4, 503],
  ]);
  expect(builder.eq).toHaveBeenCalledWith('user_id', 'owner');
  await repository.upsert(override);
  expect(builder.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: 'owner',
      calendar_id: 'cal',
      event_id: 'recurring',
      buffer_before_minutes: 0,
    }),
    expect.any(Object),
  );
  await repository.remove(override);
  expect(builder.eq).toHaveBeenCalledWith('occurrence_start_at', override.occurrenceStartAt);
});
it.each(['missing-count', 'empty-page', 'changing-count', 'wrong-owner', 'duplicate'])(
  'rejects incomplete or unsafe list %s',
  async (kind) => {
    const pages =
      kind === 'changing-count'
        ? [
            { data: [row(0)], count: 2, error: null },
            { data: [row(1)], count: 3, error: null },
          ]
        : [
            {
              data:
                kind === 'empty-page'
                  ? []
                  : kind === 'wrong-owner'
                    ? [{ ...row(0), user_id: 'other' }]
                    : kind === 'duplicate'
                      ? [row(0), row(0)]
                      : [row(0)],
              count: kind === 'missing-count' ? null : kind === 'duplicate' ? 2 : 1,
              error: null,
            },
          ];
    await expect(adapter(pages).repository.list()).rejects.toThrow();
  },
);

it.each([
  ['2026-11-01', '2026-11-01T03:50:00Z', '2026-11-01T03:59:00Z', '2026-11-01T04:29:00.000Z'],
  ['2026-03-08', '2026-03-08T04:50:00Z', '2026-03-08T04:59:00Z', '2026-03-08T05:29:00.000Z'],
])(
  'applies individual-only adjacent buffers across DST %s',
  async (date, startAt, endAt, expectedEnd) => {
    const target = { ...event, startAt, endAt };
    const demo = new DemoRepositories();
    await demo.eventBufferRepository.upsert({
      ...eventBufferKey(target),
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 30,
    });
    const loaded = await loadCalendarPlanningEvents(
      {
        ...demo.calendarRepository,
        listEvents: async (_interval, day) => ({
          calendarCount: 1,
          discardedEventCount: 0,
          events: day < date ? [target] : [],
        }),
      },
      date,
      'America/New_York',
      0,
      0,
      demo.eventBufferRepository,
    );
    const calculated = calculateFreeTime({
      ...base,
      selectedDate: date,
      timezone: 'America/New_York',
      planningStart: '00:00',
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      events: loaded.calculationEvents,
      calendarEventBufferOverrides: loaded.overrides,
    });
    expect(calculated.busyIntervals[0].endAt).toBe(expectedEnd);
    expect(loaded.events).toHaveLength(0);
  },
);

it('deduplicates an occurrence across adjacent reads even when volatile instanceId differs', async () => {
  const demo = new DemoRepositories();
  const span = { ...event, startAt: '2026-11-05T23:00:00Z', endAt: '2026-11-06T01:00:00Z' };
  const loaded = await loadCalendarPlanningEvents(
    {
      ...demo.calendarRepository,
      listEvents: async (_interval, day) => ({
        calendarCount: 1,
        discardedEventCount: 0,
        events: day <= '2026-11-06' ? [{ ...span, instanceId: day }] : [],
      }),
    },
    '2026-11-06',
    'UTC',
    15,
    30,
    demo.eventBufferRepository,
  );
  expect(loaded.calculationEvents).toHaveLength(1);
  expect(loaded.events).toHaveLength(1);
});

it('does not move saved Demo Actions when individual buffers change', async () => {
  const demo = new DemoRepositories();
  const dependencies = {
    calendarRepository: demo.calendarRepository,
    eventBufferRepository: demo.eventBufferRepository,
    settingsRepository: demo.settingsRepository,
    taskRepository: demo.taskRepository,
    goalRepository: demo.goalRepository,
    now: demo.now,
  };
  const preview = await generatePlannerPreview({
    ...dependencies,
    provider: new RuleBasedPlannerProvider(),
  });
  if (!preview.ok) throw new Error('Expected initial plan');
  await approvePlannerProposal(demo.persistenceRepository, preview, dependencies);
  const before = await demo.todayRepository.getToday();
  expect(before.plan).not.toBeNull();
  const events = await demo.calendarRepository.listEvents(
    { startAt: '2026-11-05T15:00:00Z', endAt: '2026-11-06T15:00:00Z' },
    '2026-11-06',
  );
  await demo.eventBufferRepository.upsert({
    ...eventBufferKey(events.events[0]),
    bufferBeforeMinutes: 240,
    bufferAfterMinutes: 240,
  });
  expect((await demo.todayRepository.getToday()).plan).toEqual(before.plan);
});
