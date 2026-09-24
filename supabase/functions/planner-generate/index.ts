import { generateWithOpenAI, OpenAITransportNotImplementedError } from './openAiTransport.ts';
import { isPlannerInputRequest } from './request.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

type HandlerDependencies = {
  fetcher?: typeof fetch;
  getEnv?: (name: string) => string | undefined;
  generate?: typeof generateWithOpenAI;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { headers: { 'cache-control': 'no-store' }, status });
}

function failure(code: string, status: number): Response {
  return json({ error: { code } }, status);
}

function getPublicKey(getEnv: (name: string) => string | undefined): string | null {
  const keyMap = getEnv('SUPABASE_PUBLISHABLE_KEYS');
  if (keyMap) {
    try {
      const parsed: unknown = JSON.parse(keyMap);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'default' in parsed &&
        typeof parsed.default === 'string'
      ) {
        return parsed.default;
      }
    } catch {
      // Local Supabase may still provide only the legacy anon key.
    }
  }
  return getEnv('SUPABASE_ANON_KEY') ?? null;
}

async function isAuthenticated(
  request: Request,
  getEnv: (name: string) => string | undefined,
  fetcher: typeof fetch,
): Promise<'authenticated' | 'invalid' | 'unavailable'> {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return 'invalid';

  const url = getEnv('SUPABASE_URL');
  const publicKey = getPublicKey(getEnv);
  if (!url || !publicKey) return 'unavailable';

  let response: Response;
  try {
    response = await fetcher(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: authorization },
      method: 'GET',
    });
  } catch {
    return 'unavailable';
  }
  if (response.status === 401 || response.status === 403) return 'invalid';
  if (!response.ok) return 'unavailable';

  try {
    const user: unknown = await response.json();
    return typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'string'
      ? 'authenticated'
      : 'invalid';
  } catch {
    return 'unavailable';
  }
}

export function createPlannerGenerateHandler(dependencies: HandlerDependencies = {}) {
  const getEnv = dependencies.getEnv ?? ((name: string) => Deno.env.get(name));
  const fetcher = dependencies.fetcher ?? fetch;
  const generate = dependencies.generate ?? generateWithOpenAI;

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return failure('METHOD_NOT_ALLOWED', 405);
    }

    const auth = await isAuthenticated(request, getEnv, fetcher);
    if (auth === 'invalid') return failure('AUTHENTICATION_REQUIRED', 401);
    if (auth === 'unavailable') return failure('AUTH_UNAVAILABLE', 503);

    const apiKey = getEnv('OPENAI_API_KEY')?.trim();
    if (request.method === 'GET') {
      return json(
        apiKey
          ? { available: false, reason: 'not_implemented' }
          : { available: false, reason: 'configuration' },
      );
    }

    let input: unknown;
    try {
      const body = await request.text();
      if (body.length > 262_144) return failure('REQUEST_TOO_LARGE', 413);
      input = JSON.parse(body);
    } catch {
      return failure('INVALID_REQUEST', 400);
    }
    if (!isPlannerInputRequest(input)) return failure('INVALID_REQUEST', 400);
    if (!apiKey) return failure('CONFIGURATION_UNAVAILABLE', 503);

    try {
      // The transport deliberately makes no paid API call in Milestone 4F-1.
      const candidate = await generate(input, apiKey);
      return json(candidate);
    } catch (error) {
      if (error instanceof OpenAITransportNotImplementedError) {
        return failure('NOT_IMPLEMENTED', 501);
      }
      return failure('PROVIDER_FAILED', 502);
    }
  };
}

export default { fetch: createPlannerGenerateHandler() };
