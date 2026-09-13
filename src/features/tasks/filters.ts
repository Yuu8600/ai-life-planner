import type { TaskFilter } from './types';

export const TASK_FILTERS: readonly TaskFilter[] = [
  { id: 'all', label: 'すべて' },
  { id: 'today', label: '今日が期限' },
  { id: 'unscheduled', label: '未予定' },
];
