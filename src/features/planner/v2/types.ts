import type { PlannerAction, PlannerPriority, TimeInterval } from '../index';

export type Recurrence = 'once' | 'daily' | 'weekdays' | 'weekly';

export type PlanningTask = {
  id: string;
  title: string;
  goalId: string | null;
  priority: PlannerPriority;
  deadline: string | null;
  duration: number;
  completed: boolean;
  recurrence: Recurrence;
  weekdays: readonly number[];
  createdAt: string;
};

export type FixedEvent = TimeInterval & { id: string; title: string };
export type FlexibleEvent = FixedEvent & { duration: number };
export type WorkStatus = 'scheduled' | 'completed' | 'skipped' | 'deferred';
export type WorkSession = Omit<PlannerAction, 'taskId'> & {
  id: string;
  taskId: string;
  status: WorkStatus;
  locked: boolean;
};

export type DailyPlan = {
  date: string;
  timezone: string;
  window: TimeInterval;
  sessions: WorkSession[];
  lifestyle: FixedEvent[];
  leisure: TimeInterval[];
  unplaced: { taskId: string; reason: string }[];
  warnings: string[];
  limited: boolean;
};

export type DayInput = {
  date: string;
  timezone: string;
  now: number;
  window: TimeInterval;
  busy: readonly TimeInterval[];
  flexible: readonly FlexibleEvent[];
  tasks: readonly PlanningTask[];
  history: readonly Pick<DailyPlan, 'date' | 'sessions'>[];
  gap: number;
  limited: boolean;
};

export type PlanChange =
  | { kind: 'move'; id: string; interval: TimeInterval }
  | { kind: 'unlock' | 'complete' | 'skip' | 'later'; id: string }
  | { kind: 'replan'; taskId?: string };
