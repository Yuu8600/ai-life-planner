import type { LocalDate } from '@/features/today';

import type { FreeTimeSlot, TimeInterval } from './types';

export type PlannerPriority = 'high' | 'low' | 'medium';

export type PlannerCalendarEvent =
  | {
      endAt: string;
      kind: 'timed';
      startAt: string;
      title: string;
    }
  | {
      endDate: LocalDate;
      kind: 'allDay';
      startDate: LocalDate;
      title: string;
    };

export type PlannerGoal = {
  currentValue: number | null;
  deadline: LocalDate | null;
  description: string | null;
  id: string;
  priority: PlannerPriority;
  targetValue: number | null;
  title: string;
  unit: string | null;
};

export type PlannerTask = {
  deadline: string | null;
  estimatedMinutes: number;
  goalId: string | null;
  id: string;
  priority: PlannerPriority;
  status: 'pending' | 'scheduled';
  title: string;
};

export type PlannerInput = {
  /** Context only. Providers and validators must not derive availability from these events. */
  calendarEvents: readonly PlannerCalendarEvent[];
  date: LocalDate;
  /** The authoritative intervals in which new actions may be placed. */
  freeSlots: readonly FreeTimeSlot[];
  goals: readonly PlannerGoal[];
  planningWindow: TimeInterval;
  tasks: readonly PlannerTask[];
  timezone: string;
};

export type PlannerAction = {
  endAt: string;
  reason: string;
  startAt: string;
  taskId: string | null;
  title: string;
};

export type PlannerUnscheduledTask = {
  reason: string;
  taskId: string;
};

export type PlannerProposal = {
  actions: PlannerAction[];
  date: LocalDate;
  summary: string;
  unscheduled: PlannerUnscheduledTask[];
};

export type PlannerValidationIssueCode =
  | 'ACTION_OUTSIDE_FREE_SLOT'
  | 'ACTION_OUTSIDE_PLANNING_WINDOW'
  | 'DUPLICATE_TASK_SCHEDULING'
  | 'EMPTY_TEXT'
  | 'ESTIMATED_MINUTES_MISMATCH'
  | 'INVALID_INPUT'
  | 'INVALID_STRUCTURE'
  | 'INVALID_TASK_ID'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_TIMESTAMP'
  | 'OVERLAPPING_ACTIONS'
  | 'PROPOSAL_DATE_MISMATCH'
  | 'TASK_COVERAGE'
  | 'TASK_SCHEDULED_AND_UNSCHEDULED'
  | 'UNKNOWN_TASK';

export type PlannerValidationIssue = {
  code: PlannerValidationIssueCode;
  message: string;
  path: string;
};

export type PlannerValidationResult =
  | {
      errors: PlannerValidationIssue[];
      ok: false;
      warnings: PlannerValidationIssue[];
    }
  | {
      ok: true;
      proposal: PlannerProposal;
      warnings: PlannerValidationIssue[];
    };
