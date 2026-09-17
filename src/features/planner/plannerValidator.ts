import type {
  PlannerAction,
  PlannerInput,
  PlannerProposal,
  PlannerTask,
  PlannerUnscheduledTask,
  PlannerValidationIssue,
  PlannerValidationIssueCode,
  PlannerValidationResult,
} from './contracts';

const MILLISECONDS_PER_MINUTE = 60 * 1_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC_3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NumericInterval = {
  end: number;
  start: number;
};

type ParsedInstant = {
  iso: string;
  value: number;
};

type ValidatedAction = {
  action: PlannerAction;
  end: number;
  index: number;
  start: number;
};

function issue(
  code: PlannerValidationIssueCode,
  path: string,
  message: string,
): PlannerValidationIssue {
  return { code, message, path };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseRfc3339Instant(value: string): ParsedInstant | null {
  const match = RFC_3339_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? '').padEnd(3, '0') || '0');
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);

  if (
    year < 100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const localValue = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const localDate = new Date(localValue);

  if (
    localDate.getUTCFullYear() !== year ||
    localDate.getUTCMonth() !== month - 1 ||
    localDate.getUTCDate() !== day ||
    localDate.getUTCHours() !== hour ||
    localDate.getUTCMinutes() !== minute ||
    localDate.getUTCSeconds() !== second ||
    localDate.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  const offsetSign = match[8] === 'Z' ? 0 : match[9] === '+' ? 1 : -1;
  const offset = offsetSign * (offsetHour * 60 + offsetMinute) * MILLISECONDS_PER_MINUTE;
  const instant = localValue - offset;

  if (!Number.isFinite(instant)) return null;

  return {
    iso: new Date(instant).toISOString(),
    value: instant,
  };
}

function readCandidateInstant(
  value: unknown,
  path: string,
  errors: PlannerValidationIssue[],
): ParsedInstant | null {
  if (typeof value !== 'string') {
    errors.push(issue('INVALID_STRUCTURE', path, 'Timestamp must be a string.'));
    return null;
  }

  const parsed = parseRfc3339Instant(value);
  if (!parsed) {
    errors.push(
      issue(
        'INVALID_TIMESTAMP',
        path,
        'Timestamp must be a valid RFC 3339 instant with an offset.',
      ),
    );
  }
  return parsed;
}

function readInputInterval(
  startAt: string,
  endAt: string,
  path: string,
  errors: PlannerValidationIssue[],
): NumericInterval | null {
  const start = parseRfc3339Instant(startAt);
  const end = parseRfc3339Instant(endAt);

  if (!start || !end || start.value >= end.value) {
    errors.push(issue('INVALID_INPUT', path, 'Planner input contains an invalid time interval.'));
    return null;
  }

  return { end: end.value, start: start.value };
}

function readNonEmptyText(
  value: unknown,
  path: string,
  errors: PlannerValidationIssue[],
): string | null {
  if (typeof value !== 'string') {
    errors.push(issue('INVALID_STRUCTURE', path, 'Value must be a string.'));
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    errors.push(issue('EMPTY_TEXT', path, 'Value must not be empty.'));
    return null;
  }
  return normalized;
}

function createTaskMap(
  input: PlannerInput,
  errors: PlannerValidationIssue[],
): Map<string, PlannerTask> {
  const tasks = new Map<string, PlannerTask>();

  input.tasks.forEach((task, index) => {
    const key = task.id.toLowerCase();

    if (!UUID_PATTERN.test(task.id)) {
      errors.push(
        issue('INVALID_INPUT', `input.tasks[${index}].id`, 'Planner input task id is invalid.'),
      );
      return;
    }

    if (tasks.has(key)) {
      errors.push(
        issue(
          'INVALID_INPUT',
          `input.tasks[${index}].id`,
          'Planner input task ids must be unique.',
        ),
      );
      return;
    }

    if (!Number.isSafeInteger(task.estimatedMinutes) || task.estimatedMinutes <= 0) {
      errors.push(
        issue(
          'INVALID_INPUT',
          `input.tasks[${index}].estimatedMinutes`,
          'Planner input estimated minutes must be a positive integer.',
        ),
      );
    }

    tasks.set(key, task);
  });

  return tasks;
}

function readTaskReference(
  value: unknown,
  path: string,
  tasks: ReadonlyMap<string, PlannerTask>,
  errors: PlannerValidationIssue[],
): string | null {
  if (typeof value !== 'string') {
    errors.push(issue('INVALID_STRUCTURE', path, 'Task id must be a string.'));
    return null;
  }

  if (!UUID_PATTERN.test(value)) {
    errors.push(issue('INVALID_TASK_ID', path, 'Task id must be a valid UUID.'));
    return null;
  }

  const task = tasks.get(value.toLowerCase());
  if (!task) {
    errors.push(issue('UNKNOWN_TASK', path, 'Task id does not exist in PlannerInput.tasks.'));
    return null;
  }

  return task.id;
}

function containsInterval(container: NumericInterval, candidate: NumericInterval): boolean {
  return container.start <= candidate.start && candidate.end <= container.end;
}

function overlaps(left: NumericInterval, right: NumericInterval): boolean {
  return left.start < right.end && right.start < left.end;
}

function validateAction(
  value: unknown,
  index: number,
  tasks: ReadonlyMap<string, PlannerTask>,
  planningWindow: NumericInterval | null,
  freeSlots: readonly NumericInterval[],
  errors: PlannerValidationIssue[],
  warnings: PlannerValidationIssue[],
): ValidatedAction | null {
  const path = `actions[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue('INVALID_STRUCTURE', path, 'Action must be an object.'));
    return null;
  }

  const errorCount = errors.length;
  const title = readNonEmptyText(value.title, `${path}.title`, errors);
  const reason = readNonEmptyText(value.reason, `${path}.reason`, errors);
  const start = readCandidateInstant(value.startAt, `${path}.startAt`, errors);
  const end = readCandidateInstant(value.endAt, `${path}.endAt`, errors);
  let taskId: string | null = null;

  if (value.taskId !== null) {
    taskId = readTaskReference(value.taskId, `${path}.taskId`, tasks, errors);
  }

  if (start && end) {
    const interval = { end: end.value, start: start.value };

    if (start.value >= end.value) {
      errors.push(issue('INVALID_TIME_RANGE', path, 'Action startAt must be before endAt.'));
    } else if (planningWindow && !containsInterval(planningWindow, interval)) {
      errors.push(
        issue(
          'ACTION_OUTSIDE_PLANNING_WINDOW',
          path,
          'Action must be contained in the planning window.',
        ),
      );
    } else if (!freeSlots.some((slot) => containsInterval(slot, interval))) {
      errors.push(
        issue('ACTION_OUTSIDE_FREE_SLOT', path, 'Action must be contained in one free-time slot.'),
      );
    }

    if (taskId) {
      const task = tasks.get(taskId.toLowerCase());
      const durationMinutes = (end.value - start.value) / MILLISECONDS_PER_MINUTE;

      if (task && start.value < end.value && durationMinutes !== task.estimatedMinutes) {
        warnings.push(
          issue(
            'ESTIMATED_MINUTES_MISMATCH',
            path,
            `Action duration ${durationMinutes} does not match estimatedMinutes ${task.estimatedMinutes}.`,
          ),
        );
      }
    }
  }

  if (!title || !reason || !start || !end || errors.length > errorCount) return null;

  return {
    action: {
      endAt: end.iso,
      reason,
      startAt: start.iso,
      taskId,
      title,
    },
    end: end.value,
    index,
    start: start.value,
  };
}

function validateUnscheduledTask(
  value: unknown,
  index: number,
  tasks: ReadonlyMap<string, PlannerTask>,
  errors: PlannerValidationIssue[],
): PlannerUnscheduledTask | null {
  const path = `unscheduled[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue('INVALID_STRUCTURE', path, 'Unscheduled task must be an object.'));
    return null;
  }

  const errorCount = errors.length;
  const taskId = readTaskReference(value.taskId, `${path}.taskId`, tasks, errors);
  const reason = readNonEmptyText(value.reason, `${path}.reason`, errors);

  return taskId && reason && errors.length === errorCount ? { reason, taskId } : null;
}

function increment(counts: Map<string, number>, taskId: string): void {
  const key = taskId.toLowerCase();
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function validatePlannerProposal(
  candidate: unknown,
  input: PlannerInput,
): PlannerValidationResult {
  const errors: PlannerValidationIssue[] = [];
  const warnings: PlannerValidationIssue[] = [];
  const tasks = createTaskMap(input, errors);
  const planningWindow = readInputInterval(
    input.planningWindow.startAt,
    input.planningWindow.endAt,
    'input.planningWindow',
    errors,
  );
  const freeSlots = input.freeSlots.flatMap((slot, index) => {
    const interval = readInputInterval(
      slot.startAt,
      slot.endAt,
      `input.freeSlots[${index}]`,
      errors,
    );

    if (interval && planningWindow && !containsInterval(planningWindow, interval)) {
      errors.push(
        issue(
          'INVALID_INPUT',
          `input.freeSlots[${index}]`,
          'Planner input free-time slot must be inside the planning window.',
        ),
      );
      return [];
    }

    return interval ? [interval] : [];
  });

  if (!isValidLocalDate(input.date)) {
    errors.push(issue('INVALID_INPUT', 'input.date', 'Planner input date must be a valid date.'));
  }

  if (!isRecord(candidate)) {
    errors.push(issue('INVALID_STRUCTURE', '$', 'Planner proposal must be an object.'));
    return { errors, ok: false, warnings };
  }

  let proposalDate = input.date;
  if (typeof candidate.date !== 'string' || !isValidLocalDate(candidate.date)) {
    errors.push(
      issue('INVALID_STRUCTURE', 'date', 'Proposal date must be a valid YYYY-MM-DD date.'),
    );
  } else if (candidate.date !== input.date) {
    errors.push(
      issue('PROPOSAL_DATE_MISMATCH', 'date', 'Proposal date must match PlannerInput.date.'),
    );
  } else {
    proposalDate = input.date;
  }

  const summary = readNonEmptyText(candidate.summary, 'summary', errors);
  const actionValues = Array.isArray(candidate.actions) ? candidate.actions : null;
  const unscheduledValues = Array.isArray(candidate.unscheduled) ? candidate.unscheduled : null;

  if (!actionValues) {
    errors.push(issue('INVALID_STRUCTURE', 'actions', 'Proposal actions must be an array.'));
  }
  if (!unscheduledValues) {
    errors.push(
      issue('INVALID_STRUCTURE', 'unscheduled', 'Proposal unscheduled must be an array.'),
    );
  }

  const validatedActions = (actionValues ?? []).flatMap((value, index) => {
    const action = validateAction(value, index, tasks, planningWindow, freeSlots, errors, warnings);
    return action ? [action] : [];
  });
  const unscheduled = (unscheduledValues ?? []).flatMap((value, index) => {
    const task = validateUnscheduledTask(value, index, tasks, errors);
    return task ? [task] : [];
  });

  for (let leftIndex = 0; leftIndex < validatedActions.length; leftIndex += 1) {
    const left = validatedActions[leftIndex];

    for (const right of validatedActions.slice(leftIndex + 1)) {
      if (overlaps(left, right)) {
        errors.push(
          issue(
            'OVERLAPPING_ACTIONS',
            `actions[${right.index}]`,
            `Action overlaps actions[${left.index}] using half-open intervals.`,
          ),
        );
      }
    }
  }

  const scheduledCounts = new Map<string, number>();
  const unscheduledCounts = new Map<string, number>();

  for (const { action } of validatedActions) {
    if (action.taskId) increment(scheduledCounts, action.taskId);
  }
  for (const task of unscheduled) increment(unscheduledCounts, task.taskId);

  for (const [key, task] of tasks) {
    const scheduledCount = scheduledCounts.get(key) ?? 0;
    const unscheduledCount = unscheduledCounts.get(key) ?? 0;

    if (scheduledCount > 1) {
      errors.push(
        issue(
          'DUPLICATE_TASK_SCHEDULING',
          'actions',
          `Task ${task.id} must not be scheduled more than once.`,
        ),
      );
    }

    if (scheduledCount > 0 && unscheduledCount > 0) {
      errors.push(
        issue(
          'TASK_SCHEDULED_AND_UNSCHEDULED',
          'unscheduled',
          `Task ${task.id} must not be both scheduled and unscheduled.`,
        ),
      );
    }

    if (scheduledCount + unscheduledCount !== 1) {
      errors.push(
        issue(
          'TASK_COVERAGE',
          'tasks',
          `Task ${task.id} must appear exactly once in actions or unscheduled.`,
        ),
      );
    }
  }

  if (errors.length > 0 || !summary) return { errors, ok: false, warnings };

  const proposal: PlannerProposal = {
    actions: validatedActions.map(({ action }) => action),
    date: proposalDate,
    summary,
    unscheduled,
  };

  return { ok: true, proposal, warnings };
}
