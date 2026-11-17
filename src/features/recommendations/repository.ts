export const EFFORT_OPTIONS = [
  { value: 'light', label: '軽め' },
  { value: 'normal', label: 'ふつう' },
  { value: 'focus', label: '集中できる' },
] as const;

export type Effort = (typeof EFFORT_OPTIONS)[number]['value'];
export type AvailableMinutes = 15 | 30 | 60;
export type TargetKind = 'task' | 'step';
export type Outcome = 'completed' | 'skipped';
export type Conditions = { minutes: AvailableMinutes; effort: Effort };

export const DEFAULT_CONDITIONS: Conditions = { minutes: 30, effort: 'normal' };

export type StepInput = {
  title: string;
  minutes: number | null;
  effort: Effort | null;
  repeatable: boolean;
};

export type ActionStep = StepInput & {
  id: string;
  taskId: string;
  completed: boolean;
  createdAt: string;
};

export type RecommendationResult = {
  date: string;
  kind: TargetKind;
  targetId: string;
  taskId: string;
  goalId: string | null;
  title: string;
  outcome: Outcome;
};

export interface RecommendationRepository {
  listSteps(taskId?: string): Promise<ActionStep[]>;
  listResults(from: string, through: string): Promise<RecommendationResult[]>;
  addStep(taskId: string, input: StepInput): Promise<ActionStep>;
  updateStep(id: string, input: StepInput): Promise<ActionStep>;
  removeStep(id: string): Promise<void>;
  undo(date: string, kind: TargetKind, id: string, expected: Outcome | 'reopen'): Promise<void>;
  record(date: string, kind: TargetKind, id: string, outcome: Outcome): Promise<Outcome>;
}

export function isEffort(value: unknown): value is Effort {
  return EFFORT_OPTIONS.some((option) => option.value === value);
}
