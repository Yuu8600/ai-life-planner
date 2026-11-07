export type TimelineItemStatus = 'completed' | 'scheduled' | 'skipped';

export type TimelineItem = {
  startAt: string;
  endAt: string;
  end: string;
  goalTitle?: string | null;
  id: string;
  reason: string | null;
  start: string;
  status: TimelineItemStatus;
  statusLabel: string;
  taskTitle?: string | null;
  title: string;
};

export type DeadlineTaskItem = {
  goalTitle: string | null;
  id: string;
  status: 'completed' | 'pending' | 'scheduled' | 'skipped';
  statusLabel: string;
  title: string;
};
