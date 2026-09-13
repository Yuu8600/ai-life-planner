import type { SupabaseClient } from '@supabase/supabase-js';

import type { CreateTaskInput, TaskRepository } from '@/features/tasks/repositories/TaskRepository';
import type { Database } from '@/services/supabase/database.types';
import { SupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

type TaskRow = Database['public']['Tables']['tasks']['Row'];

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const taskId = '33333333-3333-4333-8333-333333333333';
const goalId = '22222222-2222-4222-8222-222222222222';

const taskRow: TaskRow = {
  created_at: '2026-09-13T00:00:00+00:00',
  deadline: '2026-10-25T14:59:59.999Z',
  estimated_minutes: 30,
  goal_id: goalId,
  id: taskId,
  priority: 'high',
  status: 'scheduled',
  title: 'TOEIC Listening',
  updated_at: '2026-09-13T00:00:00+00:00',
  user_id: userId,
};

const createInput: CreateTaskInput = {
  deadline: taskRow.deadline,
  estimatedMinutes: 30,
  goalId,
  priority: 'high',
  status: 'scheduled',
  title: 'TOEIC Listening',
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
  const repository: TaskRepository = new SupabaseTaskRepository(client, userId);
  return { builder, from, repository };
}

describe('SupabaseTaskRepository', () => {
  it('lists only the signed-in user tasks and maps generated database fields', async () => {
    const { builder, from, repository } = createRepository(
      createBuilder({ data: [taskRow], error: null }),
    );

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({
        estimatedMinutes: 30,
        goalId,
        id: taskId,
        status: 'scheduled',
        userId,
      }),
    ]);
    expect(from).toHaveBeenCalledWith('tasks');
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId);
  });

  it('loads only the signed-in user Goals as association options', async () => {
    const { builder, from, repository } = createRepository(
      createBuilder({ data: [{ id: goalId, title: ' TOEIC ' }], error: null }),
    );

    await expect(repository.listGoalOptions()).resolves.toEqual([{ id: goalId, title: 'TOEIC' }]);
    expect(from).toHaveBeenCalledWith('goals');
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId);
  });

  it.each([
    ['Goalなし', null],
    ['自分のGoal', goalId],
  ])('creates a %s task owned by the signed-in user', async (_label, selectedGoalId) => {
    const row = { ...taskRow, goal_id: selectedGoalId };
    const { builder, repository } = createRepository(createBuilder({ data: row, error: null }));

    await repository.create({ ...createInput, goalId: selectedGoalId });

    expect(builder.insert).toHaveBeenCalledWith({
      deadline: createInput.deadline,
      estimated_minutes: 30,
      goal_id: selectedGoalId,
      priority: 'high',
      status: 'scheduled',
      title: 'TOEIC Listening',
      user_id: userId,
    });
  });

  it('updates only an owned task and never writes user_id', async () => {
    const updatedRow = { ...taskRow, title: 'Part 5' };
    const { builder, repository } = createRepository(
      createBuilder({ data: updatedRow, error: null }),
    );

    await expect(repository.update(taskId, { title: 'Part 5' })).resolves.toEqual(
      expect.objectContaining({ title: 'Part 5', userId }),
    );
    expect(builder.update).toHaveBeenCalledWith({ title: 'Part 5' });
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', taskId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', userId);
  });

  it('deletes only an owned task', async () => {
    const { builder, repository } = createRepository(
      createBuilder({ data: { id: taskId }, error: null }),
    );

    await expect(repository.remove(taskId)).resolves.toBeUndefined();
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', taskId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', userId);
  });

  it('rejects an out-of-scope row even if a malformed backend response contains it', async () => {
    const { repository } = createRepository(
      createBuilder({ data: [{ ...taskRow, user_id: otherUserId }], error: null }),
    );

    await expect(repository.list()).rejects.toThrow('Unexpected task data');
  });

  it('propagates the composite FK rejection for another user Goal', async () => {
    const foreignKeyError = { code: '23503', message: 'foreign key violation' };
    const { repository } = createRepository(createBuilder({ data: null, error: foreignKeyError }));

    await expect(repository.create(createInput)).rejects.toBe(foreignKeyError);
  });

  it('maps goal_id to null after the linked Goal is deleted', async () => {
    const { repository } = createRepository(
      createBuilder({ data: [{ ...taskRow, goal_id: null }], error: null }),
    );

    await expect(repository.list()).resolves.toEqual([expect.objectContaining({ goalId: null })]);
  });
});
