import type { PlannerInput, PlannerProposal, PlannerValidationIssue } from './contracts';
import { generatePlannerProposal } from './generatePlannerProposal';
import { loadPlannerInput, type PlannerInputDependencies } from './loadPlannerInput';
import type { PlannerProvider } from './providers/PlannerProvider';
import type {
  PlannerPlanSnapshot,
  PlannerReplanRepository,
} from './repositories/PlannerReplanRepository';

export { PlannerPreviewCalendarPermissionError } from './loadPlannerInput';
export type {
  PlannerPreviewGoalRepository,
  PlannerPreviewTaskRepository,
} from './loadPlannerInput';

export type GeneratePlannerPreviewInput = PlannerInputDependencies & {
  provider: PlannerProvider;
  replanRepository?: PlannerReplanRepository;
};

export type PlannerPreviewData = {
  expectedPlan?: PlannerPlanSnapshot;
  input: PlannerInput;
  proposal: PlannerProposal;
  timezone: string;
  warnings: PlannerValidationIssue[];
};

export type PlannerPreviewGenerationResult =
  | {
      issues: PlannerValidationIssue[];
      ok: false;
      warnings: PlannerValidationIssue[];
    }
  | ({ ok: true } & PlannerPreviewData);

export class PlannerPreviewProviderError extends Error {
  readonly code = 'PLANNER_PROVIDER_EXECUTION';

  constructor(readonly cause: unknown) {
    super('Planner Provider execution failed.');
    this.name = 'PlannerPreviewProviderError';
  }
}

export async function generatePlannerPreview({
  provider,
  replanRepository,
  ...dependencies
}: GeneratePlannerPreviewInput): Promise<PlannerPreviewGenerationResult> {
  const input = await loadPlannerInput(dependencies);
  // Capture before Provider execution; never substitute a newer token during approval.
  const expectedPlan = replanRepository
    ? await replanRepository.getSnapshot(input.date)
    : undefined;
  if (replanRepository && !expectedPlan) throw new Error('Today Plan no longer exists.');

  try {
    const validation = await generatePlannerProposal(provider, input);

    if (!validation.ok) {
      return {
        issues: validation.errors,
        ok: false,
        warnings: validation.warnings,
      };
    }

    return {
      ...(expectedPlan ? { expectedPlan } : {}),
      input,
      ok: true,
      proposal: validation.proposal,
      timezone: input.timezone,
      warnings: validation.warnings,
    };
  } catch (error) {
    throw new PlannerPreviewProviderError(error);
  }
}
