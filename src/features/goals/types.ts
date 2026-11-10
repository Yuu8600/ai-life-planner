import type { GoalPriority, GoalStatus } from './repositories/GoalRepository';

export type GoalListItemModel = {
  deadlineLabel: string;
  description: string | null;
  id: string;
  priority: GoalPriority;
  priorityLabel: string;
  status: GoalStatus;
  statusLabel: string;
  title: string;
};
