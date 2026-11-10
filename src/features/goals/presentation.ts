import type { Goal } from './repositories/GoalRepository';
import type { GoalListItemModel } from './types';

const PRIORITY_LABELS = {
  high: '優先度 高',
  low: '優先度 低',
  medium: '優先度 中',
} as const;

const STATUS_LABELS = {
  active: '進行中',
  archived: 'アーカイブ',
  completed: '完了',
} as const;

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '未設定';

  const [year, month, day] = deadline.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

export function toGoalListItemModel(goal: Goal): GoalListItemModel {
  return {
    deadlineLabel: formatDeadline(goal.deadline),
    description: goal.description,
    id: goal.id,
    priority: goal.priority,
    priorityLabel: PRIORITY_LABELS[goal.priority],
    status: goal.status,
    statusLabel: STATUS_LABELS[goal.status],
    title: goal.title,
  };
}
