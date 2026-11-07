import type { CalendarTimelineEvent } from '@/features/calendar';
import { formatLocalDateJa, formatPlanningTime, getUtcDayBounds } from '@/features/today';

import type { PlannerValidationIssue } from './contracts';
import type { PlannerPreviewData } from './plannerPreview';

export type PlannerActionPreviewItem = {
  startAt: string;
  endTime: string;
  id: string;
  reason: string;
  startTime: string;
  timeRange: string;
  title: string;
};

export type PlannerUnscheduledPreviewItem = {
  reason: string;
  taskId: string;
  title: string;
};

export type PlannerPreviewViewModel = {
  calendarEvents: CalendarTimelineEvent[];
  localDate: string;
  timezone: string;
  actions: PlannerActionPreviewItem[];
  summary: string;
  unscheduled: PlannerUnscheduledPreviewItem[];
  warnings: PlannerValidationIssue[];
};

export function formatPlannerDateLabel(localDate: string, timezone: string): string {
  return formatLocalDateJa(getUtcDayBounds(localDate, timezone).startAt, timezone);
}

export function toPlannerPreviewViewModel({
  input,
  proposal,
  timezone,
  warnings,
}: PlannerPreviewData): PlannerPreviewViewModel {
  const taskTitles = new Map(input.tasks.map((task) => [task.id.toLowerCase(), task.title]));

  return {
    localDate: input.date,
    timezone,
    calendarEvents: input.calendarEvents.map((event) =>
      event.kind === 'timed'
        ? { ...event, allDay: false }
        : {
            title: event.title,
            allDay: true,
            startAt: getUtcDayBounds(event.startDate, timezone).startAt,
            endAt: getUtcDayBounds(event.endDate, timezone).startAt,
          },
    ),
    actions: proposal.actions.map((action, index) => {
      const startTime = formatPlanningTime(action.startAt, input.date, timezone);
      const endTime = formatPlanningTime(action.endAt, input.date, timezone);

      return {
        startAt: action.startAt,
        endTime,
        id: action.taskId ?? `free-action-${index}`,
        reason: action.reason,
        startTime,
        timeRange: `${startTime}–${endTime}`,
        title: action.title,
      };
    }),
    summary: proposal.summary,
    unscheduled: proposal.unscheduled.map((task) => ({
      reason: task.reason,
      taskId: task.taskId,
      title: taskTitles.get(task.taskId.toLowerCase()) ?? 'Task情報を取得できません',
    })),
    warnings,
  };
}
