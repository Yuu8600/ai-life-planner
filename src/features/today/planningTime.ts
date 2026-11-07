import {
  addLocalDays,
  getLocalDate,
  getUtcInstantForLocalTime,
  formatLocalTimeJa,
  InvalidLocalTimeError,
} from './timezone';
export type PlanningTimeSettings = {
  planningStart: string;
  planningEnd: string;
  planningEndDayOffset?: number;
  timezone: string;
};
export function validatePlanningTimes(settings: PlanningTimeSettings): void {
  const { planningStart, planningEnd, planningEndDayOffset = 0 } = settings;
  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(planningStart) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(planningEnd) ||
    (planningEndDayOffset !== 0 && planningEndDayOffset !== 1)
  )
    throw new Error('Invalid planning times');
  const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
  const duration = planningEndDayOffset * 1440 + minutes(planningEnd) - minutes(planningStart);
  if (duration <= 0 || duration > 1440)
    throw new Error('Planning duration must be greater than zero and at most 24 hours');
}
/** Reject gaps and folds rather than choose a different instant on client and DB. */
export function getPlanningInstant(date: string, time: string, timezone: string): string {
  const initial = Date.parse(getUtcInstantForLocalTime(date, time, timezone));
  const wall = Date.parse(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (const delta of [-2, 0, 2]) {
    const probe = initial + delta * 86400000;
    const parts = new Map(formatter.formatToParts(probe).map(({ type, value }) => [type, value]));
    const local = Date.parse(
      `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}:${parts.get('second')}Z`,
    );
    const alternate = wall - (local - probe);
    if (
      alternate !== initial &&
      getLocalDate(alternate, timezone) === date &&
      formatLocalTimeJa(alternate, timezone) === time
    )
      throw new InvalidLocalTimeError();
  }
  return new Date(initial).toISOString();
}
export function getPlanningWindow(date: string, settings: PlanningTimeSettings) {
  validatePlanningTimes(settings);
  const startAt = getPlanningInstant(date, settings.planningStart, settings.timezone);
  const endAt = getPlanningInstant(
    addLocalDays(date, settings.planningEndDayOffset ?? 0),
    settings.planningEnd,
    settings.timezone,
  );
  const duration = Date.parse(endAt) - Date.parse(startAt);
  if (duration <= 0) throw new Error('Planning window must be greater than zero');
  return { startAt, endAt };
}
export function getPlanningDate(now: Date, settings: PlanningTimeSettings) {
  validatePlanningTimes(settings);
  const calendarDate = getLocalDate(now, settings.timezone);
  return settings.planningEndDayOffset === 1 &&
    formatLocalTimeJa(now, settings.timezone) < settings.planningEnd
    ? addLocalDays(calendarDate, -1)
    : calendarDate;
}

export function formatPlanningTime(instant: string, date: string, timezone: string): string {
  const localDate = getLocalDate(instant, timezone);
  const time = formatLocalTimeJa(instant, timezone);
  return localDate === date
    ? time
    : `${localDate === addLocalDays(date, 1) ? '翌日' : localDate} ${time}`;
}
