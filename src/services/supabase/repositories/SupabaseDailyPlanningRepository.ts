import { addLocalDays, getLocalDate } from '@/features/today';
import {
  PlanConflictError,
  type DailyPlanningRepository,
  type LocalEvent,
  type SavedPlan,
} from '@/features/planner/v2/repository';
import type { DailyPlan, PlanningTask, Recurrence } from '@/features/planner/v2/types';
import { getSupabaseClient } from '../client';
import type { Database, Json } from '../database.types';
import { createSupabaseSettingsRepository } from './SupabaseSettingsRepository';

type PlanRow = Database['public']['Tables']['v2_plans']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];

function readPlan(row: PlanRow): SavedPlan {
  const body = row.state as Partial<DailyPlan>;
  if (
    body.date !== row.plan_date ||
    !body.window ||
    !Array.isArray(body.sessions) ||
    !Array.isArray(body.lifestyle) ||
    !Array.isArray(body.leisure) ||
    !Array.isArray(body.warnings) ||
    !Array.isArray(body.unplaced)
  ) {
    throw new Error('保存済み計画の形式を読み取れません。');
  }
  return { revision: row.revision, plan: body as DailyPlan };
}

function toTask(row: TaskRow, timezone: string): PlanningTask {
  if (
    !['once', 'daily', 'weekdays', 'weekly'].includes(row.recurrence) ||
    (row.priority !== 'high' && row.priority !== 'medium' && row.priority !== 'low')
  ) {
    throw new Error('タスクの形式を読み取れません。');
  }
  return {
    id: row.id,
    title: row.title,
    goalId: row.goal_id,
    priority: row.priority,
    deadline: row.deadline_local ?? (row.deadline ? getLocalDate(row.deadline, timezone) : null),
    duration: row.estimated_minutes,
    completed: row.status === 'completed',
    recurrence: row.recurrence as Recurrence,
    weekdays: row.recurrence_days,
    createdAt: row.created_at,
  };
}

export function createSupabaseDailyPlanningRepository(userId: string): DailyPlanningRepository {
  const client = getSupabaseClient();
  const settingsRepository = createSupabaseSettingsRepository(userId);
  async function source(date: string) {
    const result = await client.rpc('v2_plan_source', { p_date: date });
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    getSettings: () => settingsRepository.getProfilePlanningSettings(),
    async load(date) {
      const before = await source(date);
      const [settings, profile, tasks, events, plans] = await Promise.all([
        settingsRepository.getProfilePlanningSettings(),
        client.from('profiles').select('v2_task_gap_minutes').eq('id', userId).single(),
        client.from('tasks').select('*').eq('user_id', userId).order('id'),
        client
          .from('v2_events')
          .select('*')
          .eq('user_id', userId)
          .gte('plan_date', addLocalDays(date, -2))
          .lte('plan_date', addLocalDays(date, 2))
          .order('id'),
        client
          .from('v2_plans')
          .select('*')
          .eq('user_id', userId)
          .gte('plan_date', addLocalDays(date, -90))
          .lte('plan_date', addLocalDays(date, 6))
          .order('plan_date'),
      ]);
      if (profile.error) throw profile.error;
      if (tasks.error) throw tasks.error;
      if (events.error) throw events.error;
      if (plans.error) throw plans.error;
      const after = await source(date);
      if (before !== after || !after) throw new PlanConflictError();
      const history = plans.data.map(readPlan);
      return {
        source: after,
        settings,
        gap: profile.data.v2_task_gap_minutes,
        saved: history.find(({ plan }) => plan.date === date) ?? null,
        history: history.map(({ plan }) => plan),
        tasks: tasks.data.map((row) => toTask(row, settings.timezone)),
        events: events.data
          .filter((row) => row.kind === 'fixed' || row.plan_date === date)
          .map((row): LocalEvent => {
            const item = { id: row.id, title: row.title, startAt: row.start_at, endAt: row.end_at };
            return row.kind === 'flexible' && row.duration_minutes !== null
              ? { ...item, kind: 'flexible', duration: row.duration_minutes }
              : { ...item, kind: 'fixed', before: row.travel_before, after: row.travel_after };
          }),
      };
    },
    async save(date, revision, expected, plan) {
      // Generated PostgREST types don't model nullable function arguments.
      const args = {
        p_date: date,
        p_expected_revision: revision,
        p_source: expected,
        p_state: plan as Json,
      };
      const { error } = await client.rpc(
        'v2_save_plan',
        args as Database['public']['Functions']['v2_save_plan']['Args'],
      );
      if (error?.code === '40001') throw new PlanConflictError();
      if (error) throw error;
    },
    async addEvent(date, event) {
      const { error } = await client.from('v2_events').insert({
        user_id: userId,
        plan_date: date,
        kind: event.kind,
        title: event.title,
        start_at: event.startAt,
        end_at: event.endAt,
        duration_minutes: event.kind === 'flexible' ? event.duration : null,
        travel_before: event.kind === 'fixed' ? event.before : 0,
        travel_after: event.kind === 'fixed' ? event.after : 0,
      });
      if (error) throw error;
    },
    async removeEvent(id) {
      const { error } = await client.from('v2_events').delete().eq('user_id', userId).eq('id', id);
      if (error) throw error;
    },
    async getGap() {
      const { data, error } = await client
        .from('profiles')
        .select('v2_task_gap_minutes')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data.v2_task_gap_minutes;
    },
    async setGap(value) {
      const { error } = await client
        .from('profiles')
        .update({ v2_task_gap_minutes: value })
        .eq('id', userId);
      if (error) throw error;
    },
  };
}
