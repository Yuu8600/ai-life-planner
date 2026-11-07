import {
  loadCalendarPlanningEvents,
  type CalendarPermissionStatus,
  type CalendarRepository,
  type CalendarEventBufferRepository,
} from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';
import { getLocalDate, resolveTimeZone } from '@/features/today';

import { buildPlannerInput } from './buildPlannerInput';
import { clipPlannerFreeSlots } from './clipPlannerFreeSlots';
import type { PlannerInput } from './contracts';
import { calculateFreeTime } from './freeTimeCalculator';
import type { PlannerGoalSource, PlannerTaskSource } from './selectPlannerTasks';

export type PlannerPreviewGoalRepository = {
  list(): Promise<PlannerGoalSource[]>;
};

export type PlannerPreviewTaskRepository = {
  list(): Promise<PlannerTaskSource[]>;
};

export type PlannerInputDependencies = {
  eventBufferRepository?: CalendarEventBufferRepository | null;
  calendarRepository: CalendarRepository;
  goalRepository: PlannerPreviewGoalRepository;
  now?: () => Date;
  settingsRepository: SettingsRepository;
  taskRepository: PlannerPreviewTaskRepository;
};

export class PlannerPreviewCalendarPermissionError extends Error {
  readonly code = 'PLANNER_CALENDAR_PERMISSION';

  constructor(readonly status: Exclude<CalendarPermissionStatus, 'granted'>) {
    super('Calendar permission is required to generate a Planner preview.');
    this.name = 'PlannerPreviewCalendarPermissionError';
  }
}

export class PlannerInputDateChangedError extends Error {
  constructor() {
    super('The profile-local date changed while loading Planner data.');
    this.name = 'PlannerInputDateChangedError';
  }
}

const getCurrentDate = () => new Date();

/** Load the current Today input for both generation and approval, without executing a Provider. */
export async function loadPlannerInput({
  eventBufferRepository,
  calendarRepository,
  goalRepository,
  now = getCurrentDate,
  settingsRepository,
  taskRepository,
}: PlannerInputDependencies): Promise<PlannerInput> {
  const [settings, permission] = await Promise.all([
    settingsRepository.getProfilePlanningSettings(),
    calendarRepository.getPermission(),
  ]);
  const timezone = resolveTimeZone(settings.timezone);
  const date = getLocalDate(now(), timezone);

  if (permission.status !== 'granted') {
    throw new PlannerPreviewCalendarPermissionError(permission.status);
  }

  const [calendarResult, goals, tasks] = await Promise.all([
    loadCalendarPlanningEvents(
      calendarRepository,
      date,
      timezone,
      settings.calendarBufferBeforeMinutes,
      settings.calendarBufferAfterMinutes,
      eventBufferRepository,
    ),
    goalRepository.list(),
    taskRepository.list(),
  ]);
  const currentInstant = now();
  if (getLocalDate(currentInstant, timezone) !== date) throw new PlannerInputDateChangedError();
  const freeTimeResult = calculateFreeTime({
    events: calendarResult.calculationEvents,
    calendarEventBufferOverrides: calendarResult.overrides,
    calendarBufferBeforeMinutes: settings.calendarBufferBeforeMinutes,
    calendarBufferAfterMinutes: settings.calendarBufferAfterMinutes,
    minimumFreeMinutes: settings.minimumFreeMinutes,
    planningEnd: settings.planningEnd,
    planningStart: settings.planningStart,
    selectedDate: date,
    timezone,
  });

  return buildPlannerInput({
    calendarEvents: calendarResult.events,
    date,
    freeTimeResult: {
      ...freeTimeResult,
      freeSlots: clipPlannerFreeSlots({
        date,
        freeSlots: freeTimeResult.freeSlots,
        minimumFreeMinutes: settings.minimumFreeMinutes,
        now: currentInstant,
        timezone,
      }),
    },
    goals,
    tasks,
    timezone,
  });
}
