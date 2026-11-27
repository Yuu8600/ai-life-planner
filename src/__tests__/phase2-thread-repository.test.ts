import { getSupabaseClient } from '@/services/supabase/client';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';
import type { Thread } from '@/features/ai-chat/v2/repository';
jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const thread: Thread = {
  id: 'thread',
  title: '元の会話',
  updatedAt: '2026-11-27T01:00:00Z',
  canManage: true,
};
type Result = { data: unknown; error: { code: string; message: string } | null };
function setup(results: Result[]) {
  const builders = results.map((value) => {
    const promise = Promise.resolve(value);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      maybeSingle: jest.fn(async () => value),
      then: promise.then.bind(promise),
    };
    for (const method of [query.select, query.eq, query.order, query.update, query.delete])
      method.mockReturnValue(query);
    return query;
  });
  const from = jest.fn();
  builders.forEach((query) => from.mockReturnValueOnce(query));
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseClient>);
  return { repository: createSupabaseChatRepository('owner'), builders, from };
}
it('maps the updated timestamp and sorts within the signed-in owner', async () => {
  const { repository, builders } = setup([
    {
      data: [
        { id: 'thread', title: '元の会話', created_at: '2026-01-01', updated_at: thread.updatedAt },
      ],
      error: null,
    },
  ]);
  expect(await repository.listThreads()).toEqual([
    expect.objectContaining({ updatedAt: thread.updatedAt, canManage: true }),
  ]);
  expect(builders[0].eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(builders[0].order).toHaveBeenCalledWith('updated_at', { ascending: false });
});
it('keeps unmigrated installations readable but disables management, without masking network errors', async () => {
  const { repository, from } = setup([
    { data: null, error: { code: '42703', message: 'column updated_at does not exist' } },
    { data: [{ id: 'thread', title: '旧会話', created_at: '2026-01-01' }], error: null },
  ]);
  expect(await repository.listThreads()).toEqual([
    { id: 'thread', title: '旧会話', createdAt: '2026-01-01', canManage: false },
  ]);
  expect(from).toHaveBeenCalledTimes(2);
  const network = setup([{ data: null, error: { code: 'NETWORK', message: 'unavailable' } }]);
  await expect(network.repository.listThreads()).rejects.toMatchObject({ code: 'NETWORK' });
  expect(network.from).toHaveBeenCalledTimes(1);
});
it('updates only the title, checks original values, and refuses invalid or stale names', async () => {
  const { repository, builders } = setup([
    {
      data: { id: 'thread', title: '新しい会話', updated_at: '2026-11-27T02:00:00Z' },
      error: null,
    },
  ]);
  await expect(repository.renameThread!(thread, '   ')).rejects.toThrow('1〜100');
  expect(builders[0].update).not.toHaveBeenCalled();
  await repository.renameThread!(thread, ' 新しい会話 ');
  expect(builders[0].update).toHaveBeenCalledWith({ title: '新しい会話' });
  for (const pair of [
    ['user_id', 'owner'],
    ['id', thread.id],
    ['title', thread.title],
    ['updated_at', thread.updatedAt],
  ])
    expect(builders[0].eq).toHaveBeenCalledWith(...pair);
  const stale = setup([{ data: null, error: null }]);
  await expect(stale.repository.renameThread!(thread, '変更')).rejects.toThrow('変更または削除');
});
it('scopes deletes with the timestamp and reports in-flight AI instead of treating it as deleted', async () => {
  const { repository, builders } = setup([
    { data: null, error: { code: '55000', message: 'AI request in progress' } },
  ]);
  await expect(repository.removeThread!(thread)).rejects.toThrow('AIの応答を処理中');
  expect(builders[0].eq).toHaveBeenCalledWith('updated_at', thread.updatedAt);
  expect(builders[0].eq).toHaveBeenCalledWith('user_id', 'owner');
  const stale = setup([{ data: null, error: null }]);
  await expect(stale.repository.removeThread!(thread)).rejects.toThrow('変更または削除');
});
