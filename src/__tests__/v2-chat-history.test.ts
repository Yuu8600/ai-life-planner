import { getSupabaseClient } from '@/services/supabase/client';
import { createSupabaseChatRepository } from '@/services/supabase/repositories/SupabaseChatRepository';

jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

it('pages within the same timestamp without including another user or thread', async () => {
  const timestamp = '2026-11-14T09:00:00.123456+00:00';
  const descendingRows = Array.from({ length: 101 }, (_, index) => ({
    id: `11111111-1111-4111-8111-${String(101 - index).padStart(12, '0')}`,
    role: 'user',
    body: String(101 - index),
    created_at: timestamp,
  }));
  const filters = jest.fn().mockReturnThis();
  const order = jest.fn().mockReturnThis();
  const or = jest.fn().mockReturnThis();
  const limit = jest
    .fn()
    .mockResolvedValueOnce({ data: descendingRows, error: null })
    .mockResolvedValueOnce({ data: [descendingRows[100]], error: null });
  const messages = { select: jest.fn().mockReturnThis(), eq: filters, order, or, limit };
  const drafts = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  const from = jest.fn((name: string) => (name === 'v2_messages' ? messages : drafts));
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseClient>);

  const repository = createSupabaseChatRepository('owner');
  const latest = await repository.open('thread');
  expect(latest.messages).toHaveLength(100);
  expect(latest.messages[0].body).toBe('2');
  expect(latest.messages.at(-1)?.body).toBe('101');
  expect(latest.olderCursor).toEqual({ id: descendingRows[99].id, createdAt: timestamp });
  if (!latest.olderCursor) throw new Error('Expected another page');
  const older = await repository.listOlder('thread', latest.olderCursor);

  expect(older).toEqual({
    messages: [{ id: descendingRows[100].id, role: 'user', body: '1' }],
    olderCursor: null,
  });
  expect(filters.mock.calls).toEqual([
    ['user_id', 'owner'],
    ['thread_id', 'thread'],
    ['user_id', 'owner'],
    ['thread_id', 'thread'],
  ]);
  expect(or).toHaveBeenCalledWith(
    `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${descendingRows[99].id})`,
  );
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  expect(order).toHaveBeenCalledWith('id', { ascending: false });
  expect(limit).toHaveBeenCalledWith(101);
});
