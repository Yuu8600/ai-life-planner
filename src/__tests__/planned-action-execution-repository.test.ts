import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/services/supabase/database.types';
import { SupabasePlannedActionExecutionRepository } from '@/services/supabase/repositories/SupabasePlannedActionExecutionRepository';

jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const actionId = '11111111-1111-4111-8111-111111111111';

function createRepository(data: unknown, error: unknown = null) {
  const rpc = jest.fn(async () => ({ data, error }));
  const client = { rpc } as unknown as SupabaseClient<Database>;
  return { rpc, repository: new SupabasePlannedActionExecutionRepository(client) };
}

describe('SupabasePlannedActionExecutionRepository', () => {
  it.each(['completed', 'skipped'] as const)(
    'calls only the atomic RPC for %s (no client user id)',
    async (targetStatus) => {
      const { rpc, repository } = createRepository([
        { action_id: actionId, action_status: targetStatus },
      ]);
      await expect(repository.transition({ actionId, targetStatus })).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalledWith('update_planned_action_status', {
        p_action_id: actionId,
        p_target_status: targetStatus,
      });
      expect(rpc).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['42501', 'P0002', '22023', '23514'])(
    'propagates %s errors with no alternative writes',
    async (code) => {
      const failure = { code, message: 'private DB detail' };
      const { rpc, repository } = createRepository(null, failure);
      await expect(repository.transition({ actionId, targetStatus: 'completed' })).rejects.toBe(
        failure,
      );
      expect(rpc).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    null,
    [],
    [{ action_id: actionId, action_status: 'scheduled' }],
    [{ action_id: 'other', action_status: 'completed' }],
  ])('rejects unexpected output %j', async (data) => {
    const { repository } = createRepository(data);
    await expect(repository.transition({ actionId, targetStatus: 'completed' })).rejects.toThrow(
      'Unexpected',
    );
  });

  it('rejects malformed requests before calling RPC', async () => {
    const { rpc, repository } = createRepository(null);
    await expect(
      repository.transition({ actionId: 'not-uuid', targetStatus: 'completed' }),
    ).rejects.toThrow('Invalid');
    await expect(
      repository.transition({ actionId, targetStatus: 'scheduled' as 'completed' }),
    ).rejects.toThrow('Invalid');
    expect(rpc).not.toHaveBeenCalled();
  });
});
