import type { PlannerInput, PlannerValidationResult } from './contracts';
import type { PlannerProvider } from './providers/PlannerProvider';
import { validatePlannerProposal } from './plannerValidator';

export async function generatePlannerProposal(
  provider: PlannerProvider,
  input: PlannerInput,
): Promise<PlannerValidationResult> {
  const candidate = await provider.generate(input);
  return validatePlannerProposal(candidate, input);
}
