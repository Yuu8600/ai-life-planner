import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from '@supabase/supabase-js';

import type { PlannerInput, PlannerProvider } from '@/features/planner';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

const FUNCTION_NAME = 'planner-generate';

type PlannerFunctionClient = Pick<SupabaseClient<Database>, 'auth' | 'functions'>;

export type EdgeProviderAvailability =
  | { available: true }
  | { available: false; reason: 'configuration' | 'not_deployed' | 'not_implemented' };

export type EdgePlannerErrorKind =
  'authentication' | 'configuration' | 'malformed_response' | 'network' | 'server';

export class EdgePlannerProviderError extends Error {
  constructor(readonly kind: EdgePlannerErrorKind) {
    super(`Planner Edge Function failed: ${kind}`);
    this.name = 'EdgePlannerProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAvailability(value: unknown): EdgeProviderAvailability {
  if (!isRecord(value)) throw new EdgePlannerProviderError('malformed_response');
  if (value.available === true) return { available: true };
  if (
    value.available === false &&
    (value.reason === 'configuration' || value.reason === 'not_implemented')
  ) {
    return { available: false, reason: value.reason };
  }
  throw new EdgePlannerProviderError('malformed_response');
}

async function toInvokeError(error: Error): Promise<EdgePlannerProviderError> {
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new EdgePlannerProviderError('network');
  }
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    if (status === 401 || status === 403) return new EdgePlannerProviderError('authentication');
    if (status === 404 || status === 503) return new EdgePlannerProviderError('configuration');
    return new EdgePlannerProviderError('server');
  }
  return new EdgePlannerProviderError('server');
}

/** The mobile adapter only talks to Supabase. Provider output remains unknown until Core validation. */
export class EdgeFunctionPlannerProvider implements PlannerProvider {
  readonly id = 'openai';

  constructor(private readonly client: PlannerFunctionClient) {}

  private async requireSession(): Promise<void> {
    let result: Awaited<ReturnType<PlannerFunctionClient['auth']['getSession']>>;
    try {
      result = await this.client.auth.getSession();
    } catch {
      throw new EdgePlannerProviderError('authentication');
    }
    if (result.error || !result.data.session?.access_token) {
      throw new EdgePlannerProviderError('authentication');
    }
  }

  async checkAvailability(): Promise<EdgeProviderAvailability> {
    await this.requireSession();
    let result: Awaited<ReturnType<PlannerFunctionClient['functions']['invoke']>>;
    try {
      result = await this.client.functions.invoke(FUNCTION_NAME, { method: 'GET' });
    } catch {
      throw new EdgePlannerProviderError('network');
    }
    if (result.error) {
      const failure = await toInvokeError(result.error);
      if (result.error instanceof FunctionsHttpError && result.error.context.status === 404) {
        return { available: false, reason: 'not_deployed' };
      }
      throw failure;
    }
    return readAvailability(result.data);
  }

  async generate(input: PlannerInput): Promise<unknown> {
    await this.requireSession();
    let result: Awaited<ReturnType<PlannerFunctionClient['functions']['invoke']>>;
    try {
      result = await this.client.functions.invoke(FUNCTION_NAME, { body: input, method: 'POST' });
    } catch {
      throw new EdgePlannerProviderError('network');
    }
    if (result.error) throw await toInvokeError(result.error);
    if (!isRecord(result.data)) throw new EdgePlannerProviderError('malformed_response');
    return result.data;
  }
}

export function createEdgeFunctionPlannerProvider(): EdgeFunctionPlannerProvider {
  return new EdgeFunctionPlannerProvider(getSupabaseClient());
}
