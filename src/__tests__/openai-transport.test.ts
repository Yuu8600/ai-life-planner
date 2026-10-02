/** @jest-environment node */

import {
  createOpenAIRequest,
  generateWithOpenAI,
  OpenAITransportError,
  readOpenAIResponse,
} from '../../supabase/functions/planner-generate/openAiTransport';
import type { PlannerInputRequest } from '../../supabase/functions/planner-generate/request';

const input: PlannerInputRequest = {
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
const candidate = { actions: [], date: input.date, summary: '予定なし', unscheduled: [] };
const completed = {
  status: 'completed',
  output: [
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(candidate) }] },
  ],
};

describe('OpenAI Responses transport', () => {
  it('sends a strict schema, server-configured model, planner instructions and only PlannerInput data', async () => {
    const fetcher: typeof fetch = jest.fn(async () => Response.json(completed));
    await expect(
      generateWithOpenAI(input, 'server-only-key', 'test-model', fetcher),
    ).resolves.toEqual(candidate);

    const [url, options] = (fetcher as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe('Bearer server-only-key');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body).toEqual(createOpenAIRequest(input, 'test-model'));
    expect(body.model).toBe('test-model');
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.text.format.schema.properties.actions.items.properties.taskId.type).toEqual([
      'string',
      'null',
    ]);
    expect(body.input[0].content).toContain('freeSlots');
    expect(body.input[1].content).toBe(JSON.stringify(input));
    expect(JSON.stringify(body)).not.toContain('server-only-key');
  });

  it('extracts valid output but rejects refusal, incomplete, missing and malformed output', () => {
    expect(readOpenAIResponse(completed)).toEqual(candidate);
    for (const response of [
      { status: 'incomplete', output: completed.output },
      { status: 'completed', output: [] },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
      },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{' }] }],
      },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'null' }] }],
      },
      { output: completed.output },
    ]) {
      expect(() => readOpenAIResponse(response)).toThrow(OpenAITransportError);
    }
  });

  it.each([
    [400, 'upstream'],
    [401, 'authentication'],
    [429, 'rate_limit'],
    [500, 'server'],
  ] as const)(
    'maps OpenAI HTTP %i to %s without echoing the upstream body',
    async (status, kind) => {
      const fetcher: typeof fetch = jest.fn(async () =>
        Response.json({ secret: 'do-not-log' }, { status }),
      );
      await expect(generateWithOpenAI(input, 'key', 'test-model', fetcher)).rejects.toMatchObject({
        kind,
        status,
      });
    },
  );

  it('maps timeout and network errors without automatic retry', async () => {
    const timeoutFetcher: typeof fetch = jest.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const networkFetcher: typeof fetch = jest.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      generateWithOpenAI(input, 'key', 'test-model', timeoutFetcher),
    ).rejects.toMatchObject({
      kind: 'timeout',
    });
    await expect(
      generateWithOpenAI(input, 'key', 'test-model', networkFetcher),
    ).rejects.toMatchObject({
      kind: 'network',
    });
    expect(timeoutFetcher).toHaveBeenCalledTimes(1);
    expect(networkFetcher).toHaveBeenCalledTimes(1);
  });
});
