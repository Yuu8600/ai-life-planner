import { resolveTimeZone } from '@/features/today';

import type { PlannerPreviewData } from './plannerPreview';
import { validatePlannerProposal } from './plannerValidator';
import type {
  PlannerPersistenceRepository,
  SavePlannerProposalInput,
  SavedDailyPlan,
} from './repositories/PlannerPersistenceRepository';

export class PlannerPersistenceMappingError extends Error {
  readonly code = 'PLANNER_PERSISTENCE_MAPPING';

  constructor() {
    super('Planner Preview is inconsistent and cannot be saved.');
    this.name = 'PlannerPersistenceMappingError';
  }
}

export function toSavePlannerProposalInput({
  input,
  proposal,
  timezone,
}: PlannerPreviewData): SavePlannerProposalInput {
  const normalizedTimezone = resolveTimeZone(timezone);
  const validation = validatePlannerProposal(proposal, input);

  if (!validation.ok || normalizedTimezone !== resolveTimeZone(input.timezone)) {
    throw new PlannerPersistenceMappingError();
  }

  const validatedProposal = validation.proposal;

  return {
    actions: validatedProposal.actions.map((action) => ({
      endAt: action.endAt,
      reason: action.reason,
      startAt: action.startAt,
      taskId: action.taskId,
      title: action.title,
    })),
    planDate: validatedProposal.date,
    summary: validatedProposal.summary,
    timezone: normalizedTimezone,
  };
}

export function approvePlannerProposal(
  repository: PlannerPersistenceRepository,
  preview: PlannerPreviewData,
): Promise<SavedDailyPlan> {
  return repository.savePlan(toSavePlannerProposalInput(preview));
}
