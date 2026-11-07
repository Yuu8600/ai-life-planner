import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PlannerReplanConflictError,
  type PlannerPlanSnapshot,
  type SavePlannerProposalInput,
} from '@/features/planner';
import type { Database } from '@/services/supabase/database.types';
import { SupabasePlannerReplanRepository } from '@/services/supabase/repositories/SupabasePlannerReplanRepository';

jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const snapshot: PlannerPlanSnapshot = {
  id: '11111111-1111-4111-8111-111111111111',
  planDate: '2026-11-05',
  summary: 'Existing',
  timezone: 'Asia/Tokyo',
  updatedAt: '2026-11-04T21:00:00.123456Z',
  actions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'scheduled',
      updatedAt: '2026-11-04T21:00:00.987654Z',
    },
  ],
};
const input: SavePlannerProposalInput = {
  planDate: snapshot.planDate,
  summary: 'New',
  timezone: snapshot.timezone,
  actions: [
    {
      taskId: null,
      title: 'New',
      reason: 'Fixture',
      startAt: '2026-11-05T00:00:00Z',
      endAt: '2026-11-05T00:30:00Z',
    },
  ],
};
function repository(data: unknown, error: unknown = null) {
  const rpc = jest.fn(async () => ({ data, error }));
  return {
    rpc,
    repository: new SupabasePlannerReplanRepository({ rpc } as unknown as SupabaseClient<Database>),
  };
}

describe('SupabasePlannerReplanRepository', () => {
  it('reads the owned snapshot through one typed RPC, preserving microsecond tokens', async () => {
    const test = repository(snapshot);
    expect(await test.repository.getSnapshot(snapshot.planDate)).toEqual(snapshot);
    expect(test.rpc).toHaveBeenCalledWith('get_daily_plan_snapshot', {
      p_plan_date: snapshot.planDate,
    });
  });
  it('represents a missing Plan separately and propagates read errors', async () => {
    expect(await repository(null).repository.getSnapshot(snapshot.planDate)).toBeNull();
    const error = new Error('offline');
    await expect(repository(null, error).repository.getSnapshot(snapshot.planDate)).rejects.toBe(
      error,
    );
  });
  it.each([
    {},
    { ...snapshot, planDate: '2026-11-06' },
    { ...snapshot, timezone: 'Invalid/Zone' },
    { ...snapshot, actions: [{ ...snapshot.actions[0], status: 'pending' }] },
    { ...snapshot, actions: [snapshot.actions[0], snapshot.actions[0]] },
  ])('rejects a malformed snapshot %j', async (data) => {
    await expect(repository(data).repository.getSnapshot(snapshot.planDate)).rejects.toThrow();
  });
  it('uses guarded RPC only, carrying the original token and nullable Task references', async () => {
    const test = repository([{ daily_plan_id: snapshot.id, saved_action_count: 1 }]);
    expect(await test.repository.replaceIfCurrent(input, snapshot)).toEqual({
      id: snapshot.id,
      actionCount: 1,
      planDate: snapshot.planDate,
    });
    expect(test.rpc).toHaveBeenCalledWith('replace_daily_plan_if_current', {
      p_planning_window: null,
      p_plan_date: input.planDate,
      p_timezone: input.timezone,
      p_summary: input.summary,
      p_expected_snapshot: snapshot,
      p_actions: [
        {
          task_id: null,
          title: 'New',
          reason: 'Fixture',
          start_at: input.actions[0].startAt,
          end_at: input.actions[0].endAt,
        },
      ],
    });
    expect(test.rpc).toHaveBeenCalledTimes(1);
  });
  it('maps the dedicated stale SQLSTATE, but leaves ordinary failures separate without fallback', async () => {
    const stale = repository(null, { code: 'P5C01', message: 'opaque' });
    await expect(stale.repository.replaceIfCurrent(input, snapshot)).rejects.toBeInstanceOf(
      PlannerReplanConflictError,
    );
    expect(stale.rpc).toHaveBeenCalledTimes(1);
    const network = { code: 'NETWORK' };
    await expect(
      repository(null, network).repository.replaceIfCurrent(input, snapshot),
    ).rejects.toBe(network);
  });
  it('rejects a malformed or mismatched successful save result', async () => {
    await expect(
      repository([
        { daily_plan_id: snapshot.id, saved_action_count: 0 },
      ]).repository.replaceIfCurrent(input, snapshot),
    ).rejects.toThrow();
  });
});
