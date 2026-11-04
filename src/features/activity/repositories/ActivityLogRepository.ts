import type { LocalDate } from '@/features/today';

export type ActivityEventType = 'planned_action_completed' | 'planned_action_skipped';

export type ActivityLog = {
  actionTitle: string;
  eventType: ActivityEventType;
  id: string;
  occurredAt: string;
  planDate: LocalDate;
  plannedActionId: string | null;
  scheduledEndAt: string;
  scheduledStartAt: string;
  taskId: string | null;
  timezone: string;
};

/** Owned, read-only snapshots ordered by occurredAt DESC, id DESC. */
export interface ActivityLogRepository {
  listForPlanDate(date: LocalDate): Promise<ActivityLog[]>;
}
