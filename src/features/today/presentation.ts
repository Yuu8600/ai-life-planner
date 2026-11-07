import { formatPlanningTime } from './planningTime';
import type {
  PlannedActionStatus,
  TodayDailyPlan,
  TodayDeadlineTask,
  TodayPlannedAction,
} from './repositories/TodayRepository';
import type { DeadlineTaskItem, TimelineItem } from './types';

const STATUS_LABELS: Record<PlannedActionStatus, string> = {
  completed: '完了',
  scheduled: '予定',
  skipped: 'スキップ',
};

const TASK_STATUS_LABELS: Record<TodayDeadlineTask['status'], string> = {
  completed: '完了',
  pending: '未予定',
  scheduled: '予定済み',
  skipped: 'スキップ',
};

function toTimelineItem(action: TodayPlannedAction, timezone: string, date: string): TimelineItem {
  return {
    startAt: action.startAt,
    endAt: action.endAt,
    end: formatPlanningTime(action.endAt, date, timezone),
    goalTitle: action.goalTitle,
    id: action.id,
    reason: action.reason,
    start: formatPlanningTime(action.startAt, date, timezone),
    status: action.status,
    statusLabel: STATUS_LABELS[action.status],
    taskTitle: action.taskTitle,
    title: action.title,
  };
}

export function toTimelineItems(
  plan: TodayDailyPlan,
  displayTimezone = plan.timezone,
): TimelineItem[] {
  return plan.actions.map((action) => toTimelineItem(action, displayTimezone, plan.date));
}

export function toDeadlineTaskItems(tasks: readonly TodayDeadlineTask[]): DeadlineTaskItem[] {
  return tasks.map((task) => ({
    goalTitle: task.goalTitle,
    id: task.id,
    status: task.status,
    statusLabel: TASK_STATUS_LABELS[task.status],
    title: task.title,
  }));
}

export function formatTodayDateLabel(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return localDate;
  }

  const weekday = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(parsed);

  return `${year}年${month}月${day}日 ${weekday}`;
}
