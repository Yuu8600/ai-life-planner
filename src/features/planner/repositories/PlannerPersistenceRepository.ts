import type { LocalDate } from '@/features/today';

export type SavePlannerActionInput = {
  endAt: string;
  reason: string;
  startAt: string;
  taskId: string | null;
  title: string;
};

export type SavePlannerProposalInput = {
  planningWindow?: { startAt: string; endAt: string };
  actions: readonly SavePlannerActionInput[];
  planDate: LocalDate;
  summary: string;
  timezone: string;
};

export type SavedDailyPlan = {
  actionCount: number;
  id: string;
  planDate: LocalDate;
};

export interface PlannerPersistenceRepository {
  savePlan(input: SavePlannerProposalInput): Promise<SavedDailyPlan>;
}
