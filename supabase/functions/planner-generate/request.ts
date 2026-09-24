/** Server-side wire mirror of the provider-neutral PlannerInput contract. */
export type PlannerInputRequest = {
  calendarEvents: (
    | { endAt: string; kind: 'timed'; startAt: string; title: string }
    | { endDate: string; kind: 'allDay'; startDate: string; title: string }
  )[];
  date: string;
  freeSlots: { durationMinutes: number; endAt: string; startAt: string }[];
  goals: {
    currentValue: number | null;
    deadline: string | null;
    description: string | null;
    id: string;
    priority: 'high' | 'low' | 'medium';
    targetValue: number | null;
    title: string;
    unit: string | null;
  }[];
  planningWindow: { endAt: string; startAt: string };
  tasks: {
    deadline: string | null;
    estimatedMinutes: number;
    goalId: string | null;
    id: string;
    priority: 'high' | 'low' | 'medium';
    status: 'pending' | 'scheduled';
    title: string;
  }[];
  timezone: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function localDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function instant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function interval(value: unknown): value is { endAt: string; startAt: string } {
  return (
    record(value) &&
    exactKeys(value, ['startAt', 'endAt']) &&
    instant(value.startAt) &&
    instant(value.endAt) &&
    Date.parse(value.startAt) < Date.parse(value.endAt)
  );
}

function freeSlot(value: unknown): boolean {
  if (!record(value) || !exactKeys(value, ['startAt', 'endAt', 'durationMinutes'])) return false;
  return (
    interval({ startAt: value.startAt, endAt: value.endAt }) &&
    typeof value.durationMinutes === 'number' &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes > 0
  );
}

function calendarEvent(value: unknown): boolean {
  if (!record(value) || typeof value.title !== 'string') return false;
  if (value.kind === 'timed') {
    return (
      exactKeys(value, ['kind', 'title', 'startAt', 'endAt']) &&
      interval({ startAt: value.startAt, endAt: value.endAt })
    );
  }
  return (
    value.kind === 'allDay' &&
    exactKeys(value, ['kind', 'title', 'startDate', 'endDate']) &&
    localDate(value.startDate) &&
    localDate(value.endDate) &&
    value.startDate < value.endDate
  );
}

function priority(value: unknown): boolean {
  return value === 'high' || value === 'medium' || value === 'low';
}

function uuid(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function goal(value: unknown): boolean {
  return (
    record(value) &&
    exactKeys(value, [
      'id',
      'title',
      'description',
      'deadline',
      'priority',
      'targetValue',
      'currentValue',
      'unit',
    ]) &&
    uuid(value.id) &&
    text(value.title) &&
    (value.description === null || typeof value.description === 'string') &&
    (value.deadline === null || localDate(value.deadline)) &&
    priority(value.priority) &&
    (value.targetValue === null || typeof value.targetValue === 'number') &&
    (value.currentValue === null || typeof value.currentValue === 'number') &&
    (value.unit === null || typeof value.unit === 'string')
  );
}

function task(value: unknown): boolean {
  return (
    record(value) &&
    exactKeys(value, [
      'id',
      'title',
      'goalId',
      'estimatedMinutes',
      'deadline',
      'priority',
      'status',
    ]) &&
    uuid(value.id) &&
    text(value.title) &&
    (value.goalId === null || uuid(value.goalId)) &&
    Number.isSafeInteger(value.estimatedMinutes) &&
    (value.estimatedMinutes as number) > 0 &&
    (value.deadline === null || localDate(value.deadline)) &&
    priority(value.priority) &&
    (value.status === 'pending' || value.status === 'scheduled')
  );
}

export function isPlannerInputRequest(value: unknown): value is PlannerInputRequest {
  if (
    !record(value) ||
    !exactKeys(value, [
      'date',
      'timezone',
      'planningWindow',
      'freeSlots',
      'calendarEvents',
      'goals',
      'tasks',
    ]) ||
    !localDate(value.date) ||
    !text(value.timezone) ||
    !interval(value.planningWindow) ||
    !Array.isArray(value.freeSlots) ||
    !Array.isArray(value.calendarEvents) ||
    !Array.isArray(value.goals) ||
    !Array.isArray(value.tasks)
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.timezone });
  } catch {
    return false;
  }

  const windowStart = Date.parse(value.planningWindow.startAt);
  const windowEnd = Date.parse(value.planningWindow.endAt);
  return (
    value.freeSlots.every(
      (slot) =>
        freeSlot(slot) &&
        windowStart <= Date.parse(slot.startAt) &&
        Date.parse(slot.endAt) <= windowEnd,
    ) &&
    value.calendarEvents.every(calendarEvent) &&
    value.goals.every(goal) &&
    value.tasks.every(task)
  );
}
