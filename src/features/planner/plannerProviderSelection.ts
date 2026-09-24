import type { PlannerProvider } from './providers/PlannerProvider';

export type PlannerProviderId = 'openai' | 'rule-based';

export const DEFAULT_PLANNER_PROVIDER_ID: PlannerProviderId = 'rule-based';

export class PlannerProviderUnavailableError extends Error {
  constructor(readonly providerId: PlannerProviderId) {
    super(`Planner Provider ${providerId} is unavailable.`);
    this.name = 'PlannerProviderUnavailableError';
  }
}

/** Selecting an unavailable optional Provider is an explicit error, never a fallback. */
export function selectPlannerProvider(
  providers: { openai?: PlannerProvider; ruleBased: PlannerProvider },
  preferredId: PlannerProviderId = DEFAULT_PLANNER_PROVIDER_ID,
): PlannerProvider {
  if (preferredId === 'rule-based') return providers.ruleBased;
  if (providers.openai) return providers.openai;
  throw new PlannerProviderUnavailableError(preferredId);
}
