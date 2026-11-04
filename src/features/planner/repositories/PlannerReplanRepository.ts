import type { LocalDate } from '@/features/today';

import type { SavePlannerProposalInput, SavedDailyPlan } from './PlannerPersistenceRepository';

/** Application-only concurrency token. Timestamps retain PostgreSQL precision as opaque strings. */
export type PlannerPlanSnapshot = {
  id: string;
  planDate: LocalDate;
  summary: string | null;
  timezone: string;
  updatedAt: string;
  actions: { id: string; status: 'scheduled' | 'completed' | 'skipped'; updatedAt: string }[];
};

export class PlannerReplanConflictError extends Error {
  constructor() {
    super('The Plan or a proposed Task changed before replacement.');
    this.name = 'PlannerReplanConflictError';
  }
}

export interface PlannerReplanRepository {
  getSnapshot(date: LocalDate): Promise<PlannerPlanSnapshot | null>;
  replaceIfCurrent(
    input: SavePlannerProposalInput,
    expected: PlannerPlanSnapshot,
  ): Promise<SavedDailyPlan>;
}
