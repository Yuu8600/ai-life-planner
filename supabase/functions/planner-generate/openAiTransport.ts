import type { PlannerInputRequest } from './request.ts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TIMEOUT_MS = 20_000;

export type OpenAITransportErrorKind =
  | 'authentication'
  | 'invalid_openai_response'
  | 'network'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'upstream';

export class OpenAITransportError extends Error {
  constructor(
    readonly kind: OpenAITransportErrorKind,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(`OpenAI transport failed: ${kind}`);
    this.name = 'OpenAITransportError';
  }
}

/** Structural schema only; the provider-neutral Core Validator enforces scheduling semantics. */
export const plannerProposalSchema = {
  type: 'object',
  properties: {
    date: { type: 'string' },
    summary: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: ['string', 'null'] },
          title: { type: 'string' },
          startAt: { type: 'string' },
          endAt: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['taskId', 'title', 'startAt', 'endAt', 'reason'],
        additionalProperties: false,
      },
    },
    unscheduled: {
      type: 'array',
      items: {
        type: 'object',
        properties: { taskId: { type: 'string' }, reason: { type: 'string' } },
        required: ['taskId', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['date', 'summary', 'actions', 'unscheduled'],
  additionalProperties: false,
} as const;

const PLANNER_INSTRUCTIONS = [
  'あなたはユーザーの1日の計画を作るPlannerです。指定されたJSON Schemaだけを出力してください。',
  '入力timezoneとdateを尊重し、dateは入力と一致させてください。',
  'Taskを配置できる時間帯はfreeSlotsだけです。各Actionは単一freeSlotとplanningWindowに完全に収め、Action同士を重複させないでください。',
  'calendarEventsは1日の流れを考えるための文脈です。availabilityやblockingを再判定せず、空き時間を再計算しないでください。',
  '入力Taskはそれぞれactionsかunscheduledのどちらか一方に必ず1回だけ入れてください。存在しないTask IDを作らないでください。',
  '原則としてTask由来のActionだけを作り、Taskを分割せず、1 Task = 最大1 Actionにしてください。estimatedMinutesを原則満たしてください。',
  'Task priority、deadline、GoalとCalendarの文脈を考慮してください。ActionはstartAt昇順にしてください。',
  'startAtとendAtはoffset付きRFC 3339、できればUTCのZ形式で出力してください。配置できないTaskには具体的な理由を付けてください。',
].join('\n');

export function createOpenAIRequest(input: PlannerInputRequest, model: string) {
  return {
    model,
    input: [
      { role: 'developer', content: PLANNER_INSTRUCTIONS },
      { role: 'user', content: JSON.stringify(input) },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'planner_proposal',
        strict: true,
        schema: plannerProposalSchema,
      },
    },
    reasoning: { effort: 'low' },
    store: false,
  } as const;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readOpenAIResponse(value: unknown): unknown {
  if (!record(value) || value.status !== 'completed' || !Array.isArray(value.output)) {
    throw new OpenAITransportError('invalid_openai_response');
  }

  let outputText: string | null = null;
  for (const item of value.output) {
    if (!record(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!record(content)) continue;
      if (content.type === 'refusal') throw new OpenAITransportError('invalid_openai_response');
      if (content.type === 'output_text' && typeof content.text === 'string') {
        if (outputText !== null) throw new OpenAITransportError('invalid_openai_response');
        outputText = content.text;
      }
    }
  }
  if (outputText === null) throw new OpenAITransportError('invalid_openai_response');

  try {
    const candidate: unknown = JSON.parse(outputText);
    if (!record(candidate)) throw new OpenAITransportError('invalid_openai_response');
    return candidate;
  } catch {
    throw new OpenAITransportError('invalid_openai_response');
  }
}

export async function generateWithOpenAI(
  input: PlannerInputRequest,
  apiKey: string,
  model: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createOpenAIRequest(input, model)),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    throw new OpenAITransportError(timedOut ? 'timeout' : 'network');
  }

  if (!response.ok) {
    const kind: OpenAITransportErrorKind =
      response.status === 401 || response.status === 403
        ? 'authentication'
        : response.status === 429
          ? 'rate_limit'
          : response.status === 408 || response.status === 504
            ? 'timeout'
            : response.status >= 500
              ? 'server'
              : 'upstream';
    throw new OpenAITransportError(
      kind,
      response.status,
      response.headers.get('x-request-id') ?? undefined,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OpenAITransportError('invalid_openai_response');
  }
  return readOpenAIResponse(body);
}
