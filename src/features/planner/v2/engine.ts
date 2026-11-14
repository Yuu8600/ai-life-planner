import { addLocalDays, getLocalDate } from '@/features/today';
import { clampIntervalToWindow, mergeTimeIntervals, type TimeInterval } from '../index';
import type { DailyPlan, DayInput, PlanChange, PlanningTask, WorkSession } from './types';

export const plannerDefaults = { urgentInitialSlots: 2, taskGapMinutes: 30 };
const minute = 60_000;
const priority = { high: 0, medium: 1, low: 2 };
const start = (item: TimeInterval) => Date.parse(item.startAt);
const end = (item: TimeInterval) => Date.parse(item.endAt);
const duration = (item: TimeInterval) => end(item) - start(item);
const interval = (from: number, to: number): TimeInterval => ({
  startAt: new Date(from).toISOString(),
  endAt: new Date(to).toISOString(),
});
const overlaps = (a: TimeInterval, b: TimeInterval) => start(a) < end(b) && start(b) < end(a);
const active = (item: WorkSession) => item.status === 'scheduled' || item.status === 'completed';
const chronological = (a: TimeInterval, b: TimeInterval) => start(a) - start(b) || end(a) - end(b);

function gaps(window: TimeInterval, blocks: readonly TimeInterval[]): TimeInterval[] {
  if (start(window) >= end(window)) return [];
  const clipped = blocks.flatMap((block) => clampIntervalToWindow(block, window) ?? []);
  let cursor = start(window);
  const free: TimeInterval[] = [];
  for (const block of mergeTimeIntervals(clipped)) {
    if (cursor < start(block)) free.push(interval(cursor, start(block)));
    cursor = end(block);
  }
  if (cursor < end(window)) free.push(interval(cursor, end(window)));
  return free;
}

const futureWindow = (input: DayInput) =>
  interval(
    Math.max(start(input.window), Math.ceil(input.now / minute) * minute),
    end(input.window),
  );

function weekday(date: string) {
  return new Date(date + 'T00:00Z').getUTCDay() || 7;
}

export function weeklyCompletedDays(taskId: string, date: string, history: DayInput['history']) {
  const monday = addLocalDays(date, 1 - weekday(date));
  const sunday = addLocalDays(monday, 6);
  return new Set(
    history
      .filter(
        (day) =>
          day.date >= monday &&
          day.date <= sunday &&
          day.sessions.some((item) => item.taskId === taskId && item.status === 'completed'),
      )
      .map((day) => day.date),
  ).size;
}

function rank(input: DayInput, explicit?: string) {
  const lastByTask = new Map<string, string>();
  const lastByGoal = new Map<string, string>();
  const tasks = new Map(input.tasks.map((task) => [task.id, task]));
  for (const day of input.history) {
    if (day.date > input.date) continue;
    for (const session of day.sessions) {
      if (session.status !== 'completed') continue;
      const goal = tasks.get(session.taskId)?.goalId;
      const executionDate = session.endAt;
      if ((lastByTask.get(session.taskId) ?? '') < executionDate)
        lastByTask.set(session.taskId, executionDate);
      if (goal && (lastByGoal.get(goal) ?? '') < executionDate) lastByGoal.set(goal, executionDate);
    }
  }
  return input.tasks
    .filter((task) => !task.completed && (!explicit || task.id === explicit))
    .sort(
      (a, b) =>
        (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31') ||
        priority[a.priority] - priority[b.priority] ||
        (lastByTask.get(a.id) ?? '').localeCompare(lastByTask.get(b.id) ?? '') ||
        (lastByGoal.get(a.goalId ?? '') ?? '').localeCompare(
          lastByGoal.get(b.goalId ?? '') ?? '',
        ) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

function reason(
  task: PlanningTask,
  input: DayInput,
  sessions: readonly WorkSession[],
  explicit?: string,
) {
  if (!Number.isSafeInteger(task.duration) || task.duration < 1 || task.duration > 1500)
    return '作業時間が活動時間を超えています。';
  if (sessions.some((item) => item.taskId === task.id && item.status === 'skipped'))
    return '今日はしない';
  if (task.id === explicit) return null;
  if (task.deadline && task.deadline < input.date) return '期限切れのため保留中です。';
  if (
    (task.recurrence === 'weekdays' || task.recurrence === 'weekly') &&
    !task.weekdays.includes(weekday(input.date))
  )
    return '繰り返しの対象曜日ではありません。';
  return null;
}

function reserveLeisure(free: TimeInterval[]) {
  const available = free.reduce((total, item) => total + duration(item), 0);
  let remaining = Math.min(
    available,
    Math.max(Math.ceil(available / minute / 4) * minute, 60 * minute),
  );
  const latest = [...free].reverse();
  const whole = latest.find((slot) => duration(slot) >= remaining);
  const result: TimeInterval[] = [];
  for (const slot of whole ? [whole] : latest) {
    const amount = Math.min(remaining, duration(slot));
    if (amount > 0) result.push(interval(end(slot) - amount, end(slot)));
    remaining -= amount;
    if (remaining <= 0) break;
  }
  return result.sort(chronological);
}

function hasGap(
  previous: WorkSession,
  next: WorkSession,
  blocks: readonly TimeInterval[],
  gap: number,
) {
  if (previous.taskId === next.taskId || gap === 0) return true;
  return gaps(interval(end(previous), start(next)), blocks).some(
    (slot) => duration(slot) >= gap * minute,
  );
}

function canPlace(
  candidate: WorkSession,
  sessions: readonly WorkSession[],
  blocks: readonly TimeInterval[],
  input: DayInput,
) {
  const window = futureWindow(input);
  if (
    !Number.isFinite(start(candidate)) ||
    !Number.isFinite(end(candidate)) ||
    start(candidate) < start(window) ||
    end(candidate) > end(window) ||
    duration(candidate) < minute ||
    blocks.some((block) => overlaps(block, candidate))
  )
    return false;
  const occupied = sessions.filter(active).sort(chronological);
  if (occupied.some((item) => overlaps(item, candidate))) return false;
  const previous = occupied.findLast((item) => end(item) <= start(candidate));
  const next = occupied.find((item) => start(item) >= end(candidate));
  return (
    (!previous || hasGap(previous, candidate, blocks, input.gap)) &&
    (!next || hasGap(candidate, next, blocks, input.gap))
  );
}

function place(
  taskId: string,
  title: string,
  length: number,
  sessions: WorkSession[],
  blocks: readonly TimeInterval[],
  input: DayInput,
) {
  const window = futureWindow(input);
  const occupied = sessions.filter(active);
  const slots = gaps(window, [...blocks, ...occupied]);
  for (const slot of slots) {
    const starts = [...new Set([start(slot), start(slot) + input.gap * minute])];
    for (const from of starts) {
      if (from + length > end(slot)) continue;
      const candidate: WorkSession = {
        ...interval(from, from + length),
        id: `${taskId}:${from}`,
        taskId,
        title,
        reason: '空き時間と優先順位に沿った配置',
        status: 'scheduled',
        locked: false,
      };
      if (
        !sessions.some((item) => item.id === candidate.id) &&
        canPlace(candidate, sessions, blocks, input)
      ) {
        sessions.push(candidate);
        return true;
      }
    }
  }
  return false;
}

function schedule(input: DayInput, plan: DailyPlan, explicit?: string, allowAdditional = true) {
  const sessions = [...plan.sessions];
  const blocks = [...input.busy, ...plan.lifestyle, ...plan.leisure];
  const unplaced: DailyPlan['unplaced'] = [];
  const candidates = rank(input, explicit).filter((task) => {
    const excluded = reason(task, input, sessions, explicit);
    if (excluded === null) return true;
    if (excluded !== '繰り返しの対象曜日ではありません。')
      unplaced.push({ taskId: task.id, reason: excluded });
    return false;
  });
  const urgentEnd = addLocalDays(input.date, 1);
  const tryTask = (task: PlanningTask) =>
    place(task.id, task.title, task.duration * minute, sessions, blocks, input);
  for (const task of candidates) {
    if (sessions.some((item) => item.taskId === task.id && active(item))) continue;
    if (!tryTask(task)) {
      unplaced.push({ taskId: task.id, reason: '作業時間とTask間の余裕が入る空きがありません。' });
    } else if (allowAdditional && task.deadline && task.deadline <= urgentEnd) {
      for (let index = 1; index < plannerDefaults.urgentInitialSlots && tryTask(task); index++) {
        // Every successful attempt consumes one positive-duration slot.
      }
    }
  }
  if (allowAdditional) {
    for (const task of candidates) {
      while (tryTask(task)) {
        // A finite window and a duration of at least one minute bound this loop.
      }
    }
  }
  return { ...plan, sessions: sessions.sort(chronological), unplaced };
}

export function createDailyPlan(input: DayInput): DailyPlan {
  if (input.date < getLocalDate(input.now, input.timezone) && end(input.window) <= input.now) {
    throw new Error('過去の日付に新しい計画は作成できません。');
  }
  const lifestyle: DailyPlan['lifestyle'] = [];
  const warnings: string[] = [];
  for (const event of [...input.flexible].sort(
    (a, b) => end(a) - end(b) || a.id.localeCompare(b.id),
  )) {
    const window =
      start(futureWindow(input)) < end(input.window) &&
      clampIntervalToWindow(event, futureWindow(input));
    const slot =
      window &&
      gaps(window, [...input.busy, ...lifestyle]).find(
        (item) => duration(item) >= event.duration * minute,
      );
    if (!slot) {
      warnings.push(`${event.title}を指定の時間帯に配置できません。`);
      continue;
    }
    lifestyle.push({ ...event, ...interval(start(slot), start(slot) + event.duration * minute) });
  }
  const leisure = reserveLeisure(gaps(futureWindow(input), [...input.busy, ...lifestyle]));
  return schedule(input, {
    date: input.date,
    timezone: input.timezone,
    window: input.window,
    sessions: [],
    lifestyle,
    leisure,
    unplaced: [],
    warnings,
    limited: input.limited,
  });
}

export function calendarConflicts(plan: DailyPlan, busy: readonly TimeInterval[]) {
  return [
    ...plan.sessions
      .filter((item) => active(item) && busy.some((block) => overlaps(block, item)))
      .map((item) => `${item.title}が固定予定と重なっています。`),
    ...plan.lifestyle
      .filter((item) => busy.some((block) => overlaps(block, item)))
      .map((item) => `${item.title}が固定予定と重なっています。`),
    ...(plan.leisure.some((item) => busy.some((block) => overlaps(block, item)))
      ? ['確保した自由時間と固定予定が重なっています。']
      : []),
  ];
}

export function changeDailyPlan(input: DayInput, plan: DailyPlan, change: PlanChange): DailyPlan {
  const day = { ...input, window: plan.window };
  if (change.kind === 'replan' && change.taskId) return schedule(day, plan, change.taskId, false);
  if (change.kind === 'replan') {
    const sessions = plan.sessions.map((item): WorkSession =>
      item.status === 'scheduled' &&
      !item.locked &&
      start(item) > day.now &&
      day.busy.some((block) => overlaps(block, item))
        ? { ...item, status: 'deferred' }
        : item,
    );
    const blocks = [...day.busy, ...plan.lifestyle, ...plan.leisure];
    const warnings = [...plan.warnings];
    for (const original of plan.sessions.filter((item, index) => item !== sessions[index])) {
      if (!place(original.taskId, original.title, duration(original), sessions, blocks, day))
        warnings.push(`${original.title}を当日の別の空きに配置できません。`);
    }
    return { ...plan, sessions: sessions.sort(chronological), warnings };
  }
  const target = plan.sessions.find((item) => item.id === change.id);
  if (!target || target.status !== 'scheduled') throw new Error('この作業枠は変更できません。');
  const rest = plan.sessions.filter((item) => item.id !== target.id);
  const blocks = [...day.busy, ...plan.lifestyle, ...plan.leisure];
  const replace = (session: WorkSession) => ({
    ...plan,
    sessions: [...rest, session].sort(chronological),
  });
  switch (change.kind) {
    case 'complete':
      return replace({ ...target, status: 'completed' });
    case 'skip':
      return replace({ ...target, status: 'skipped' });
    case 'unlock':
      return replace({ ...target, locked: false });
    case 'move': {
      if (start(target) <= day.now) throw new Error('開始済みの作業枠は移動できません。');
      const moved = { ...target, ...change.interval, locked: true };
      if (!canPlace(moved, rest, blocks, day))
        throw new Error('時刻、衝突、自由時間、Task間の余裕を確認してください。');
      return replace(moved);
    }
    case 'later': {
      if (target.locked) throw new Error('固定を解除してから「あとで」を使ってください。');
      const next = replace({ ...target, status: 'deferred' });
      const afterTarget = { ...day, now: Math.max(day.now, start(target) + minute) };
      if (
        place(target.taskId, target.title, duration(target), next.sessions, blocks, afterTarget)
      ) {
        return { ...next, sessions: next.sessions.sort(chronological) };
      }
      return {
        ...next,
        warnings: [...next.warnings, `${target.title}を当日中に再配置できません。`],
      };
    }
  }
}
