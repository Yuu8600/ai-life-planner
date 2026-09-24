import {
  FunctionsFetchError,
  FunctionsHttpError,
  type SupabaseClient,
} from '@supabase/supabase-js';

import {
  generatePlannerProposal,
  RuleBasedPlannerProvider,
  selectPlannerProvider,
  type PlannerInput,
} from '@/features/planner';
import type { Database } from '@/services/supabase/database.types';
import {
  EdgeFunctionPlannerProvider,
  EdgePlannerProviderError,
} from '@/services/supabase/providers/EdgeFunctionPlannerProvider';

jest.mock('@/services/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const taskId = '11111111-1111-4111-8111-111111111111';
const input: PlannerInput = {
  calendarEvents: [],
  date: '2026-09-24',
  freeSlots: [
    {
      durationMinutes: 60,
      endAt: '2026-09-24T01:00:00.000Z',
      startAt: '2026-09-24T00:00:00.000Z',
    },
  ],
  goals: [],
  planningWindow: {
    endAt: '2026-09-24T01:00:00.000Z',
    startAt: '2026-09-24T00:00:00.000Z',
  },
  tasks: [
    {
      deadline: null,
      estimatedMinutes: 30,
      goalId: null,
      id: taskId,
      priority: 'high',
      status: 'pending',
      title: '復習',
    },
  ],
  timezone: 'Asia/Tokyo',
};
const validCandidate = {
  actions: [
    {
      endAt: '2026-09-24T00:30:00.000Z',
      reason: '優先度が高いため',
      startAt: '2026-09-24T00:00:00.000Z',
      taskId,
      title: '復習',
    },
  ],
  date: input.date,
  summary: '復習を進めます。',
  unscheduled: [],
};

function createAdapter(response: { data: unknown; error: Error | null }, authenticated = true) {
  const invoke = jest.fn(async () => response);
  const getSession = jest.fn(async () => ({
    data: { session: authenticated ? { access_token: 'test-session' } : null },
    error: null,
  }));
  const client = {
    auth: { getSession },
    functions: { invoke },
  } as unknown as SupabaseClient<Database>;
  return { getSession, invoke, provider: new EdgeFunctionPlannerProvider(client) };
}

describe('optional Planner Provider selection', () => {
  it('keeps RuleBased as the default without constructing or calling Edge', async () => {
    const ruleBased = new RuleBasedPlannerProvider();
    const selected = selectPlannerProvider({ ruleBased });

    expect(selected).toBe(ruleBased);
    expect((await generatePlannerProposal(selected, input)).ok).toBe(true);
  });

  it('selects OpenAI only when explicitly requested and never silently falls back', () => {
    const ruleBased = new RuleBasedPlannerProvider();
    const edge = createAdapter({ data: validCandidate, error: null }).provider;

    expect(selectPlannerProvider({ openai: edge, ruleBased }, 'openai')).toBe(edge);
    expect(() => selectPlannerProvider({ ruleBased }, 'openai')).toThrow(
      'Planner Provider openai is unavailable.',
    );
  });
});

describe('EdgeFunctionPlannerProvider', () => {
  it('returns Edge JSON as unknown and passes it through Core validation', async () => {
    const { invoke, provider } = createAdapter({ data: validCandidate, error: null });

    const result = await generatePlannerProposal(provider, input);

    expect(provider.id).toBe('openai');
    expect(invoke).toHaveBeenCalledWith('planner-generate', { body: input, method: 'POST' });
    expect(result.ok).toBe(true);
  });

  it('lets Core Validator reject an invalid JSON proposal', async () => {
    const { provider } = createAdapter({ data: { actions: [] }, error: null });
    const result = await generatePlannerProposal(provider, input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation errors.');
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_STRUCTURE' }));
  });

  it.each([
    [new FunctionsFetchError(new Error('offline')), 'network'],
    [new FunctionsHttpError({ status: 401 }), 'authentication'],
    [new FunctionsHttpError({ status: 503 }), 'configuration'],
    [new FunctionsHttpError({ status: 500 }), 'server'],
  ] as const)('classifies Edge errors as %s', async (error, kind) => {
    const { provider } = createAdapter({ data: null, error });
    await expect(provider.generate(input)).rejects.toMatchObject({ kind });
  });

  it('requires a session before invoking the function', async () => {
    const { invoke, provider } = createAdapter({ data: validCandidate, error: null }, false);
    await expect(provider.generate(input)).rejects.toMatchObject({ kind: 'authentication' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects a malformed transport response without trusting it as a proposal', async () => {
    const { provider } = createAdapter({ data: null, error: null });
    await expect(provider.generate(input)).rejects.toBeInstanceOf(EdgePlannerProviderError);
    await expect(provider.generate(input)).rejects.toMatchObject({ kind: 'malformed_response' });
  });

  it('checks availability only when requested and never receives the API key', async () => {
    const { invoke, provider } = createAdapter({
      data: { available: false, reason: 'configuration' },
      error: null,
    });
    expect(invoke).not.toHaveBeenCalled();
    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'configuration',
    });
    expect(invoke).toHaveBeenCalledWith('planner-generate', { method: 'GET' });
  });

  it('reports an undeployed optional function as unavailable', async () => {
    const { provider } = createAdapter({
      data: null,
      error: new FunctionsHttpError({ status: 404 }),
    });
    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      reason: 'not_deployed',
    });
  });
});
