import type { Task } from '@/features/tasks/repositories/TaskRepository';
import { recommend } from '@/features/recommendations/recommend';
import type { ActionStep, RecommendationResult } from '@/features/recommendations/repository';

const date = '2026-11-18'; // Wednesday in the user's timezone.
function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
    userId: 'owner',
    estimatedMinutes: 15,
    deadline: null,
    goalId: null,
    priority: 'medium',
    status: 'pending',
    ...changes,
  };
}
function step(id: string, taskId: string, changes: Partial<ActionStep> = {}): ActionStep {
  return {
    id,
    taskId,
    title: id,
    createdAt: '2026-11-01',
    minutes: 15,
    effort: 'light',
    repeatable: false,
    completed: false,
    ...changes,
  };
}
function result(
  kind: 'task' | 'step',
  id: string,
  changes: Partial<RecommendationResult> = {},
): RecommendationResult {
  return {
    date,
    kind,
    targetId: id,
    taskId: id,
    goalId: null,
    title: id,
    outcome: 'skipped',
    ...changes,
  };
}
function run(changes: Partial<Parameters<typeof recommend>[0]> = {}) {
  return recommend({
    date,
    timezone: 'Asia/Tokyo',
    tasks: [],
    steps: [],
    results: [],
    conditions: { minutes: 15, effort: 'light' },
    ...changes,
  });
}

it('prioritizes an urgent task and spreads the remaining recommendations across goals deterministically', () => {
  const tasks = [
    task('a', { goalId: 'one', priority: 'high' }),
    task('b', { goalId: 'one', localDeadline: '2026-11-19' }),
    task('c', { goalId: 'two' }),
    task('d', { goalId: 'three' }),
  ];
  const ids = (list: Task[]) => run({ tasks: list }).candidates.map((item) => item.id);
  expect(ids(tasks)).toEqual(['b', 'c', 'd']);
  expect(ids([...tasks].reverse())).toEqual(ids(tasks));
  expect(run({ tasks }).candidates[0].reason).toContain('明日が期限');
});

it('uses local deadlines, recurrence days and persisted outcomes after a fresh load', () => {
  const tasks = [
    task('old', { deadline: '2026-11-17T14:59:00Z' }),
    task('today', { deadline: '2026-11-17T16:00:00Z' }),
    task('wed', { recurrence: { kind: 'weekly', weekdays: [3] } }),
    task('thu', { recurrence: { kind: 'weekdays', weekdays: [4] } }),
    task('daily', { recurrence: { kind: 'daily', weekdays: [] } }),
    task('done', { status: 'completed' }),
  ];
  const results = [result('task', 'today'), result('task', 'daily', { outcome: 'completed' })];
  const first = run({ tasks, results });
  expect(first.candidates.map((item) => item.id)).toEqual(['wed']);
  expect(first.candidates[0].reason).toContain('毎週水曜');
  expect(first.overdue.map((item) => item.id)).toEqual(['old']);
  expect(run({ date: '2026-11-19', tasks, results }).candidates.map((item) => item.id)).toEqual([
    'thu',
    'daily',
  ]);
});

it('uses actual estimates and effort, offers an editable starting point for oversized work', () => {
  const tasks = [
    task('parent', { estimatedMinutes: 120 }),
    task('unknown', { estimatedMinutes: null }),
  ];
  const steps = [step('fits', 'parent'), step('focus', 'parent', { effort: 'focus' })];
  const first = run({ tasks, steps });
  expect(first.candidates.map((item) => item.id)).toEqual(['fits', 'unknown']);
  expect(first.candidates[1].reason).toBe('所要時間は未設定');
  const next = run({
    tasks: [tasks[0]],
    steps,
    results: [result('step', 'fits', { outcome: 'completed' })],
  });
  expect(next.candidates).toEqual([]);
  expect(next.startWith?.id).toBe('parent');
  const alternative = run({ tasks, steps, excluded: new Set(['step:fits']) });
  expect(alternative.candidates.map((item) => item.id)).toEqual(['unknown']);
});

it('ranks an action with an older completion first and shows its recorded date', () => {
  const tasks = [task('a'), task('b')];
  const results = [
    result('task', 'a', { date: '2026-11-17', outcome: 'completed' }),
    result('task', 'b', { date: '2026-11-10', outcome: 'completed' }),
  ];
  expect(run({ tasks, results }).candidates[0]).toMatchObject({
    id: 'b',
    reason: expect.stringContaining('前回の完了：2026-11-10'),
  });
});

it('keeps urgent work visible on a busy day and exposes candidates beyond the first four', () => {
  const tasks = [
    task('urgent', { localDeadline: '2026-11-19', estimatedMinutes: 90 }),
    ...['a', 'b', 'c', 'd', 'e'].map((id) => task(id, { estimatedMinutes: 15 })),
  ];
  const { candidates } = run({ tasks, expandedToday: true });
  expect(candidates[0]).toMatchObject({
    id: 'urgent',
    reason: expect.stringContaining('明日が期限'),
  });
  expect(candidates).toHaveLength(6);
});
