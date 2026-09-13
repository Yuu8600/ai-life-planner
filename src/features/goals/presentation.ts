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

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return '未設定';
  return `${value.toLocaleString('ja-JP')}${unit ?? ''}`;
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '未設定';

  const [year, month, day] = deadline.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function calculateProgress(currentValue: number | null, targetValue: number | null): number | null {
  if (currentValue === null || targetValue === null || targetValue === 0) return null;

  const progress = Math.round((currentValue / targetValue) * 100);
  return Math.min(100, Math.max(0, progress));
}

export function toGoalListItemModel(goal: Goal): GoalListItemModel {
  return {
    currentValueLabel: formatValue(goal.currentValue, goal.unit),
    deadlineLabel: formatDeadline(goal.deadline),
    description: goal.description,
    id: goal.id,
    priority: goal.priority,
    priorityLabel: PRIORITY_LABELS[goal.priority],
    progress: calculateProgress(goal.currentValue, goal.targetValue),
    status: goal.status,
    statusLabel: STATUS_LABELS[goal.status],
    targetValueLabel: formatValue(goal.targetValue, goal.unit),
    title: goal.title,
  };
}
