import type { TaskPriority, TaskStatus } from './repositories/TaskRepository';

export type TaskSummary = {
  deadlineLabel: string;
  estimatedMinutes: number;
  goalId: string | null;
  goalTitle: string;
  id: string;
  priority: TaskPriority;
  priorityLabel: string;
  status: TaskStatus;
  statusLabel: string;
  title: string;
};

export type TaskFilter = {
  id: TaskFilterId;
  label: string;
};

export type TaskFilterId = 'all' | 'today' | 'unscheduled';
