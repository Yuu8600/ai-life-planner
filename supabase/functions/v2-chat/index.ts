declare const Deno: { env: { get(name: string): string | undefined } };

const budgetMicros = 500_000;
const outputLimit = 900;
type RecordValue = Record<string, unknown>;
const asObject = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const asList = (value: unknown) => (Array.isArray(value) ? value.map(asObject) : []);
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const headers = { 'cache-control': 'no-store' };
const response = (data: unknown, status = 200) => Response.json(data, { status, headers });
const fail = (code: string, status: number) => response({ code }, status);

class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function createChatHandler({
  env = (key: string) => Deno.env.get(key),
  fetcher = fetch,
  now = () => new Date(),
  makeId = () => crypto.randomUUID(),
}: {
  env?: (key: string) => string | undefined;
  fetcher?: typeof fetch;
  now?: () => Date;
  makeId?: () => string;
} = {}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'POST') return fail('METHOD', 405);
    const authorization = request.headers.get('authorization');
    const url = env('SUPABASE_URL');
    const publicKey = (() => {
      try {
        return (
          string(asObject(JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')).default) ||
          env('SUPABASE_ANON_KEY')
        );
      } catch {
        return env('SUPABASE_ANON_KEY');
      }
    })();
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization || !/^Bearer \S+$/i.test(authorization)) return fail('AUTH', 401);
    if (!url || !publicKey || !serviceKey) return fail('UNAVAILABLE', 503);
    async function db(path: string, body?: RecordValue, privileged = false): Promise<unknown> {
      const result = await fetcher(`${url}${path}`, {
        headers: {
          apikey: privileged ? serviceKey! : publicKey!,
          Authorization: privileged ? `Bearer ${serviceKey}` : authorization!,
          'content-type': 'application/json',
        },
        method: body ? 'POST' : 'GET',
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok)
        throw new UpstreamError(
          result.status,
          string(asObject(await result.json().catch(() => null)).code),
        );
      return result.status === 204 ? null : result.json();
    }
    let user: string;
    try {
      user = string(asObject(await db('/auth/v1/user')).id);
    } catch (error) {
      return error instanceof UpstreamError && [401, 403].includes(error.status)
        ? fail('AUTH', 401)
        : fail('UNAVAILABLE', 503);
    }
    if (!uuid.test(user)) return fail('AUTH', 401);

    const model = env('V2_OPENAI_MODEL')?.trim();
    const apiKey = env('V2_OPENAI_API_KEY')?.trim();
    // USD per million tokens equals microdollars per token.
    const inputPrice = Number(env('V2_OPENAI_INPUT_USD_PER_MILLION'));
    const outputPrice = Number(env('V2_OPENAI_OUTPUT_USD_PER_MILLION'));
    const configured = Boolean(
      model &&
      apiKey &&
      Number.isFinite(inputPrice) &&
      inputPrice > 0 &&
      Number.isFinite(outputPrice) &&
      outputPrice > 0,
    );
    if (request.method === 'GET') {
      const month = now().toISOString().slice(0, 7) + '-01';
      try {
        const used = Number(await db('/rest/v1/rpc/v2_ai_month_usage', { p_month: month }));
        if (!Number.isSafeInteger(used) || used < 0) return fail('UNAVAILABLE', 503);
        return response({ configured, remainingMicros: Math.max(0, budgetMicros - used), month });
      } catch {
        return fail('UNAVAILABLE', 503);
      }
    }
    if (!configured) return fail('UNCONFIGURED', 503);
    let body: RecordValue;
    try {
      const raw = await request.text();
      if (raw.length > 5000) return fail('REQUEST', 400);
      body = asObject(JSON.parse(raw));
    } catch {
      return fail('REQUEST', 400);
    }
    const thread = string(body.threadId);
    const prompt = string(body.prompt).trim();
    const date = string(body.date);
    const draftId = string(body.draftId);
    if (
      !uuid.test(thread) ||
      !prompt ||
      prompt.length > 1000 ||
      (date && !datePattern.test(date)) ||
      (draftId && !uuid.test(draftId))
    )
      return fail('REQUEST', 400);

    const context = await (async () => {
      const [threadRows, messages, drafts, goals, tasks, profile, day] = await Promise.all([
        db(`/rest/v1/v2_threads?select=id&id=eq.${thread}`),
        db(
          `/rest/v1/v2_messages?select=role,body&thread_id=eq.${thread}&order=created_at.desc&limit=6`,
        ),
        draftId
          ? db(
              `/rest/v1/v2_drafts?select=items&id=eq.${draftId}&thread_id=eq.${thread}&approved_at=is.null`,
            )
          : [],
        db(
          '/rest/v1/goals?select=id,title,priority,deadline,updated_at&status=eq.active&order=updated_at.desc&limit=12',
        ),
        db(
          '/rest/v1/tasks?select=id,title,priority,deadline,deadline_local,estimated_minutes,updated_at&status=neq.completed&order=updated_at.desc&limit=16',
        ),
        db('/rest/v1/profiles?select=timezone&limit=1'),
        date ? db(`/rest/v1/v2_plans?select=state&plan_date=eq.${date}`) : [],
      ]);
      if (asList(threadRows).length !== 1) throw new UpstreamError(403, 'THREAD');
      const timezone = string(asList(profile)[0]?.timezone) || 'UTC';
      const dateOf = (timestamp: unknown) => {
        if (typeof timestamp !== 'string') return null;
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date(timestamp));
        const find = (name: string) => parts.find((part) => part.type === name)?.value;
        return `${find('year')}-${find('month')}-${find('day')}`;
      };
      const relevant = (rows: unknown, max: number) =>
        asList(rows)
          .filter((row) => string(row.title).trim() && prompt.includes(string(row.title).trim()))
          .slice(0, max);
      const goalRows = relevant(goals, 4);
      const taskRows = relevant(tasks, 5).map((row): RecordValue => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        minutes: row.estimated_minutes,
        deadline: row.deadline_local ?? dateOf(row.deadline),
        updated_at: row.updated_at,
      }));
      const states = asList(day).flatMap((row) =>
        asList(asObject(row.state).sessions)
          .slice(0, 10)
          .map((item) => ({ startAt: item.startAt, endAt: item.endAt, status: item.status })),
      );
      return {
        goals: goalRows,
        tasks: taskRows,
        date,
        timezone,
        messages: asList(messages)
          .reverse()
          .map((row) => ({ role: row.role, body: string(row.body).slice(0, 500) })),
        draft: asList(asList(drafts)[0]?.items)
          .slice(0, 8)
          .map((item) => ({
            key: string(item.key).slice(0, 40),
            kind: item.kind,
            title: string(item.title).slice(0, 200),
            priority: item.priority,
            deadline: item.deadline,
            minutes: item.minutes,
            goalKey: item.goalKey,
            targetId: item.targetId,
            date: item.date,
            taskId: item.taskId,
          })),
        sessions: states,
      };
    })().catch((error: unknown) => error);
    if (context instanceof Error)
      return fail('CONTEXT', context instanceof UpstreamError ? context.status : 503);
    const system =
      'あなたは日本語の計画相談アシスタントです。会話と文脈を参照し、外部操作は行わない。JSONのみ返す。形式: {"reply":"回答","items":[{"key":"短い一意のID","kind":"goal または task","title":"名称","priority":"low/medium/high","deadline":null,"minutes":30,"goalKey":null,"targetId":null}]}. 提案不要なら items は空。期限はYYYY-MM-DDまたはnull。更新対象は文脈にある実IDのみ。Taskを新しいGoalへ紐付ける時はgoalKeyで参照。計画の生成や調整は kind=plan、title、date（指定された日）、targetId（文脈のTask ID、全体の調整なら null）で提案し、回答にも説明を含める。';
    const input = JSON.stringify({ prompt, context });
    const bytes = new TextEncoder().encode(system + input).length + 1024;
    if (bytes > 24_000) return fail('CONTEXT_SIZE', 400);
    const reserved = Math.ceil(bytes * inputPrice + outputLimit * outputPrice);
    if (reserved > budgetMicros) return fail('BUDGET', 429);
    const id = makeId();
    try {
      const allowed = await db(
        '/rest/v1/rpc/v2_reserve_ai',
        {
          p_id: id,
          p_user: user,
          p_thread: thread,
          p_model: model,
          p_amount: reserved,
          p_prompt: prompt,
        },
        true,
      );
      if (allowed !== true) return fail('BUDGET', 429);
    } catch (error) {
      if (error instanceof UpstreamError && error.code === '55000') return fail('BUSY', 409);
      return fail('UNAVAILABLE', 503);
    }

    let reply: string | null = null;
    let items: RecordValue[] = [];
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    try {
      const result = await fetcher('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          instructions: system,
          input,
          max_output_tokens: outputLimit,
          store: false,
          text: { format: { type: 'json_object' } },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (result.ok) {
        const data = asObject(await result.json());
        const usage = asObject(data.usage);
        const tokens = (value: unknown) =>
          typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
        inputTokens = tokens(usage.input_tokens);
        outputTokens = tokens(usage.output_tokens);
        const content = asList(data.output)
          .flatMap((entry) => asList(entry.content))
          .filter((entry) => entry.type === 'output_text')
          .map((entry) => string(entry.text))
          .join('');
        const decoded = asObject(JSON.parse(content));
        const raw = asList(decoded.items).slice(0, 8);
        const sources = asObject(context);
        const seen = new Set<string>();
        items = raw.flatMap((item): RecordValue[] => {
          const key = string(item.key);
          const title = string(item.title).trim().slice(0, 200);
          const kind = item.kind;
          if (kind === 'plan') {
            const taskId = string(item.targetId);
            if (
              !date ||
              string(item.date) !== date ||
              !title ||
              !/^[a-zA-Z0-9_-]{1,40}$/.test(key) ||
              seen.has(key) ||
              (taskId && !asList(sources.tasks).some((row) => row.id === taskId))
            )
              return [];
            seen.add(key);
            return [{ key, kind, title, date, taskId: taskId || null }];
          }
          if (
            !/^[a-zA-Z0-9_-]{1,40}$/.test(key) ||
            seen.has(key) ||
            !title ||
            (kind !== 'goal' && kind !== 'task')
          )
            return [];
          const targetId = string(item.targetId);
          const prior = asList(kind === 'goal' ? sources.goals : sources.tasks).find(
            (row) => row.id === targetId,
          );
          if (targetId && !prior) return [];
          const deadline = string(item.deadline);
          if (
            deadline &&
            (!datePattern.test(deadline) ||
              !Number.isFinite(Date.parse(deadline)) ||
              new Date(deadline).toISOString().slice(0, 10) !== deadline)
          )
            return [];
          const minutes = Number(item.minutes);
          if (kind === 'task' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440))
            return [];
          seen.add(key);
          return [
            {
              key,
              kind,
              title,
              deadline: deadline || null,
              priority: ['high', 'medium', 'low'].includes(string(item.priority))
                ? item.priority
                : 'medium',
              minutes: kind === 'task' ? minutes : null,
              goalKey: kind === 'task' ? string(item.goalKey) || null : null,
              targetId: targetId || null,
              before: prior ?? null,
              expectedUpdatedAt: prior?.updated_at ?? null,
            },
          ];
        });
        const goalKeys = new Set(
          items.filter((item) => item.kind === 'goal').map((item) => item.key),
        );
        items = items.filter((item) => !item.goalKey || goalKeys.has(item.goalKey));
        reply = string(decoded.reply).trim().slice(0, 8000) || null;
      }
    } catch {
      /* Record the reservation conservatively when the request outcome is unknown. */
    }
    const cost =
      inputTokens !== null && outputTokens !== null
        ? Math.ceil(inputTokens * inputPrice + outputTokens * outputPrice)
        : null;
    try {
      await db(
        '/rest/v1/rpc/v2_finish_ai',
        {
          p_id: id,
          p_user: user,
          p_thread: thread,
          p_reply: reply,
          p_items: items,
          p_cost: cost,
          p_input: inputTokens,
          p_output: outputTokens,
        },
        true,
      );
    } catch {
      return fail('UNAVAILABLE', 503);
    }
    return reply ? response({ requestId: id }) : fail('MODEL', 502);
  };
}
export default { fetch: createChatHandler() };
