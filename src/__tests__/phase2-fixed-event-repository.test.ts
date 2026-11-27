import { createSupabaseFixedEventRepository } from '@/services/supabase/repositories/SupabaseFixedEventRepository';
import { getSupabaseClient } from '@/services/supabase/client';
jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const original = {
  id: 'event',
  title: '元の予定',
  startAt: '2026-11-27T01:00:00Z',
  endAt: '2026-11-27T02:00:00Z',
  planDate: '2026-11-27',
};
function repository(data: unknown) {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ from: jest.fn(() => builder) } as unknown as ReturnType<
      typeof getSupabaseClient
    >);
  return { builder, source: createSupabaseFixedEventRepository('owner') };
}
it('updates only editable columns and scopes the optimistic check to the owner and fixed event', async () => {
  const { builder, source } = repository({ id: 'event' });
  await source.update!(original, { ...original, title: '新しい予定' });
  expect(builder.update).toHaveBeenCalledWith({
    title: '新しい予定',
    start_at: original.startAt,
    end_at: original.endAt,
  });
  for (const pair of [
    ['user_id', 'owner'],
    ['kind', 'fixed'],
    ['id', 'event'],
    ['title', original.title],
    ['start_at', original.startAt],
    ['end_at', original.endAt],
  ])
    expect(builder.eq).toHaveBeenCalledWith(...pair);
});
it('rejects concurrent deletion or modification without pretending the update succeeded', async () => {
  const { source } = repository(null);
  await expect(source.update!(original, original)).rejects.toThrow('変更または削除');
});
