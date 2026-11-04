import type { SupabaseClient } from '@supabase/supabase-js';

import type { ActivityLog, ActivityLogRepository } from '@/features/activity';
import { addLocalDays, resolveTimeZone, type LocalDate } from '@/features/today';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isInstant(value: string): boolean {
  if (!INSTANT_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) return false;
  try {
    addLocalDays(value.slice(0, 10), 0);
    return true;
  } catch {
    return false;
  }
}

function readActivityLog(row: ActivityLogRow, userId: string, date: LocalDate): ActivityLog {
  if (
    row.user_id !== userId ||
    !UUID_PATTERN.test(row.id) ||
    (row.planned_action_id !== null && !UUID_PATTERN.test(row.planned_action_id)) ||
    (row.task_id !== null && !UUID_PATTERN.test(row.task_id)) ||
    row.plan_date !== date ||
    !row.action_title.trim() ||
    (row.event_type !== 'planned_action_completed' &&
      row.event_type !== 'planned_action_skipped') ||
    !isInstant(row.occurred_at) ||
    !isInstant(row.scheduled_start_at) ||
    !isInstant(row.scheduled_end_at) ||
    Date.parse(row.scheduled_start_at) >= Date.parse(row.scheduled_end_at)
  ) {
    throw new Error('Unexpected Activity Log data.');
  }
  return {
    actionTitle: row.action_title.trim(),
    eventType: row.event_type,
    id: row.id,
    occurredAt: row.occurred_at,
    planDate: date,
    plannedActionId: row.planned_action_id,
    scheduledEndAt: row.scheduled_end_at,
    scheduledStartAt: row.scheduled_start_at,
    taskId: row.task_id,
    timezone: resolveTimeZone(row.timezone),
  };
}

export class SupabaseActivityLogRepository implements ActivityLogRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async listForPlanDate(date: LocalDate): Promise<ActivityLog[]> {
    const validatedDate = addLocalDays(date, 0);
    const { data, error } = await this.client
      .from('activity_logs')
      .select(
        'id, user_id, event_type, occurred_at, planned_action_id, task_id, plan_date, timezone, action_title, scheduled_start_at, scheduled_end_at',
      )
      .eq('user_id', this.userId)
      .eq('plan_date', validatedDate)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw error;
    // Keep PostgreSQL's microsecond-precision ordering; do not re-sort truncated JS milliseconds.
    return (data ?? []).map((row) => readActivityLog(row, this.userId, validatedDate));
  }
}

export function createSupabaseActivityLogRepository(userId: string): ActivityLogRepository {
  return new SupabaseActivityLogRepository(getSupabaseClient(), userId);
}
