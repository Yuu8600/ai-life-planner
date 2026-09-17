import type { PlannerInput } from '../contracts';

export interface PlannerProvider {
  readonly id: string;
  generate(input: PlannerInput): Promise<unknown>;
}
