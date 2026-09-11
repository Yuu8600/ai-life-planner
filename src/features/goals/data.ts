import type { GoalSummary } from './types';

export const GOALS: GoalSummary[] = [
  {
    id: 'goal-toeic',
    title: 'TOEIC',
    currentValue: '530',
    targetValue: '730',
    unit: '点',
    progress: 73,
    deadline: '2026年10月25日',
    priority: 'high',
    priorityLabel: '優先度 高',
  },
  {
    id: 'goal-app',
    title: 'アプリ制作',
    currentValue: '25',
    targetValue: '100',
    unit: '%',
    progress: 25,
    deadline: '2026年12月20日',
    priority: 'medium',
    priorityLabel: '優先度 中',
  },
];
