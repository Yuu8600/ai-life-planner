export type TimelineItemKind = 'calendar' | 'planned';
export type TimelineItemStatus = 'completed' | 'fixed' | 'scheduled';

export type TimelineItem = {
  end: string;
  id: string;
  kind: TimelineItemKind;
  start: string;
  status: TimelineItemStatus;
  statusLabel: string;
  title: string;
};

export type TodayPlan = {
  completedActions: number;
  dateLabel: string;
  greeting: string;
  summary: string;
  totalActions: number;
};
