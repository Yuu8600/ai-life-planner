export type TaskStatus = 'completed' | 'scheduled' | 'unscheduled';

export type TaskSummary = {
  estimatedMinutes: number;
  goalTitle: string;
  id: string;
  status: TaskStatus;
  statusLabel: string;
  title: string;
};

export type TaskFilter = {
  id: 'all' | 'today' | 'unscheduled';
  label: string;
};
