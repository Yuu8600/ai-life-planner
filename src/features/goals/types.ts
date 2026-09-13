import type { GoalPriority, GoalStatus } from './repositories/GoalRepository';

export type GoalListItemModel = {
  currentValueLabel: string;
  deadlineLabel: string;
  description: string | null;
  id: string;
  priority: GoalPriority;
  priorityLabel: string;
  progress: number | null;
  status: GoalStatus;
  statusLabel: string;
  targetValueLabel: string;
  title: string;
};
