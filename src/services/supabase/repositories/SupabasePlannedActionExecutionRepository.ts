import type { SupabaseClient } from '@supabase/supabase-js';

import type { ExecutePlannedActionInput, PlannedActionExecutionRepository } from '@/features/today';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabasePlannedActionExecutionRepository implements PlannedActionExecutionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async transition({ actionId, targetStatus }: ExecutePlannedActionInput): Promise<void> {
    if (
      !UUID_PATTERN.test(actionId) ||
      (targetStatus !== 'completed' && targetStatus !== 'skipped')
    ) {
      throw new Error('Invalid Action execution request.');
    }

    const { data, error } = await this.client.rpc('update_planned_action_status', {
      p_action_id: actionId,
      p_target_status: targetStatus,
    });

    if (error) throw error;
    if (
      !data ||
      data.length !== 1 ||
      data[0].action_id !== actionId ||
      data[0].action_status !== targetStatus
    ) {
      throw new Error('Unexpected Action execution result.');
    }
  }
}

export function createSupabasePlannedActionExecutionRepository(): PlannedActionExecutionRepository {
  return new SupabasePlannedActionExecutionRepository(getSupabaseClient());
}
