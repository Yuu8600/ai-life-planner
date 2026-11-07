import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/services/supabase/database.types';
import { SupabaseTodayRepository } from '@/services/supabase/repositories/SupabaseTodayRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const dailyPlanId = '22222222-2222-4222-8222-222222222222';
const firstActionId = '33333333-3333-4333-8333-333333333333';
const secondActionId = '33333333-3333-4333-8333-444444444444';
const thirdActionId = '33333333-3333-4333-8333-555555555555';
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
  actionTasks?: QueryResponse;
  actions?: QueryResponse;
  dailyPlan?: QueryResponse;
  deadlineTasks?: QueryResponse;
  goals?: QueryResponse;
  profile?: QueryResponse;
};

function createChainBuilder(): TestBuilder {
  const builder = {} as TestBuilder;
  builder.eq = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.lt = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(() => builder);
  return builder;
}

function createRepository(responses: Responses = {}) {
  const profile = createChainBuilder();
  profile.maybeSingle = jest.fn(
    async () =>
      responses.profile ?? {
        data: {
          timezone: 'Asia/Tokyo',
          planning_start: '08:00:00',
          planning_end: '23:00:00',
          planning_end_day_offset: 0,
        },
        error: null,
      },
  );

  const dailyPlan = createChainBuilder();
  dailyPlan.maybeSingle = jest.fn(async () => responses.dailyPlan ?? { data: null, error: null });

  const actions = createChainBuilder();
  actions.order = jest.fn(async () => responses.actions ?? { data: [], error: null });

  const deadlineTasks = createChainBuilder();
  deadlineTasks.order = jest.fn(async () => responses.deadlineTasks ?? { data: [], error: null });

  const actionTasks = createChainBuilder();
  actionTasks.in = jest.fn(async () => responses.actionTasks ?? { data: [], error: null });

  const goals = createChainBuilder();
  goals.in = jest.fn(async () => responses.goals ?? { data: [], error: null });

  let taskQueryCount = 0;
  const builders: Record<string, TestBuilder> = {
    daily_plans: dailyPlan,
    goals,
    planned_actions: actions,
    profiles: profile,
  };
  const from = jest.fn((table: string) => {
    if (table === 'tasks') {
      taskQueryCount += 1;
      return taskQueryCount === 1 ? deadlineTasks : actionTasks;
    }
    return builders[table];
  });
  const client = { from } as unknown as SupabaseClient<Database>;

  return {
    actionTasks,
    actions,
    dailyPlan,
    deadlineTasks,
    from,
    goals,
    profile,
    repository: new SupabaseTodayRepository(client, userId, now),
  };
}

const planRow = {
  id: dailyPlanId,
  plan_date: '2026-09-14',
  summary: '英語学習を進めます。',
  timezone: 'Asia/Tokyo',
  user_id: userId,
};

const actionRow = {
  daily_plan_id: dailyPlanId,
  end_at: '2026-09-13T23:30:00.000Z',
  id: firstActionId,
  reason: '朝の空き時間を使うためです。',
  start_at: '2026-09-13T23:00:00.000Z',
  status: 'scheduled',
  task_id: taskId,
  title: 'TOEIC Listening',
  user_id: userId,
};

describe('SupabaseTodayRepository', () => {
  it('returns a distinct no-Plan projection and still loads Today deadline Tasks', async () => {
    const { actions, dailyPlan, deadlineTasks, repository } = createRepository({
      deadlineTasks: {
        data: [
          {
            deadline: '2026-09-14T14:59:59.999Z',
            goal_id: null,
            id: taskId,
            status: 'pending',
            title: ' 今日が期限 ',
            user_id: userId,
          },
        ],
        error: null,
      },
    });

    await expect(repository.getToday()).resolves.toEqual({
      deadlineTasks: [
        {
          deadlineAt: '2026-09-14T14:59:59.999Z',
          goalTitle: null,
          id: taskId,
          status: 'pending',
          title: '今日が期限',
        },
      ],
      greeting: 'こんばんは',
      localDate: '2026-09-14',
      plan: null,
      planningWindow: { startAt: '2026-09-13T23:00:00.000Z', endAt: '2026-09-14T14:00:00.000Z' },
      profileTimezone: 'Asia/Tokyo',
    });
    expect(dailyPlan.eq).toHaveBeenCalledWith('plan_date', '2026-09-14');
    expect(deadlineTasks.gte).toHaveBeenCalledWith('deadline', '2026-09-13T15:00:00.000Z');
    expect(deadlineTasks.lt).toHaveBeenCalledWith('deadline', '2026-09-14T15:00:00.000Z');
    expect(actions.order).not.toHaveBeenCalled();
  });

  it('loads summary, reason, all statuses, Task metadata, and deterministically sorted Actions', async () => {
    const { actionTasks, actions, goals, repository } = createRepository({
      actions: {
        data: [
          {
            ...actionRow,
            end_at: '2026-09-14T01:30:00.000Z',
            id: secondActionId,
            start_at: '2026-09-14T01:00:00.000Z',
          },
          { ...actionRow, id: firstActionId, status: 'completed' },
          {
            ...actionRow,
            end_at: '2026-09-14T01:30:00.000Z',
            id: thirdActionId,
            reason: null,
            start_at: '2026-09-14T01:00:00.000Z',
            status: 'skipped',
            task_id: null,
            title: '自由Action',
          },
        ],
        error: null,
      },
      actionTasks: {
        data: [{ goal_id: goalId, id: taskId, title: ' Listening練習 ', user_id: userId }],
        error: null,
      },
      dailyPlan: { data: planRow, error: null },
      goals: { data: [{ id: goalId, title: ' TOEIC 730 ', user_id: userId }], error: null },
    });

    const result = await repository.getToday();

    expect(result.plan).toEqual({
      actions: [
        expect.objectContaining({
          id: firstActionId,
          reason: '朝の空き時間を使うためです。',
          status: 'completed',
          taskTitle: 'Listening練習',
        }),
        expect.objectContaining({ id: secondActionId, status: 'scheduled' }),
        expect.objectContaining({
          goalTitle: null,
          id: thirdActionId,
          reason: null,
          status: 'skipped',
          taskId: null,
        }),
      ],
      date: '2026-09-14',
      id: dailyPlanId,
      summary: '英語学習を進めます。',
      timezone: 'Asia/Tokyo',
    });
    expect(actions.order).toHaveBeenCalledWith('start_at', { ascending: true });
    expect(actionTasks.in).toHaveBeenCalledWith('id', [taskId]);
    expect(goals.in).toHaveBeenCalledWith('id', [goalId]);
  });

  it('uses profile timezone to select plan_date and saved Plan timezone for action bounds', async () => {
    const { actions, dailyPlan, repository } = createRepository({
      actions: {
        data: [
          {
            ...actionRow,
            end_at: '2026-09-14T13:30:00.000Z',
            start_at: '2026-09-14T13:00:00.000Z',
            task_id: null,
          },
        ],
        error: null,
      },
      dailyPlan: {
        data: { ...planRow, timezone: 'America/New_York' },
        error: null,
      },
    });

    const result = await repository.getToday();

    expect(dailyPlan.eq).toHaveBeenCalledWith('plan_date', '2026-09-14');
    expect(actions.gte).toHaveBeenCalledWith('start_at', '2026-09-14T04:00:00.000Z');
    expect(actions.lt).toHaveBeenCalledWith('start_at', '2026-09-15T04:00:00.000Z');
    expect(result.profileTimezone).toBe('Asia/Tokyo');
    expect(result.plan?.timezone).toBe('America/New_York');
  });

  it('returns a saved Plan with zero Actions without treating it as no Plan', async () => {
    const { repository } = createRepository({
      dailyPlan: { data: { ...planRow, summary: null }, error: null },
    });

    await expect(repository.getToday()).resolves.toEqual(
      expect.objectContaining({
        plan: expect.objectContaining({ actions: [], id: dailyPlanId, summary: null }),
      }),
    );
  });

  it('rejects malformed or cross-user Action data', async () => {
    const outOfRange = createRepository({
      actions: { data: [{ ...actionRow, start_at: '2026-09-13T14:59:59.999Z' }], error: null },
      dailyPlan: { data: planRow, error: null },
    });
    await expect(outOfRange.repository.getToday()).rejects.toThrow(
      'Unexpected planned action data',
    );

    const otherUser = createRepository({
      actions: { data: [{ ...actionRow, user_id: otherUserId }], error: null },
      dailyPlan: { data: planRow, error: null },
    });
    await expect(otherUser.repository.getToday()).rejects.toThrow('Unexpected planned action data');
  });

  it('fails safely for an invalid profile or Plan timezone without falling back', async () => {
    const invalidProfile = createRepository({
      profile: {
        data: {
          timezone: 'Mars/Olympus',
          planning_start: '08:00:00',
          planning_end: '23:00:00',
          planning_end_day_offset: 0,
        },
        error: null,
      },
    });
    await expect(invalidProfile.repository.getToday()).rejects.toMatchObject({
      code: 'INVALID_TIME_ZONE',
    });

    const invalidPlan = createRepository({
      dailyPlan: { data: { ...planRow, timezone: 'Mars/Olympus' }, error: null },
    });
    await expect(invalidPlan.repository.getToday()).rejects.toMatchObject({
      code: 'INVALID_TIME_ZONE',
    });
  });

  it('propagates a database failure instead of returning an empty state', async () => {
    const error = { code: '42501', message: 'row-level security' };
    const { repository } = createRepository({ dailyPlan: { data: null, error } });

    await expect(repository.getToday()).rejects.toBe(error);
  });
});

it('reads previous planning date after midnight using saved bounds even after profile hours change', async () => {
  const snapshot = { startAt: '2026-09-13T00:00:00.000Z', endAt: '2026-09-13T17:00:00.000Z' };
  const test = createRepository({
    profile: {
      data: {
        timezone: 'Asia/Tokyo',
        planning_start: '09:00:00',
        planning_end: '01:00:00',
        planning_end_day_offset: 1,
      },
      error: null,
    },
    dailyPlan: {
      data: {
        id: dailyPlanId,
        user_id: userId,
        plan_date: '2026-09-13',
        timezone: 'Asia/Tokyo',
        summary: 'night',
        window_start_at: snapshot.startAt,
        window_end_at: snapshot.endAt,
      },
      error: null,
    },
    actions: {
      data: [
        {
          id: firstActionId,
          user_id: userId,
          daily_plan_id: dailyPlanId,
          task_id: null,
          title: 'night',
          reason: null,
          status: 'scheduled',
          start_at: '2026-09-13T16:00:00Z',
          end_at: '2026-09-13T16:30:00Z',
        },
      ],
      error: null,
    },
  });
  const today = await test.repository.getToday();
  expect(today.localDate).toBe('2026-09-13');
  expect(today.plan?.window).toEqual(snapshot);
  expect(today.plan?.actions[0].startAt).toBe('2026-09-13T16:00:00.000Z');
  expect(test.actions.gte).toHaveBeenCalledWith('start_at', snapshot.startAt);
  expect(test.actions.lt).toHaveBeenCalledWith('start_at', snapshot.endAt);
  expect(today.planningWindow?.endAt).toBe('2026-09-13T16:00:00.000Z');
});
