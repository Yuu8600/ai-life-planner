import type { PlannerInputRequest } from './request.ts';

export class OpenAITransportNotImplementedError extends Error {
  constructor() {
    super('OpenAI transport is reserved for Milestone 4F-2.');
    this.name = 'OpenAITransportNotImplementedError';
  }
}

/** 4F-2 will implement this server-only boundary with structured output. */
export async function generateWithOpenAI(
  _input: PlannerInputRequest,
  _apiKey: string,
): Promise<unknown> {
  throw new OpenAITransportNotImplementedError();
}
