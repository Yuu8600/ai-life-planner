/** @jest-environment node */

import { createChatHandler } from '../../supabase/functions/v2-chat/index';

const id = '18cdeb65-3609-4ea4-b135-22e72d68bffe';
const environment: Record<string, string> = {
  SUPABASE_URL: 'https://example.invalid',
  SUPABASE_ANON_KEY: 'local-publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service',
  V2_OPENAI_MODEL: 'mock-model',
  V2_OPENAI_API_KEY: 'mock',
  V2_OPENAI_INPUT_USD_PER_MILLION: '1',
  V2_OPENAI_OUTPUT_USD_PER_MILLION: '2',
};

function makeHandler(allow: boolean, configured = true) {
  const fetcher = jest.fn(async (url: string) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id });
    if (url.includes('/v2_threads?')) return Response.json([{ id }]);
    if (url.includes('/rpc/v2_ai_month_usage')) return Response.json(0);
    if (url.includes('/rpc/v2_reserve_ai')) return Response.json(allow);
    if (url.includes('/rpc/v2_finish_ai')) return new Response(null, { status: 204 });
    if (url.startsWith('https://api.openai.com'))
      return Response.json({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  reply: '提案します。',
                  items: [{ kind: 'goal', key: 'goal', title: '学習', priority: 'high' }],
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    return Response.json([]);
  });
  const handler = createChatHandler({
    env: (key) => (!configured && key === 'V2_OPENAI_API_KEY' ? undefined : environment[key]),
    fetcher: fetcher as typeof fetch,
    makeId: () => id,
  });
  const request = (method = 'POST', auth = true) =>
    new Request('https://example.invalid/v2-chat', {
      method,
      headers: auth ? { Authorization: 'Bearer mock' } : undefined,
      body:
        method === 'POST'
          ? JSON.stringify({ threadId: id, prompt: '学習目標を提案して' })
          : undefined,
    });
  return { handler, fetcher, request };
}

it('rejects unauthenticated requests and exhausted budgets before calling OpenAI', async () => {
  const { handler, fetcher, request } = makeHandler(false);
  expect((await handler(request('POST', false))).status).toBe(401);
  const denied = await handler(request());
  expect(denied.status).toBe(429);
  expect(await denied.json()).toEqual({ code: 'BUDGET' });
  expect(fetcher.mock.calls.some(([url]) => url.startsWith('https://api.openai.com'))).toBe(false);
});

it('returns availability for unconfigured AI with no model call', async () => {
  const { handler, fetcher, request } = makeHandler(true, false);
  expect(await (await handler(request('GET'))).json()).toMatchObject({
    configured: false,
    remainingMicros: 500000,
  });
  expect((await handler(request())).status).toBe(503);
  expect(fetcher.mock.calls.some(([url]) => url.startsWith('https://api.openai.com'))).toBe(false);
});

it('returns only a request ID after storing a reply and draft with bounded usage', async () => {
  const { handler, fetcher, request } = makeHandler(true);
  const result = await handler(request());
  expect(await result.json()).toEqual({ requestId: id });
  const call = fetcher.mock.calls.find(([url]) => url.includes('/rpc/v2_finish_ai'));
  const init = (call as unknown as [string, RequestInit])[1];
  expect(JSON.parse(String(init.body))).toMatchObject({
    p_cost: 200,
    p_input: 100,
    p_output: 50,
    p_items: [
      expect.objectContaining({ key: 'goal', kind: 'goal', title: '学習', targetId: null }),
    ],
  });
});
