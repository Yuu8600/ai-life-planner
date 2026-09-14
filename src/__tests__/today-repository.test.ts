import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/services/supabase/database.types';
import { SupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const dailyPlanId = '22222222-2222-4222-8222-222222222222';
const actionId = '33333333-3333-4333-8333-333333333333';
const taskId = '44444444-4444-4444-8444-444444444444';
const goalId = '55555555-5555-4555-8555-555555555555';
const now = () => new Date('2026-09-13T15:30:00.000Z');

type QueryResponse = { data: unknown; error: unknown };

type TestBuilder = {
  eq: jest.Mock;
  gte: jest.Mock;
  in: jest.Mock;
  lt: jest.Mock;
  maybeSingle: jest.Mock;
  order: jest.Mock;
  select: jest.Mock;
};

type Responses = {
  actions?: QueryResponse;
  dailyPlan?: QueryResponse;
  goals?: QueryResponse;
  profile?: QueryResponse;
  tasks?: QueryResponse;
};

function createChainBuilder(): TestBuilder {
  const builder = {} as TestBuilder;
  builder.eq = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.lt = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  return builder;
}

function createRepository(responses: Responses = {}) {
  const profile = createChainBuilder();
  profile.maybeSingle = jest.fn(
    async () => responses.profile ?? { data: { timezone: 'Asia/Tokyo' }, error: null },
  );

  const dailyPlan = createChainBuilder();
  dailyPlan.maybeSingle = jest.fn(async () => responses.dailyPlan ?? { data: null, error: null });

  const actions = createChainBuilder();
  actions.order = jest.fn(async () => responses.actions ?? { data: [], error: null });

  const tasks = createChainBuilder();
  tasks.in = jest.fn(async () => responses.tasks ?? { data: [], error: null });

  const goals = createChainBuilder();
  goals.in = jest.fn(async () => responses.goals ?? { data: [], error: null });

  const builders: Record<string, TestBuilder> = {
    daily_plans: dailyPlan,
    goals,
    planned_actions: actions,
    profiles: profile,
    tasks,
  };
  const from = jest.fn((table: string) => builders[table]);
  const client = { from } as unknown as SupabaseClient<Database>;

  return {
    actions,
    dailyPlan,
    from,
    goals,
    profile,
    repository: new SupabaseTodayRepository(client, userId, now),
    tasks,
  };
}

const planRow = {
  id: dailyPlanId,
  plan_date: '2026-09-14',
  summary: '英語学習を進めます。',
  user_id: userId,
};

const actionRow = {
  daily_plan_id: dailyPlanId,
  end_at: '2026-09-13T23:30:00.000Z',
  id: actionId,
  start_at: '2026-09-13T23:00:00.000Z',
  status: 'scheduled',
  task_id: taskId,
  title: 'TOEIC Listening',
  user_id: userId,
};

describe('SupabaseTodayRepository', () => {
  it('returns an empty local-day projection when no Daily Plan exists', async () => {
    const { actions, dailyPlan, from, repository } = createRepository();

    await expect(repository.getToday()).resolves.toEqual({
      actions: [],
      greeting: 'こんばんは',
      localDate: '2026-09-14',
      summary: null,
      timezone: 'Asia/Tokyo',
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(from).toHaveBeenCalledWith('daily_plans');
    expect(dailyPlan.eq).toHaveBeenCalledWith('user_id', userId);
    expect(dailyPlan.eq).toHaveBeenCalledWith('plan_date', '2026-09-14');
    expect(actions.order).not.toHaveBeenCalled();
  });

  it('loads only the signed-in user local-day actions and maps Task and Goal details', async () => {
    const { actions, dailyPlan, goals, repository, tasks } = createRepository({
      actions: { data: [actionRow], error: null },
      dailyPlan: { data: planRow, error: null },
      goals: { data: [{ id: goalId, title: ' TOEIC 730 ', user_id: userId }], error: null },
      tasks: {
        data: [{ goal_id: goalId, id: taskId, title: ' Listening練習 ', user_id: userId }],
        error: null,
      },
    });

    await expect(repository.getToday()).resolves.toEqual({
      actions: [
        {
          endAt: '2026-09-13T23:30:00.000Z',
          goalTitle: 'TOEIC 730',
          id: actionId,
          startAt: '2026-09-13T23:00:00.000Z',
          status: 'scheduled',
          taskId,
          taskTitle: 'Listening練習',
          title: 'TOEIC Listening',
        },
      ],
      greeting: 'こんばんは',
      localDate: '2026-09-14',
      summary: '英語学習を進めます。',
      timezone: 'Asia/Tokyo',
    });
    expect(dailyPlan.eq).toHaveBeenCalledWith('user_id', userId);
    expect(actions.eq).toHaveBeenCalledWith('user_id', userId);
    expect(actions.eq).toHaveBeenCalledWith('daily_plan_id', dailyPlanId);
    expect(actions.gte).toHaveBeenCalledWith('start_at', '2026-09-13T15:00:00.000Z');
    expect(actions.lt).toHaveBeenCalledWith('start_at', '2026-09-14T15:00:00.000Z');
    expect(actions.order).toHaveBeenCalledWith('start_at', { ascending: true });
    expect(tasks.eq).toHaveBeenCalledWith('user_id', userId);
    expect(tasks.in).toHaveBeenCalledWith('id', [taskId]);
    expect(goals.eq).toHaveBeenCalledWith('user_id', userId);
    expect(goals.in).toHaveBeenCalledWith('id', [goalId]);
  });

  it('keeps the action title readable after its Task is deleted and task_id becomes null', async () => {
    const { from, repository } = createRepository({
      actions: {
        data: [{ ...actionRow, task_id: null, title: '削除済みTaskの予定' }],
        error: null,
      },
      dailyPlan: { data: planRow, error: null },
    });

    await expect(repository.getToday()).resolves.toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            goalTitle: null,
            taskId: null,
            taskTitle: null,
            title: '削除済みTaskの予定',
          }),
        ],
      }),
    );
    expect(from).not.toHaveBeenCalledWith('tasks');
    expect(from).not.toHaveBeenCalledWith('goals');
  });

  it.each([
    ['yesterday', '2026-09-13T14:59:59.999Z'],
    ['tomorrow boundary', '2026-09-14T15:00:00.000Z'],
  ])('rejects an out-of-range %s row returned by a malformed backend', async (_label, startAt) => {
    const { repository } = createRepository({
      actions: { data: [{ ...actionRow, start_at: startAt }], error: null },
      dailyPlan: { data: planRow, error: null },
    });

    await expect(repository.getToday()).rejects.toThrow('Unexpected planned action data');
  });

  it('rejects another user action even if a malformed backend returns it', async () => {
    const { repository } = createRepository({
      actions: { data: [{ ...actionRow, user_id: otherUserId }], error: null },
      dailyPlan: { data: planRow, error: null },
    });

    await expect(repository.getToday()).rejects.toThrow('Unexpected planned action data');
  });

  it('fails safely when the profile timezone is invalid without falling back', async () => {
    const { dailyPlan, repository } = createRepository({
      profile: { data: { timezone: 'Mars/Olympus' }, error: null },
    });

    await expect(repository.getToday()).rejects.toMatchObject({ code: 'INVALID_TIME_ZONE' });
    expect(dailyPlan.maybeSingle).not.toHaveBeenCalled();
  });

  it('propagates Supabase failures to the Today error boundary', async () => {
    const error = { code: '42501', message: 'row-level security' };
    const { repository } = createRepository({
      dailyPlan: { data: null, error },
    });

    await expect(repository.getToday()).rejects.toBe(error);
  });
});
