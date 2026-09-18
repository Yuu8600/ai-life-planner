import type { SupabaseClient } from '@supabase/supabase-js';

import type { SavePlannerProposalInput } from '@/features/planner';
import type { Database } from '@/services/supabase/database.types';
import { SupabasePlannerPersistenceRepository } from '@/services/supabase/repositories/SupabasePlannerPersistenceRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const dailyPlanId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const input: SavePlannerProposalInput = {
  actions: [
    {
      endAt: '2026-09-18T00:30:00.000Z',
      reason: '優先度が高いため',
      startAt: '2026-09-18T00:00:00.000Z',
      taskId,
      title: '保存対象Task',
    },
  ],
  planDate: '2026-09-18',
  summary: '1件を予定に配置しました。',
  timezone: 'Asia/Tokyo',
};

function createRepository(response: { data: unknown; error: unknown }) {
  const rpc = jest.fn(async () => response);
  const client = { rpc } as unknown as SupabaseClient<Database>;
  return { repository: new SupabasePlannerPersistenceRepository(client), rpc };
}

describe('SupabasePlannerPersistenceRepository', () => {
  it('calls the atomic replace RPC with snake-case action fields', async () => {
    const { repository, rpc } = createRepository({
      data: [{ daily_plan_id: dailyPlanId, saved_action_count: 1 }],
      error: null,
    });

    await expect(repository.savePlan(input)).resolves.toEqual({
      actionCount: 1,
      id: dailyPlanId,
      planDate: '2026-09-18',
    });
    expect(rpc).toHaveBeenCalledWith('replace_daily_plan', {
      p_actions: [
        {
          end_at: '2026-09-18T00:30:00.000Z',
          reason: '優先度が高いため',
          start_at: '2026-09-18T00:00:00.000Z',
          task_id: taskId,
          title: '保存対象Task',
        },
      ],
      p_plan_date: '2026-09-18',
      p_summary: '1件を予定に配置しました。',
      p_timezone: 'Asia/Tokyo',
    });
  });

  it('supports zero actions and propagates an RPC failure without a fallback write', async () => {
    const emptyInput = { ...input, actions: [] };
    const success = createRepository({
      data: [{ daily_plan_id: dailyPlanId, saved_action_count: 0 }],
      error: null,
    });
    await expect(success.repository.savePlan(emptyInput)).resolves.toEqual(
      expect.objectContaining({ actionCount: 0 }),
    );

    const failure = { code: '23503', message: 'foreign key violation' };
    const failed = createRepository({ data: null, error: failure });
    await expect(failed.repository.savePlan(input)).rejects.toBe(failure);
    expect(failed.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects an unexpected RPC result', async () => {
    const { repository } = createRepository({ data: [], error: null });
    await expect(repository.savePlan(input)).rejects.toThrow('Daily Plan was not saved');
  });
});
