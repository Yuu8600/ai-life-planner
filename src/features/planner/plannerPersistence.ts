import { resolveTimeZone } from '@/features/today';

import type { PlannerValidationIssue } from './contracts';
import {
  loadPlannerInput,
  PlannerInputDateChangedError,
  type PlannerInputDependencies,
} from './loadPlannerInput';
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

export class PlannerPreviewStaleError extends Error {
  readonly code = 'PLANNER_PREVIEW_STALE';

  constructor(readonly issues: PlannerValidationIssue[]) {
    super('Planner Preview is no longer valid against current data.');
    this.name = 'PlannerPreviewStaleError';
  }
}

export class PlannerApprovalCheckError extends Error {
  readonly code = 'PLANNER_APPROVAL_CHECK';

  constructor(readonly cause: unknown) {
    super('Current Planner input could not be loaded for approval.');
    this.name = 'PlannerApprovalCheckError';
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

export async function approvePlannerProposal(
  repository: PlannerPersistenceRepository,
  preview: PlannerPreviewData,
  dependencies: PlannerInputDependencies,
  isCurrent: () => boolean = () => true,
): Promise<SavedDailyPlan> {
  const input = await loadPlannerInput(dependencies).catch((error: unknown) => {
    if (error instanceof PlannerInputDateChangedError) {
      throw new PlannerPreviewStaleError([
        {
          code: 'PROPOSAL_DATE_MISMATCH',
          message: 'The profile-local date changed during approval.',
          path: 'date',
        },
      ]);
    }
    throw new PlannerApprovalCheckError(error);
  });
  const validation = validatePlannerProposal(preview.proposal, input);
  const issues = validation.ok ? [] : [...validation.errors];

  if (resolveTimeZone(preview.timezone) !== input.timezone) {
    issues.push({
      code: 'INVALID_INPUT',
      message: 'Profile timezone changed since Preview generation.',
      path: 'input.timezone',
    });
  }
  if (issues.length > 0) throw new PlannerPreviewStaleError(issues);

  // A retired confirmation must not save after regeneration, sign-out, or dependency changes.
  if (!isCurrent()) throw new Error('Planner approval was cancelled.');

  return repository.savePlan(
    toSavePlannerProposalInput({ ...preview, input, timezone: input.timezone }),
  );
}
