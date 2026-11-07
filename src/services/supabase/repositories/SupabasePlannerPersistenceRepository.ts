import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PlannerPersistenceRepository,
  SavePlannerProposalInput,
  SavedDailyPlan,
} from '@/features/planner/repositories/PlannerPersistenceRepository';

import { getSupabaseClient } from '../client';
import type { Database, Json } from '../database.types';

type ReplaceDailyPlanResult =
  Database['public']['Functions']['replace_daily_plan']['Returns'][number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toRpcActions(input: SavePlannerProposalInput): Json {
  return input.actions.map((action) => ({
    end_at: action.endAt,
    reason: action.reason,
    start_at: action.startAt,
    task_id: action.taskId,
    title: action.title,
  }));
}

function toSavedDailyPlan(
  row: ReplaceDailyPlanResult,
  input: SavePlannerProposalInput,
): SavedDailyPlan {
  if (
    !UUID_PATTERN.test(row.daily_plan_id) ||
    !Number.isSafeInteger(row.saved_action_count) ||
    row.saved_action_count !== input.actions.length
  ) {
    throw new Error('Unexpected saved Daily Plan data');
  }

  return {
    actionCount: row.saved_action_count,
    id: row.daily_plan_id,
    planDate: input.planDate,
  };
}

export class SupabasePlannerPersistenceRepository implements PlannerPersistenceRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async savePlan(input: SavePlannerProposalInput): Promise<SavedDailyPlan> {
    const { data, error } = await this.client.rpc('replace_daily_plan', {
      p_actions: toRpcActions(input),
      p_planning_window: input.planningWindow ?? null,
      p_plan_date: input.planDate,
      p_summary: input.summary,
      p_timezone: input.timezone,
    });

    if (error) throw error;
    if (!data || data.length !== 1) throw new Error('Daily Plan was not saved');
    return toSavedDailyPlan(data[0], input);
  }
}

export function createSupabasePlannerPersistenceRepository(): PlannerPersistenceRepository {
  return new SupabasePlannerPersistenceRepository(getSupabaseClient());
}
