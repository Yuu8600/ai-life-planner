import type {
  ActionExecutionStatus,
  PlannedActionExecutionRepository,
} from './repositories/PlannedActionExecutionRepository';
import type { TodayPlannedAction } from './repositories/TodayRepository';

export async function executePlannedAction(
  repository: PlannedActionExecutionRepository,
  action: Pick<TodayPlannedAction, 'id' | 'status'>,
  targetStatus: ActionExecutionStatus,
): Promise<void> {
  if (
    !action.id.trim() ||
    (targetStatus !== 'completed' && targetStatus !== 'skipped') ||
    (action.status !== 'scheduled' && action.status !== targetStatus)
  ) {
    throw new Error('Unsupported Action execution transition.');
  }
  // Even a replay crosses the authenticated DB boundary; the RPC owns idempotency.
  await repository.transition({ actionId: action.id, targetStatus });
}
