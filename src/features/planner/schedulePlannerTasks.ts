import type { PlannerAction, PlannerInput, PlannerProposal, PlannerTask } from './contracts';
import type { FreeTimeSlot } from './types';

const MILLISECONDS_PER_MINUTE = 60 * 1_000;
const ACTION_REASON = '候補選定の優先順に従い、最も早い空き時間へ配置しました。';
const UNSCHEDULED_REASON = '推定所要時間を連続して確保できる空き時間がありません。';

type AvailableSlot = {
  end: number;
  sourceIndex: number;
  start: number;
};

function toAvailableSlots(freeSlots: readonly FreeTimeSlot[]): AvailableSlot[] {
  return freeSlots
    .flatMap((slot, sourceIndex): AvailableSlot[] => {
      const start = Date.parse(slot.startAt);
      const end = Date.parse(slot.endAt);

      return Number.isFinite(start) && Number.isFinite(end) && start < end
        ? [{ end, sourceIndex, start }]
        : [];
    })
    .sort(
      (left, right) =>
        left.start - right.start || left.end - right.end || left.sourceIndex - right.sourceIndex,
    );
}

function getTaskDurationMilliseconds(task: PlannerTask): number | null {
  if (!Number.isSafeInteger(task.estimatedMinutes) || task.estimatedMinutes <= 0) return null;

  const duration = task.estimatedMinutes * MILLISECONDS_PER_MINUTE;
  return Number.isSafeInteger(duration) ? duration : null;
}

function createSummary(scheduledCount: number, unscheduledCount: number): string {
  if (scheduledCount === 0 && unscheduledCount === 0) return '計画対象のTaskはありません。';

  return `${scheduledCount}件を予定に配置し、${unscheduledCount}件を未配置としました。`;
}

function compareActionsByStart(left: PlannerAction, right: PlannerAction): number {
  return (
    left.startAt.localeCompare(right.startAt) ||
    left.endAt.localeCompare(right.endAt) ||
    (left.taskId ?? '').localeCompare(right.taskId ?? '')
  );
}

export function schedulePlannerTasks(input: PlannerInput): PlannerProposal {
  const availableSlots = toAvailableSlots(input.freeSlots);
  const actions: PlannerProposal['actions'] = [];
  const unscheduled: PlannerProposal['unscheduled'] = [];

  for (const task of input.tasks) {
    const duration = getTaskDurationMilliseconds(task);
    const slotIndex =
      duration === null
        ? -1
        : availableSlots.findIndex((slot) => slot.start + duration <= slot.end);

    if (slotIndex < 0 || duration === null) {
      unscheduled.push({ reason: UNSCHEDULED_REASON, taskId: task.id });
      continue;
    }

    const slot = availableSlots[slotIndex];
    const start = slot.start;
    const end = start + duration;
    slot.start = end;

    actions.push({
      endAt: new Date(end).toISOString(),
      reason: ACTION_REASON,
      startAt: new Date(start).toISOString(),
      taskId: task.id,
      title: task.title,
    });
  }

  return {
    actions: actions.sort(compareActionsByStart),
    date: input.date,
    summary: createSummary(actions.length, unscheduled.length),
    unscheduled,
  };
}
