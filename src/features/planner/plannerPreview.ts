import type { CalendarPermissionStatus, CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';
import { getLocalDate, getUtcDayBounds, resolveTimeZone } from '@/features/today';

import { buildPlannerInput } from './buildPlannerInput';
import { clipPlannerFreeSlots } from './clipPlannerFreeSlots';
import type { PlannerInput, PlannerProposal, PlannerValidationIssue } from './contracts';
import { calculateFreeTime } from './freeTimeCalculator';
import { generatePlannerProposal } from './generatePlannerProposal';
import type { PlannerProvider } from './providers/PlannerProvider';
import type { PlannerGoalSource, PlannerTaskSource } from './selectPlannerTasks';

export type PlannerPreviewGoalRepository = {
  list(): Promise<PlannerGoalSource[]>;
};

export type PlannerPreviewTaskRepository = {
  list(): Promise<PlannerTaskSource[]>;
};

export type GeneratePlannerPreviewInput = {
  calendarRepository: CalendarRepository;
  goalRepository: PlannerPreviewGoalRepository;
  now?: () => Date;
  provider: PlannerProvider;
  settingsRepository: SettingsRepository;
  taskRepository: PlannerPreviewTaskRepository;
};

export type PlannerPreviewData = {
  input: PlannerInput;
  proposal: PlannerProposal;
  timezone: string;
  warnings: PlannerValidationIssue[];
};

export type PlannerPreviewGenerationResult =
  | {
      issues: PlannerValidationIssue[];
      ok: false;
      warnings: PlannerValidationIssue[];
    }
  | ({ ok: true } & PlannerPreviewData);

export class PlannerPreviewCalendarPermissionError extends Error {
  readonly code = 'PLANNER_CALENDAR_PERMISSION';

  constructor(readonly status: Exclude<CalendarPermissionStatus, 'granted'>) {
    super('Calendar permission is required to generate a Planner preview.');
    this.name = 'PlannerPreviewCalendarPermissionError';
  }
}

export class PlannerPreviewProviderError extends Error {
  readonly code = 'PLANNER_PROVIDER_EXECUTION';

  constructor(readonly cause: unknown) {
    super('Planner Provider execution failed.');
    this.name = 'PlannerPreviewProviderError';
  }
}

const getCurrentDate = () => new Date();

export async function generatePlannerPreview({
  calendarRepository,
  goalRepository,
  now = getCurrentDate,
  provider,
  settingsRepository,
  taskRepository,
}: GeneratePlannerPreviewInput): Promise<PlannerPreviewGenerationResult> {
  const [settings, permission] = await Promise.all([
    settingsRepository.getProfilePlanningSettings(),
    calendarRepository.getPermission(),
  ]);
  const timezone = resolveTimeZone(settings.timezone);
  const currentInstant = now();
  const date = getLocalDate(currentInstant, timezone);

  if (permission.status !== 'granted') {
    throw new PlannerPreviewCalendarPermissionError(permission.status);
  }

  const [calendarResult, goals, tasks] = await Promise.all([
    calendarRepository.listEvents(getUtcDayBounds(date, timezone), date),
    goalRepository.list(),
    taskRepository.list(),
  ]);
  const freeTimeResult = calculateFreeTime({
    events: calendarResult.events,
    minimumFreeMinutes: settings.minimumFreeMinutes,
    planningEnd: settings.planningEnd,
    planningStart: settings.planningStart,
    selectedDate: date,
    timezone,
  });
  const plannerFreeTimeResult = {
    ...freeTimeResult,
    freeSlots: clipPlannerFreeSlots({
      date,
      freeSlots: freeTimeResult.freeSlots,
      minimumFreeMinutes: settings.minimumFreeMinutes,
      now: currentInstant,
      timezone,
    }),
  };
  const input = buildPlannerInput({
    calendarEvents: calendarResult.events,
    date,
    freeTimeResult: plannerFreeTimeResult,
    goals,
    tasks,
    timezone,
  });

  try {
    const validation = await generatePlannerProposal(provider, input);

    if (!validation.ok) {
      return {
        issues: validation.errors,
        ok: false,
        warnings: validation.warnings,
      };
    }

    return {
      input,
      ok: true,
      proposal: validation.proposal,
      timezone,
      warnings: validation.warnings,
    };
  } catch (error) {
    throw new PlannerPreviewProviderError(error);
  }
}
