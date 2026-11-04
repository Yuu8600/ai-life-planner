import type { SupabaseClient } from '@supabase/supabase-js';

import type { LocalDate } from '@/features/today';
import type { Database } from '@/services/supabase/database.types';
import { SupabaseActivityLogRepository } from '@/services/supabase/repositories/SupabaseActivityLogRepository';

jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const userId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const date = '2026-10-09' as const;
const row: Database['public']['Tables']['activity_logs']['Row'] = {
  id,
  user_id: userId,
  action_title: 'Snapshot title',
  event_type: 'planned_action_completed',
  occurred_at: '2026-10-09T15:32:23.123456+00:00',
  plan_date: date,
  timezone: 'Asia/Tokyo',
  planned_action_id: '33333333-3333-4333-8333-333333333333',
  task_id: null,
  scheduled_start_at: '2026-10-09T14:30:00+00:00',
  scheduled_end_at: '2026-10-09T15:00:00+00:00',
};

function createRepository(data: unknown = [row], error: unknown = null) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  const from = jest.fn(() => builder);
  const client = { from } as unknown as SupabaseClient<Database>;
  return { from, builder, repository: new SupabaseActivityLogRepository(client, userId) };
}

describe('SupabaseActivityLogRepository', () => {
  it('queries the Plan date and authenticated user, newest first with an id tie-break and no joins', async () => {
    const { repository, builder, from } = createRepository();
    await expect(repository.listForPlanDate(date)).resolves.toEqual([
      {
        actionTitle: 'Snapshot title',
        eventType: 'planned_action_completed',
        id,
        occurredAt: row.occurred_at,
        planDate: date,
        plannedActionId: row.planned_action_id,
        scheduledEndAt: row.scheduled_end_at,
        scheduledStartAt: row.scheduled_start_at,
        taskId: null,
        timezone: 'Asia/Tokyo',
      },
    ]);
    expect(from).toHaveBeenCalledWith('activity_logs');
    expect(from).toHaveBeenCalledTimes(1);
    expect(builder.eq.mock.calls).toEqual([
      ['user_id', userId],
      ['plan_date', date],
    ]);
    expect(builder.order.mock.calls).toEqual([
      ['occurred_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/[()]/);
    // occurred_at is already the next Tokyo day: retain it under its Plan date.
    expect(builder.eq).not.toHaveBeenCalledWith('occurred_at', expect.anything());
  });

  it('supports a Skip with a Task reference and nullable/deleted Action references', async () => {
    const { repository } = createRepository([
      { ...row, event_type: 'planned_action_skipped', planned_action_id: null, task_id: id },
    ]);
    await expect(repository.listForPlanDate(date)).resolves.toEqual([
      expect.objectContaining({
        eventType: 'planned_action_skipped',
        plannedActionId: null,
        taskId: id,
      }),
    ]);
  });

  it('preserves PostgreSQL microsecond and tie ordering instead of truncating and re-sorting', async () => {
    const data = [
      {
        ...row,
        id: '10000000-0000-4000-8000-000000000001',
        occurred_at: '2026-10-09T00:00:00.000999Z',
      },
      {
        ...row,
        id: '90000000-0000-4000-8000-000000000001',
        occurred_at: '2026-10-09T00:00:00.000111Z',
      },
      {
        ...row,
        id: '80000000-0000-4000-8000-000000000001',
        occurred_at: '2026-10-09T00:00:00.000111Z',
      },
    ];
    const { repository } = createRepository(data);
    expect((await repository.listForPlanDate(date)).map((log) => log.id)).toEqual(
      data.map((log) => log.id),
    );
  });

  it('supports empty results and propagates a read failure', async () => {
    await expect(createRepository([]).repository.listForPlanDate(date)).resolves.toEqual([]);
    const failure = new Error('database unavailable');
    await expect(createRepository(null, failure).repository.listForPlanDate(date)).rejects.toBe(
      failure,
    );
  });

  it.each([
    { user_id: id },
    { id: 'bad' },
    { plan_date: '2026-10-08' },
    { event_type: 'task_completed' },
    { action_title: '  ' },
    { planned_action_id: 'bad' },
    { task_id: 'bad' },
    { occurred_at: '2026-10-09T10:00:00' },
    { occurred_at: 'not-an-instant' },
    { occurred_at: '2026-02-30T00:00:00Z' },
    { scheduled_start_at: 'bad' },
    { scheduled_end_at: row.scheduled_start_at },
    { scheduled_end_at: '2026-10-08T00:00:00Z' },
    { timezone: 'Invalid/Timezone' },
  ])('rejects invalid/scoped-out DB data %j', async (override) => {
    await expect(
      createRepository([{ ...row, ...override }]).repository.listForPlanDate(date),
    ).rejects.toThrow();
  });

  it('validates the date before querying', async () => {
    const { repository, from } = createRepository();
    await expect(repository.listForPlanDate('2026-02-30' as LocalDate)).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
