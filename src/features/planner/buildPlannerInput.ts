import { addLocalDays, type LocalDate } from '@/features/today';

import type { PlannerCalendarEvent, PlannerGoal, PlannerInput } from './contracts';
import {
  selectPlannerTasks,
  type PlannerGoalSource,
  type PlannerTaskSource,
} from './selectPlannerTasks';
import type { FreeTimeCalculationResult } from './types';

export type PlannerCalendarEventSource = {
  allDay: boolean;
  allDayEndDate: string | null;
  allDayStartDate: string | null;
  endAt: string;
  startAt: string;
  title: string;
};

export type BuildPlannerInputInput = {
  calendarEvents: readonly PlannerCalendarEventSource[];
  date: LocalDate;
  freeTimeResult: FreeTimeCalculationResult;
  goals: readonly PlannerGoalSource[];
  tasks: readonly PlannerTaskSource[];
  timezone: string;
};

export class PlannerInputBuildError extends Error {
  readonly code = 'INVALID_PLANNER_INPUT_SOURCE';

  constructor(message: string) {
    super(message);
    this.name = 'PlannerInputBuildError';
  }
}

function toLocalDate(value: string, label: string): LocalDate {
  try {
    return addLocalDays(value, 0);
  } catch {
    throw new PlannerInputBuildError(`${label} must be a valid local date.`);
  }
}

function toPlannerCalendarEvent(event: PlannerCalendarEventSource): PlannerCalendarEvent {
  if (!event.allDay) {
    return {
      endAt: event.endAt,
      kind: 'timed',
      startAt: event.startAt,
      title: event.title,
    };
  }

  if (!event.allDayStartDate || !event.allDayEndDate) {
    throw new PlannerInputBuildError('All-day Calendar event must have an exclusive date range.');
  }

  const startDate = toLocalDate(event.allDayStartDate, 'All-day Calendar event start date');
  const endDate = toLocalDate(event.allDayEndDate, 'All-day Calendar event end date');

  if (startDate >= endDate) {
    throw new PlannerInputBuildError('All-day Calendar event must have an exclusive date range.');
  }

  return {
    endDate,
    kind: 'allDay',
    startDate,
    title: event.title,
  };
}

function toPlannerGoal(goal: PlannerGoalSource): PlannerGoal {
  return {
    currentValue: goal.currentValue,
    deadline: goal.deadline ? toLocalDate(goal.deadline, 'Goal deadline') : null,
    description: goal.description,
    id: goal.id,
    priority: goal.priority,
    targetValue: goal.targetValue,
    title: goal.title,
    unit: goal.unit,
  };
}

export function buildPlannerInput({
  calendarEvents,
  date,
  freeTimeResult,
  goals,
  tasks,
  timezone,
}: BuildPlannerInputInput): PlannerInput {
  return {
    calendarEvents: calendarEvents.map(toPlannerCalendarEvent),
    date,
    freeSlots: freeTimeResult.freeSlots,
    goals: goals.filter((goal) => goal.status === 'active').map(toPlannerGoal),
    planningWindow: freeTimeResult.planningWindow,
    tasks: selectPlannerTasks({
      date,
      freeSlots: freeTimeResult.freeSlots,
      goals,
      tasks,
      timezone,
    }),
    timezone,
  };
}
