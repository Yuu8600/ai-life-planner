import {
  loadCalendarPlanningEvents,
  type CalendarEventBufferRepository,
  type CalendarRepository,
} from '@/features/calendar';
import { getPlanningWindow } from '@/features/today';
import { calculateFreeTime } from '../index';
import { changeDailyPlan, createDailyPlan } from './engine';
import { PlanConflictError, type DailyPlanningRepository } from './repository';
import type { DailyPlan, DayInput, PlanChange } from './types';

export type DailyPlanningDependencies = {
  repository: DailyPlanningRepository;
  calendar: CalendarRepository;
  buffers?: CalendarEventBufferRepository;
  now?: () => number;
};

export async function loadDay(
  deps: DailyPlanningDependencies,
  date: string,
  allowLimited: boolean,
) {
  const snapshot = await deps.repository.load(date);
  const settings = snapshot.settings;
  const timezone = snapshot.saved?.plan.timezone ?? settings.timezone;
  const window = snapshot.saved?.plan.window ?? getPlanningWindow(date, settings);
  let external: DayInput['busy'] = [];
  let calendarError: string | null = null;
  try {
    const permission = await deps.calendar.getPermission();
    if (permission.status !== 'granted') {
      calendarError = 'iPhoneカレンダーの読み取りを許可してください。';
    } else {
      const events = await loadCalendarPlanningEvents(
        deps.calendar,
        date,
        timezone,
        settings.calendarBufferBeforeMinutes,
        settings.calendarBufferAfterMinutes,
        deps.buffers,
        settings.planningEndDayOffset,
      );
      external = calculateFreeTime({
        ...settings,
        events: events.calculationEvents,
        calendarEventBufferOverrides: events.overrides,
        selectedDate: date,
        timezone,
      }).busyIntervals;
    }
  } catch {
    calendarError = 'iPhoneカレンダーの取得に失敗しました。';
  }
  const busy = [
    ...external,
    ...snapshot.events.flatMap((item) =>
      item.kind === 'fixed'
        ? [
            {
              startAt: new Date(Date.parse(item.startAt) - item.before * 60_000).toISOString(),
              endAt: new Date(Date.parse(item.endAt) + item.after * 60_000).toISOString(),
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt));
  const input: DayInput = {
    date,
    timezone,
    window,
    busy,
    tasks: snapshot.tasks,
    gap: snapshot.gap,
    history: snapshot.history,
    limited: calendarError !== null,
    now: (deps.now ?? Date.now)(),
    flexible: snapshot.events.filter((item) => item.kind === 'flexible'),
  };
  return {
    ...snapshot,
    input,
    calendarError,
    allowed: !calendarError || allowLimited,
    calendarRevision: JSON.stringify([calendarError, busy]),
  };
}

export type LoadedDay = Awaited<ReturnType<typeof loadDay>>;
export type PlanPreview = {
  change: PlanChange;
  revision: string;
  source: string;
  calendarRevision: string;
  plan: DailyPlan;
};

export async function generateFirstPlan(deps: DailyPlanningDependencies, day: LoadedDay) {
  if (!day.allowed || day.saved || Date.parse(day.input.window.endAt) <= day.input.now) return day;
  const initial = createDailyPlan(day.input);
  try {
    await deps.repository.save(initial.date, null, day.source, initial);
  } catch (error) {
    if (!(error instanceof PlanConflictError)) throw error;
  }
  return loadDay(deps, initial.date, day.input.limited);
}

export function previewPlan(day: LoadedDay, change: PlanChange): PlanPreview {
  if (!day.saved) throw new Error('計画を開いてください。');
  if (
    !day.allowed &&
    change.kind !== 'complete' &&
    change.kind !== 'skip' &&
    change.kind !== 'unlock'
  )
    throw new Error('カレンダー未取得のため、限定モードを選択してください。');
  return {
    change,
    revision: day.saved.revision,
    source: day.source,
    calendarRevision: day.calendarRevision,
    plan: changeDailyPlan(day.input, day.saved.plan, change),
  };
}

export async function approvePlan(
  deps: DailyPlanningDependencies,
  preview: PlanPreview,
  allowLimited: boolean,
) {
  const day = await loadDay(deps, preview.plan.date, allowLimited);
  if (
    day.saved?.revision !== preview.revision ||
    day.source !== preview.source ||
    day.calendarRevision !== preview.calendarRevision
  )
    throw new PlanConflictError();
  const next = previewPlan(day, preview.change);
  if (JSON.stringify(next.plan) !== JSON.stringify(preview.plan)) throw new PlanConflictError();
  await deps.repository.save(next.plan.date, preview.revision, day.source, next.plan);
}
