import type { SupabaseClient } from '@supabase/supabase-js';

import type { CreateGoalInput, GoalRepository } from '@/features/goals/repositories/GoalRepository';
import type { Database } from '@/services/supabase/database.types';
import { SupabaseGoalRepository } from '@/services/supabase/repositories/SupabaseGoalRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

type GoalRow = Database['public']['Tables']['goals']['Row'];

const userId = '11111111-1111-4111-8111-111111111111';
const goalId = '22222222-2222-4222-8222-222222222222';

const goalRow: GoalRow = {
  created_at: '2026-09-12T00:00:00+00:00',
  current_value: 530,
  deadline: '2026-10-25',
  description: '英語学習',
  id: goalId,
  priority: 'high',
  status: 'active',
  target_value: 730,
  title: 'TOEIC',
  unit: '点',
  updated_at: '2026-09-12T00:00:00+00:00',
  user_id: userId,
};

const createInput: CreateGoalInput = {
  currentValue: 530,
  deadline: '2026-10-25',
  description: '英語学習',
  priority: 'high',
  status: 'active',
  targetValue: 730,
  title: 'TOEIC',
  unit: '点',
};

type Builder = {
  delete: jest.Mock;
  eq: jest.Mock;
  insert: jest.Mock;
  maybeSingle: jest.Mock;
  order: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
};

function createBuilder(response: { data: unknown; error: unknown }): Builder {
  const builder = {} as Builder;
  builder.delete = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.insert = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(async () => response);
  builder.order = jest.fn(async () => response);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(async () => response);
  builder.update = jest.fn(() => builder);
  return builder;
}

function createRepository(builder: Builder) {
  const from = jest.fn(() => builder);
  const client = { from } as unknown as SupabaseClient<Database>;
  const repository: GoalRepository = new SupabaseGoalRepository(client, userId);
  return { builder, from, repository };
}

describe('SupabaseGoalRepository', () => {
  it('lists only the signed-in user goals and maps generated database fields', async () => {
    const { builder, from, repository } = createRepository(
      createBuilder({ data: [goalRow], error: null }),
    );

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({
        currentValue: 530,
        id: goalId,
        priority: 'high',
        targetValue: 730,
        title: 'TOEIC',
        userId,
      }),
    ]);
    expect(from).toHaveBeenCalledWith('goals');
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('creates a goal owned by the signed-in user', async () => {
    const { builder, repository } = createRepository(createBuilder({ data: goalRow, error: null }));

    await expect(repository.create(createInput)).resolves.toEqual(
      expect.objectContaining({ id: goalId, userId }),
    );
    expect(builder.insert).toHaveBeenCalledWith({
      current_value: 530,
      deadline: '2026-10-25',
      description: '英語学習',
      priority: 'high',
      status: 'active',
      target_value: 730,
      title: 'TOEIC',
      unit: '点',
      user_id: userId,
    });
  });

  it('updates only a matching goal owned by the signed-in user without changing ownership', async () => {
    const updatedRow = { ...goalRow, title: 'TOEIC 800' };
    const { builder, repository } = createRepository(
      createBuilder({ data: updatedRow, error: null }),
    );

    await expect(repository.update(goalId, { title: 'TOEIC 800' })).resolves.toEqual(
      expect.objectContaining({ title: 'TOEIC 800', userId }),
    );
    expect(builder.update).toHaveBeenCalledWith({ title: 'TOEIC 800' });
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', goalId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', userId);
  });

  it('deletes only a matching goal owned by the signed-in user', async () => {
    const { builder, repository } = createRepository(
      createBuilder({ data: { id: goalId }, error: null }),
    );

    await expect(repository.remove(goalId)).resolves.toBeUndefined();
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', goalId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', userId);
  });

  it('propagates Supabase errors to the feature error boundary', async () => {
    const error = { code: '42501', message: 'row-level security' };
    const { repository } = createRepository(createBuilder({ data: null, error }));

    await expect(repository.list()).rejects.toBe(error);
  });
});
