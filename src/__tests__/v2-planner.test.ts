import { approvePlan, loadDay, previewPlan } from '@/features/planner/v2/dayService';
import {
  calendarConflicts,
  changeDailyPlan,
  createDailyPlan,
  weeklyCompletedDays,
} from '@/features/planner/v2/engine';
import type { DayInput, PlanningTask } from '@/features/planner/v2/types';

const date = '2026-11-16';
const at = (time: string) => `${date}T${time}:00.000Z`;
const range = (from: string, to: string) => ({ startAt: at(from), endAt: at(to) });
const task: PlanningTask = {
  id: 'a',
  title: 'A',
  priority: 'high',
  goalId: null,
  deadline: null,
  createdAt: date,
  duration: 30,
  completed: false,
  recurrence: 'once',
  weekdays: [],
};
const day: DayInput = {
  date,
  timezone: 'UTC',
  now: Date.parse(at('08:29')) + 1,
  window: range('08:00', '16:30'),
  busy: [range('10:00', '11:00')],
  flexible: [],
  tasks: [task],
  history: [],
  gap: 30,
  limited: false,
};

it('protects leisure, blocks, elapsed time and finite deterministic work', () => {
  const plan = createDailyPlan(day);
  expect(plan).toEqual(createDailyPlan(day));
  expect(plan.leisure).toEqual([range('14:45', '16:30')]);
  expect(plan.sessions[0].startAt).toBe(at('08:30'));
  expect(plan.sessions).toHaveLength(10);
  expect(calendarConflicts(plan, day.busy)).toEqual([]);
  expect(plan.sessions.every((item) => item.endAt <= at('14:45'))).toBe(true);
  expect(createDailyPlan({ ...day, window: range('08:00', '09:10') }).leisure).toEqual([
    range('08:30', '09:10'),
  ]);
});

it('requires genuinely empty transition time independently of leisure', () => {
  const input = {
    ...day,
    now: Date.parse(at('08:00')),
    window: range('08:00', '12:00'),
    busy: [range('09:00', '10:00')],
    tasks: [
      { ...task, duration: 60 },
      { ...task, id: 'b', priority: 'low' as const, duration: 60 },
    ],
  };
  const plan = createDailyPlan(input);
  expect(plan.sessions.map((item) => item.taskId)).toEqual(['a', 'a']);
  expect(plan.unplaced).toEqual([expect.objectContaining({ taskId: 'b' })]);
});

it('excludes past deadlines and runs scheduled weekdays with Monday week boundaries', () => {
  const expired = { ...task, id: 'expired', deadline: '2026-11-15' };
  const recurring = { ...task, id: 'weekly', recurrence: 'weekly' as const, weekdays: [1, 3, 5] };
  const tuesdayOnly = { ...recurring, id: 'tuesday', weekdays: [2] };
  const plan = createDailyPlan({ ...day, tasks: [expired, recurring, tuesdayOnly] });
  expect(plan.sessions.every((item) => item.taskId === 'weekly')).toBe(true);
  expect(plan.unplaced).toEqual([expect.objectContaining({ taskId: 'expired' })]);
  const completed = {
    ...plan,
    sessions: plan.sessions.map((item) => ({ ...item, status: 'completed' as const })),
  };
  expect(weeklyCompletedDays('weekly', date, [completed, completed])).toBe(1);
  expect(weeklyCompletedDays('weekly', '2026-11-23', [completed])).toBe(0);
});

it('creates a preview, locks manual edits and records work separately from the Task', () => {
  const input = { ...day, tasks: [{ ...task, duration: 180 }] };
  const original = createDailyPlan(input);
  const [session] = original.sessions;
  const moved = changeDailyPlan(input, original, {
    kind: 'move',
    id: session.id,
    interval: range('11:15', '14:15'),
  });
  expect(moved.sessions[0]).toMatchObject({ ...range('11:15', '14:15'), locked: true });
  expect(original.sessions[0].locked).toBe(false);
  expect(() => changeDailyPlan(input, moved, { kind: 'later', id: session.id })).toThrow();
  expect(
    changeDailyPlan(input, moved, { kind: 'complete', id: session.id }).sessions[0].status,
  ).toBe('completed');
  expect(input.tasks[0].completed).toBe(false);
});

it('requires current inputs and an explicit approval before writing a preview', async () => {
  const settings = {
    timezone: 'UTC',
    planningStart: '08:00',
    planningEnd: '16:30',
    planningEndDayOffset: 0 as const,
    minimumFreeMinutes: 1,
    calendarBufferBeforeMinutes: 0,
    calendarBufferAfterMinutes: 0,
  };
  const saved = createDailyPlan(day);
  const save = jest.fn(async () => {});
  let source = 'first';
  const deps = {
    now: () => day.now,
    repository: {
      getSettings: async () => settings,
      load: async () => ({
        source,
        settings,
        events: [],
        gap: day.gap,
        history: [],
        tasks: [task],
        saved: { revision: 'same', plan: saved },
      }),
      save,
      addEvent: jest.fn(),
      removeEvent: jest.fn(),
      getGap: jest.fn(),
      setGap: jest.fn(),
    },
    calendar: {
      getPermission: async () => ({ status: 'granted' as const, canAskAgain: true }),
      requestPermission: jest.fn(),
      listEvents: async () => ({ calendarCount: 1, discardedEventCount: 0, events: [] }),
    },
  };
  const loaded = await loadDay(deps, date, false);
  const preview = previewPlan(loaded, { kind: 'complete', id: saved.sessions[0].id });
  expect(save).not.toHaveBeenCalled();
  source = 'changed';
  await expect(approvePlan(deps, preview, false)).rejects.toThrow('確認中');
  expect(save).not.toHaveBeenCalled();
  source = 'first';
  await approvePlan(deps, preview, false);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    date,
    'same',
    'first',
    expect.objectContaining({
      sessions: expect.arrayContaining([expect.objectContaining({ status: 'completed' })]),
    }),
  );
});
