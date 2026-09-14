export type TimelineItemStatus = 'completed' | 'scheduled' | 'skipped';

export type TimelineItem = {
  end: string;
  goalTitle?: string | null;
  id: string;
  start: string;
  status: TimelineItemStatus;
  statusLabel: string;
  taskTitle?: string | null;
  title: string;
};
