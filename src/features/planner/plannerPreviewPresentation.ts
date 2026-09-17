import { formatLocalDateJa, formatLocalTimeJa, getUtcDayBounds } from '@/features/today';

import type { PlannerValidationIssue } from './contracts';
import type { PlannerPreviewData } from './plannerPreview';

export type PlannerActionPreviewItem = {
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
    actions: proposal.actions.map((action, index) => {
      const startTime = formatLocalTimeJa(action.startAt, timezone);
      const endTime = formatLocalTimeJa(action.endAt, timezone);

      return {
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
