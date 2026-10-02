/** @jest-environment node */

import { createPlannerGenerateHandler } from '../../supabase/functions/planner-generate';
import { OpenAITransportError } from '../../supabase/functions/planner-generate/openAiTransport';

const requestInput = {
  calendarEvents: [],
  date: '2026-09-24',
  freeSlots: [],
  goals: [],
  planningWindow: {
    endAt: '2026-09-24T01:00:00.000Z',
    startAt: '2026-09-24T00:00:00.000Z',
  },
  tasks: [],
  timezone: 'Asia/Tokyo',
};

function createHandler(apiKey?: string) {
  const fetcher = jest.fn(async () => Response.json({ id: 'user-id' }));
  const getEnv = (name: string) =>
    ({
      OPENAI_API_KEY: apiKey,
      OPENAI_MODEL: apiKey ? 'test-model' : undefined,
      SUPABASE_ANON_KEY: 'public-test-key',
      SUPABASE_URL: 'https://example.supabase.co',
    })[name as 'OPENAI_API_KEY' | 'OPENAI_MODEL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_URL'];
  return { fetcher, handler: createPlannerGenerateHandler({ fetcher, getEnv }) };
}

function request(method: string, body?: unknown, authenticated = true): Request {
  return new Request('https://example.supabase.co/functions/v1/planner-generate', {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: authenticated ? { Authorization: 'Bearer user-jwt' } : {},
    method,
  });
}

describe('planner-generate Edge Function boundary', () => {
  it('does not expose availability to anonymous callers', async () => {
    const { fetcher, handler } = createHandler();
    const response = await handler(request('GET', undefined, false));

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('verifies the user JWT with Supabase Auth', async () => {
    const { fetcher, handler } = createHandler();
    const response = await handler(request('GET'));

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/user', {
      headers: { Authorization: 'Bearer user-jwt', apikey: 'public-test-key' },
      method: 'GET',
    });
  });

  it('uses the injected publishable key map when Supabase provides it', async () => {
    const fetcher = jest.fn(async () => Response.json({ id: 'user-id' }));
    const handler = createPlannerGenerateHandler({
      fetcher,
      getEnv: (name) =>
        name === 'SUPABASE_URL'
          ? 'https://example.supabase.co'
          : name === 'SUPABASE_PUBLISHABLE_KEYS'
            ? '{"default":"publishable-test-key"}'
            : undefined,
    });
    await handler(request('GET'));

    expect(fetcher).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        headers: { Authorization: 'Bearer user-jwt', apikey: 'publishable-test-key' },
      }),
    );
  });

  it('rejects a token that Supabase Auth does not accept', async () => {
    const handler = createPlannerGenerateHandler({
      fetcher: jest.fn(async () => new Response(null, { status: 401 })),
      getEnv: (name) =>
        name === 'SUPABASE_URL'
          ? 'https://example.supabase.co'
          : name === 'SUPABASE_ANON_KEY'
            ? 'public-test-key'
            : undefined,
    });
    const response = await handler(request('POST', requestInput));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED' } });
  });

  it('reports missing configuration without a paid API call', async () => {
    const { handler } = createHandler();
    const availability = await handler(request('GET'));
    const generation = await handler(request('POST', requestInput));

    expect(await availability.json()).toEqual({ available: false, reason: 'configuration' });
    expect(generation.status).toBe(503);
    expect(await generation.json()).toEqual({ error: { code: 'CONFIGURATION_UNAVAILABLE' } });
  });

  it('validates the PlannerInput JSON before reaching the transport boundary', async () => {
    const { handler } = createHandler('server-test-key');
    const response = await handler(request('POST', { ...requestInput, model: 'unexpected' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'INVALID_REQUEST' } });
  });

  it('rejects additional Calendar fields before they could be sent upstream', async () => {
    const { handler } = createHandler('server-test-key');
    const response = await handler(
      request('POST', {
        ...requestInput,
        calendarEvents: [
          {
            endAt: '2026-09-24T00:30:00.000Z',
            id: 'private-device-id',
            kind: 'timed',
            startAt: '2026-09-24T00:00:00.000Z',
            title: '予定',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it('returns a transport candidate as direct JSON without wrapping it as a Core proposal', async () => {
    const candidate = {
      actions: [],
      date: requestInput.date,
      summary: '予定なし',
      unscheduled: [],
    };
    const generate = jest.fn(async () => candidate);
    const handler = createPlannerGenerateHandler({
      fetcher: jest.fn(async () => Response.json({ id: 'user-id' })),
      generate,
      getEnv: (name) =>
        ({
          OPENAI_API_KEY: 'server-test-key',
          OPENAI_MODEL: 'test-model',
          SUPABASE_ANON_KEY: 'public-test-key',
          SUPABASE_URL: 'https://example.supabase.co',
        })[name as 'OPENAI_API_KEY' | 'OPENAI_MODEL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_URL'],
    });
    const response = await handler(request('POST', requestInput));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(candidate);
    expect(generate).toHaveBeenCalledWith(
      requestInput,
      'server-test-key',
      'test-model',
      expect.any(Function),
    );
  });

  it('reports availability from configuration without contacting OpenAI', async () => {
    const { handler } = createHandler('server-test-key');
    const availability = await handler(request('GET'));

    expect(await availability.json()).toEqual({ available: true });
  });

  it('requires both key and model without invoking the transport', async () => {
    const generate = jest.fn();
    const handler = createPlannerGenerateHandler({
      fetcher: jest.fn(async () => Response.json({ id: 'user-id' })),
      generate,
      getEnv: (name) =>
        ({
          OPENAI_API_KEY: 'server-test-key',
          SUPABASE_ANON_KEY: 'public-test-key',
          SUPABASE_URL: 'https://example.supabase.co',
        })[name as 'OPENAI_API_KEY' | 'SUPABASE_ANON_KEY' | 'SUPABASE_URL'],
    });
    expect(await (await handler(request('GET'))).json()).toEqual({
      available: false,
      reason: 'configuration',
    });
    expect((await handler(request('POST', requestInput))).status).toBe(503);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    ['rate_limit', 429, 'RATE_LIMIT'],
    ['timeout', 504, 'UPSTREAM_TIMEOUT'],
    ['invalid_openai_response', 502, 'INVALID_OPENAI_RESPONSE'],
    ['authentication', 502, 'UPSTREAM_AUTHENTICATION'],
    ['network', 502, 'UPSTREAM_NETWORK'],
  ] as const)('maps %s to safe HTTP errors', async (kind, status, code) => {
    const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createPlannerGenerateHandler({
      fetcher: jest.fn(async () => Response.json({ id: 'user-id' })),
      generate: jest.fn(async () => {
        throw new OpenAITransportError(kind, 429, 'request-test');
      }),
      getEnv: (name) =>
        ({
          OPENAI_API_KEY: 'server-test-key',
          OPENAI_MODEL: 'test-model',
          SUPABASE_ANON_KEY: 'public-test-key',
          SUPABASE_URL: 'https://example.supabase.co',
        })[name as 'OPENAI_API_KEY' | 'OPENAI_MODEL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_URL'],
    });
    const response = await handler(request('POST', requestInput));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
    expect(logger).toHaveBeenCalledWith('planner-generate OpenAI failure', {
      category: kind,
      requestId: 'request-test',
      status: 429,
    });
    logger.mockRestore();
  });
});
