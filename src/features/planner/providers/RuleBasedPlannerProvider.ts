import type { PlannerInput } from '../contracts';
import { schedulePlannerTasks } from '../schedulePlannerTasks';
import type { PlannerProvider } from './PlannerProvider';

export class RuleBasedPlannerProvider implements PlannerProvider {
  readonly id = 'rule-based';

  async generate(input: PlannerInput): Promise<unknown> {
    return schedulePlannerTasks(input);
  }
}
