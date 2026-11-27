import { effectivePolicies, type RecommendationPolicy } from './policy';
import type { Task } from '@/features/tasks/repositories/TaskRepository';
import { addLocalDays, getLocalDate } from '@/features/today';

import {
  EFFORT_OPTIONS,
  type ActionStep,
  type Conditions,
  type RecommendationResult,
  type TargetKind,
} from './repository';

export type Candidate = {
  id: string;
  kind: TargetKind;
  taskId: string;
  taskTitle: string;
  goalId: string | null;
  title: string;
  minutes: number | null;
  reason: string;
  deadline: string | null;
  urgent: boolean;
};

type RankedCandidate = Candidate & {
  priority: Task['priority'];
  created: string;
  lastDone: string;
  fitsCalendar: boolean;
  policyWeight: number;
};

type Input = {
  date: string;
  timezone: string;
  tasks: readonly Task[];
  steps: readonly ActionStep[];
  results: readonly RecommendationResult[];
  conditions: Conditions;
  excluded?: ReadonlySet<string>;
  expandedToday?: boolean;
  calendarMinutes?: number | null;
  policies?: readonly RecommendationPolicy[];
};

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
const priorityOrder = { high: 0, medium: 1, low: 2 };

export function targetKey(kind: TargetKind, id: string) {
  return `${kind}:${id}`;
}

export function taskDeadline(task: Task, timezone: string) {
  return task.localDeadline ?? (task.deadline ? getLocalDate(task.deadline, timezone) : null);
}

function compare(a: RankedCandidate, b: RankedCandidate) {
  return (
    Number(b.urgent) - Number(a.urgent) ||
    (a.urgent ? (a.deadline ?? '').localeCompare(b.deadline ?? '') : 0) ||
    b.policyWeight - a.policyWeight ||
    Number(b.fitsCalendar) - Number(a.fitsCalendar) ||
    Number(a.minutes === null) - Number(b.minutes === null) ||
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31') ||
    a.lastDone.localeCompare(b.lastDone) ||
    a.created.localeCompare(b.created) ||
    a.id.localeCompare(b.id) ||
    a.kind.localeCompare(b.kind)
  );
}

export function recommend({
  date,
  timezone,
  tasks,
  steps,
  results,
  conditions,
  excluded,
  expandedToday,
  calendarMinutes,
  policies = [],
}: Input) {
  const requestedMinutes = conditions.minutes ?? Infinity;
  const activePolicies = effectivePolicies(policies, date);
  const tomorrow = addLocalDays(date, 1);
  const dayOfWeek = new Date(date + 'T00:00Z').getUTCDay();
  const resolved = new Set<string>();
  const lastCompleted = new Map<string, string>();
  for (const result of results) {
    const key = targetKey(result.kind, result.targetId);
    if (result.date === date) resolved.add(key);
    if (
      result.date < date &&
      result.outcome === 'completed' &&
      result.date > (lastCompleted.get(key) ?? '')
    )
      lastCompleted.set(key, result.date);
  }

  const stepsByTask = new Map<string, ActionStep[]>();
  for (const step of steps) {
    const siblings = stepsByTask.get(step.taskId) ?? [];
    siblings.push(step);
    stepsByTask.set(step.taskId, siblings);
  }
  const overdue: Task[] = [];
  const eligible: RankedCandidate[] = [];
  const tooLong: RankedCandidate[] = [];
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'skipped') continue;
    const recurrence = task.recurrence?.kind ?? 'once';
    const scheduledDays = recurrence === 'weekdays' || recurrence === 'weekly';
    const deadline = taskDeadline(task, timezone);
    if (recurrence === 'once' && deadline && deadline < date) {
      overdue.push(task);
      continue;
    }
    if (scheduledDays && !task.recurrence?.weekdays.includes(dayOfWeek || 7)) continue;
    const taskKey = targetKey('task', task.id);
    if (resolved.has(taskKey)) continue;

    function candidate(step?: ActionStep): RankedCandidate {
      const kind = step ? 'step' : 'task';
      const id = step?.id ?? task.id;
      const minutes = step ? step.minutes : task.estimatedMinutes;
      const lastDone = lastCompleted.get(targetKey(kind, id)) ?? '';
      const reasons: string[] = [];
      if (deadline === date) reasons.push('今日が期限');
      else if (deadline === tomorrow) reasons.push('明日が期限');
      const focused = activePolicies.some(
        (policy) =>
          (policy.policyKind === 'focus_task' && policy.targetTaskId === task.id) ||
          (policy.policyKind === 'focus_goal' && policy.targetGoalId === task.goalId),
      );
      const preferShort =
        minutes !== null &&
        minutes <= 15 &&
        activePolicies.some(
          (policy) =>
            policy.policyKind === 'prefer_short' &&
            (!policy.targetTaskId || policy.targetTaskId === task.id) &&
            (!policy.targetGoalId || policy.targetGoalId === task.goalId),
        );
      const fitsCalendar =
        calendarMinutes != null && minutes !== null && minutes <= calendarMinutes;
      if (focused || preferShort) reasons.push(focused ? '優先設定中' : '短時間を優先中');
      if (fitsCalendar) reasons.push(`次の予定まで${calendarMinutes}分`);
      if (recurrence === 'daily') reasons.push('毎日のタスク');
      if (scheduledDays) reasons.push(`毎週${weekdays[dayOfWeek]}曜`);
      if (task.priority === 'high') reasons.push('優先度：高');
      if (lastDone && lastDone <= addLocalDays(date, -7)) reasons.push(`前回の完了：${lastDone}`);
      if (step?.effort)
        reasons.push(
          `負担の目安：${EFFORT_OPTIONS.find((item) => item.value === step.effort)?.label}`,
        );
      if (minutes === null) reasons.push('所要時間は未設定');
      else reasons.push(`所要時間の目安：${minutes}分`);
      return {
        id,
        kind,
        taskId: task.id,
        taskTitle: task.title,
        goalId: task.goalId,
        title: step?.title ?? task.title,
        minutes,
        deadline: deadline && deadline >= date ? deadline : null,
        lastDone,
        priority: task.priority,
        created: step?.createdAt ?? task.createdAt,
        fitsCalendar,
        policyWeight: focused ? 2 : preferShort ? 1 : 0,
        urgent: deadline === date || deadline === tomorrow,
        reason: (expandedToday ? reasons.slice(0, 2) : reasons).join(' ・ '),
      };
    }

    const taskSteps = (stepsByTask.get(task.id) ?? []).filter(
      (step) =>
        !step.completed &&
        !resolved.has(targetKey('step', step.id)) &&
        !excluded?.has(targetKey('step', step.id)) &&
        (!step.effort ||
          conditions.effort === 'normal' ||
          (expandedToday && conditions.effort === 'focus') ||
          step.effort === conditions.effort),
    );
    const actionCandidates = taskSteps.map(candidate).sort(compare);
    const direct = excluded?.has(taskKey) ? [] : [candidate()];
    const options = [...actionCandidates, ...direct];
    // A fitting step gives the user a concrete starting point. Unknown time stays labelled.
    const best =
      options.find(
        (item) => item.fitsCalendar && item.minutes !== null && item.minutes <= requestedMinutes,
      ) ??
      options.find((item) => item.minutes !== null && item.minutes <= requestedMinutes) ??
      options.find((item) => item.minutes === null) ??
      (expandedToday ? direct.find((item) => item.urgent) : undefined);
    if (best) eligible.push(best);
    else if (options.length) tooLong.push(options[0]);
  }

  eligible.sort(compare);
  tooLong.sort(compare);
  const urgentCount = eligible.filter((item) => item.urgent).length;
  const chosen: Candidate[] = [];
  const usedGoals = new Set<string>();
  while (chosen.length < (expandedToday ? 5 : 3) && eligible.length) {
    if (expandedToday && chosen.length === 4) {
      chosen.push(...eligible);
      break;
    }
    const urgent = eligible[0].urgent;
    const diverseIndex = eligible.findIndex(
      (item) =>
        item.urgent === urgent &&
        item.policyWeight === eligible[0].policyWeight &&
        item.fitsCalendar === eligible[0].fitsCalendar &&
        item.goalId !== null &&
        !usedGoals.has(item.goalId),
    );
    const first = chosen.length === 0;
    const [next] = eligible.splice(!first && diverseIndex >= 0 ? diverseIndex : 0, 1);
    chosen.push(next);
    if (next.goalId) usedGoals.add(next.goalId);
  }
  return { candidates: chosen, urgentCount, overdue, startWith: tooLong.at(0) };
}
