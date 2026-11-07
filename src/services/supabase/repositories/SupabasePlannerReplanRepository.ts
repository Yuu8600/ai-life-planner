import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PlannerReplanConflictError,
  type PlannerPlanSnapshot,
  type PlannerReplanRepository,
  type SavePlannerProposalInput,
  type SavedDailyPlan,
} from '@/features/planner';
import { addLocalDays, resolveTimeZone, type LocalDate } from '@/features/today';

import { getSupabaseClient } from '../client';
import type { Database, Json } from '../database.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && /Z$/.test(value) && Number.isFinite(Date.parse(value));

function readSnapshot(value: unknown, date: LocalDate): PlannerPlanSnapshot | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !UUID.test(value.id) ||
    value.planDate !== date ||
    typeof value.timezone !== 'string' ||
    (value.summary !== null && typeof value.summary !== 'string') ||
    !isInstant(value.updatedAt) ||
    !Array.isArray(value.actions)
  )
    throw new Error('Invalid Replan snapshot.');
  resolveTimeZone(value.timezone);
  const actions = value.actions.map((action: unknown): PlannerPlanSnapshot['actions'][number] => {
    if (
      !isRecord(action) ||
      typeof action.id !== 'string' ||
      !UUID.test(action.id) ||
      !isInstant(action.updatedAt) ||
      (action.status !== 'scheduled' &&
        action.status !== 'completed' &&
        action.status !== 'skipped')
    )
      throw new Error('Invalid Replan Action snapshot.');
    return { id: action.id, status: action.status, updatedAt: action.updatedAt };
  });
  if (new Set(actions.map((action) => action.id.toLowerCase())).size !== actions.length)
    throw new Error('Duplicate Replan Action snapshot.');
  return {
    id: value.id,
    planDate: date,
    summary: value.summary,
    timezone: value.timezone,
    updatedAt: value.updatedAt,
    actions,
  };
}

export class SupabasePlannerReplanRepository implements PlannerReplanRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getSnapshot(date: LocalDate): Promise<PlannerPlanSnapshot | null> {
    addLocalDays(date, 0);
    const { data, error } = await this.client.rpc('get_daily_plan_snapshot', { p_plan_date: date });
    if (error) throw error;
    return readSnapshot(data, date);
  }

  async replaceIfCurrent(
    input: SavePlannerProposalInput,
    expected: PlannerPlanSnapshot,
  ): Promise<SavedDailyPlan> {
    const actions: Json = input.actions.map((action) => ({
      end_at: action.endAt,
      start_at: action.startAt,
      reason: action.reason,
      title: action.title,
      task_id: action.taskId,
    }));
    const snapshot: Json = {
      ...expected,
      actions: expected.actions.map((action) => ({ ...action })),
    };
    const { data, error } = await this.client.rpc('replace_daily_plan_if_current', {
      p_actions: actions,
      p_planning_window: input.planningWindow ?? null,
      p_expected_snapshot: snapshot,
      p_plan_date: input.planDate,
      p_summary: input.summary,
      p_timezone: input.timezone,
    });
    if (error?.code === 'P5C01') throw new PlannerReplanConflictError();
    if (error) throw error;
    if (
      !data ||
      data.length !== 1 ||
      !UUID.test(data[0].daily_plan_id) ||
      data[0].daily_plan_id !== expected.id ||
      data[0].saved_action_count !== input.actions.length
    )
      throw new Error('Invalid guarded save result.');
    return {
      id: data[0].daily_plan_id,
      actionCount: data[0].saved_action_count,
      planDate: input.planDate,
    };
  }
}

export function createSupabasePlannerReplanRepository(): PlannerReplanRepository {
  return new SupabasePlannerReplanRepository(getSupabaseClient());
}
