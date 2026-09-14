import type {
  PlannedActionStatus,
  TodayPlannedAction,
  TodayProjection,
} from './repositories/TodayRepository';
import type { TimelineItem } from './types';

const STATUS_LABELS: Record<PlannedActionStatus, string> = {
  completed: '完了',
  scheduled: '予定',
  skipped: 'スキップ',
};

function formatTime(isoDate: string, timezone: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '--:--';

  try {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone: timezone,
    }).format(parsed);
  } catch {
    return '--:--';
  }
}

function toTimelineItem(action: TodayPlannedAction, timezone: string): TimelineItem {
  return {
    end: formatTime(action.endAt, timezone),
    goalTitle: action.goalTitle,
    id: action.id,
    start: formatTime(action.startAt, timezone),
    status: action.status,
    statusLabel: STATUS_LABELS[action.status],
    taskTitle: action.taskTitle,
    title: action.title,
  };
}

export function toTimelineItems(today: TodayProjection): TimelineItem[] {
  return today.actions.map((action) => toTimelineItem(action, today.timezone));
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
