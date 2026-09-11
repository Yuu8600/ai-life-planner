import type { TimelineItem, TodayPlan } from './types';

export const TODAY_PLAN: TodayPlan = {
  completedActions: 1,
  dateLabel: '2026年9月11日 金曜日',
  greeting: 'おはようございます',
  summary: '大学の前後に短い学習時間を確保し、TOEICの3タスクを無理なく進めます。',
  totalActions: 3,
};

export const TODAY_TIMELINE: TimelineItem[] = [
  {
    id: 'action-words',
    start: '08:30',
    end: '08:50',
    title: '金フレ',
    kind: 'planned',
    status: 'completed',
    statusLabel: '完了',
  },
  {
    id: 'event-university',
    start: '10:00',
    end: '16:00',
    title: '大学',
    kind: 'calendar',
    status: 'fixed',
    statusLabel: '固定予定',
  },
  {
    id: 'action-listening',
    start: '16:30',
    end: '17:00',
    title: 'TOEIC Listening',
    kind: 'planned',
    status: 'scheduled',
    statusLabel: '予定',
  },
  {
    id: 'action-part5',
    start: '18:00',
    end: '18:30',
    title: 'Part 5',
    kind: 'planned',
    status: 'scheduled',
    statusLabel: '予定',
  },
];
