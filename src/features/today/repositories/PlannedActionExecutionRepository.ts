export type ActionExecutionStatus = 'completed' | 'skipped';

export type ExecutePlannedActionInput = {
  actionId: string;
  targetStatus: ActionExecutionStatus;
};

/** Atomic write boundary, intentionally separate from the Today read model. */
export interface PlannedActionExecutionRepository {
  transition(input: ExecutePlannedActionInput): Promise<void>;
}
