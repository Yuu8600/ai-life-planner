import type { Task, TaskGoalOption } from './repositories/TaskRepository';
import type { TaskFilterId, TaskSummary } from './types';

const PRIORITY_LABELS = {
  high: '優先度 高',
  low: '優先度 低',
  medium: '優先度 中',
} as const;

const STATUS_LABELS = {
  completed: '完了',
  pending: '未予定',
  scheduled: '予定済み',
  skipped: 'スキップ',
} as const;

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '期限なし';

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return '期限を確認してください';

  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

export function toTaskSummary(task: Task, goalOptions: readonly TaskGoalOption[]): TaskSummary {
  const goalTitle = task.goalId
    ? (goalOptions.find((goal) => goal.id === task.goalId)?.title ?? 'Goal情報を取得できません')
    : 'Goalなし';

  return {
    deadlineLabel: task.localDeadline ?? formatDeadline(task.deadline),
    estimatedMinutes: task.estimatedMinutes,
    goalId: task.goalId,
    goalTitle,
    id: task.id,
    priority: task.priority,
    priorityLabel: PRIORITY_LABELS[task.priority],
    status: task.status,
    statusLabel: STATUS_LABELS[task.status],
    title: task.title,
  };
}

function toLocalDateKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function matchesTaskFilter(
  task: Task,
  filter: TaskFilterId,
  now: Date = new Date(),
): boolean {
  if (filter === 'today') {
    if (!task.deadline) return false;

    return toLocalDateKey(new Date(task.deadline)) === toLocalDateKey(now);
  }

  if (filter === 'unscheduled') return task.status === 'pending';
  return true;
}
