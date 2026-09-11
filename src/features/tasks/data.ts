import type { TaskFilter, TaskSummary } from './types';

export const TASK_FILTERS: TaskFilter[] = [
  { id: 'all', label: 'すべて' },
  { id: 'today', label: '今日' },
  { id: 'unscheduled', label: '未予定' },
];

export const TASKS: TaskSummary[] = [
  {
    id: 'task-words',
    title: '金フレ',
    goalTitle: 'TOEIC',
    estimatedMinutes: 20,
    status: 'completed',
    statusLabel: '完了',
  },
  {
    id: 'task-listening',
    title: 'TOEIC Listening',
    goalTitle: 'TOEIC',
    estimatedMinutes: 30,
    status: 'scheduled',
    statusLabel: '今日',
  },
  {
    id: 'task-part5',
    title: 'Part 5',
    goalTitle: 'TOEIC',
    estimatedMinutes: 30,
    status: 'scheduled',
    statusLabel: '今日',
  },
  {
    id: 'task-design',
    title: '画面仕様を整理する',
    goalTitle: 'アプリ制作',
    estimatedMinutes: 45,
    status: 'unscheduled',
    statusLabel: '未予定',
  },
];
