import { dateInputToLocalDate, formatDateInput } from '@/shared/dateInput';

import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
} from './repositories/TaskRepository';

export type TaskFormValues = {
  deadline: string;
  estimatedMinutes: string;
  goalId: string;
  priority: string;
  status: string;
  title: string;
};

export type TaskFormErrors = Partial<Record<keyof TaskFormValues, string>>;

export type TaskValidationResult =
  { errors: null; input: CreateTaskInput } | { errors: TaskFormErrors; input: null };

export const TASK_PRIORITIES: readonly { label: string; value: TaskPriority }[] = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

export const TASK_STATUSES: readonly { label: string; value: TaskStatus }[] = [
  { label: '未予定', value: 'pending' },
  { label: '予定済み', value: 'scheduled' },
  { label: '完了', value: 'completed' },
  { label: 'スキップ', value: 'skipped' },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((option) => option.value === value);
}

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.some((option) => option.value === value);
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateInputToDeadline(value: string): string {
  const date = dateInputToLocalDate(value);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function deadlineToDateInput(deadline: string | null): string {
  if (!deadline) return '';

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return '';

  return formatDateInput(parsed);
}

export function createTaskFormValues(task?: Task): TaskFormValues {
  return {
    deadline: deadlineToDateInput(task?.deadline ?? null),
    estimatedMinutes: task ? String(task.estimatedMinutes) : '30',
    goalId: task?.goalId ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'pending',
    title: task?.title ?? '',
  };
}

export function validateTaskForm(
  values: TaskFormValues,
  allowedGoalIds: ReadonlySet<string>,
): TaskValidationResult {
  const errors: TaskFormErrors = {};
  const title = values.title.trim();
  const estimatedMinutesValue = values.estimatedMinutes.trim();
  const deadline = values.deadline.trim();
  const goalId = values.goalId.trim();
  const estimatedMinutes = Number(estimatedMinutesValue);

  if (!title) errors.title = 'タイトルを入力してください。';

  if (
    !POSITIVE_INTEGER_PATTERN.test(estimatedMinutesValue) ||
    !Number.isSafeInteger(estimatedMinutes) ||
    estimatedMinutes > POSTGRES_INTEGER_MAX
  ) {
    errors.estimatedMinutes = '所要時間は1以上の整数で入力してください。';
  }

  if (!isTaskPriority(values.priority)) errors.priority = '優先度を選択してください。';
  if (!isTaskStatus(values.status)) errors.status = '状態を選択してください。';

  if (deadline && !isValidDate(deadline)) {
    errors.deadline = '期限はYYYY-MM-DD形式の実在する日付で入力してください。';
  }

  if (goalId && !allowedGoalIds.has(goalId)) {
    errors.goalId = 'ログイン中のユーザーが所有するGoalを選択してください。';
  }

  if (Object.keys(errors).length > 0) return { errors, input: null };

  return {
    errors: null,
    input: {
      deadline: deadline ? dateInputToDeadline(deadline) : null,
      estimatedMinutes,
      goalId: goalId || null,
      priority: values.priority as TaskPriority,
      status: values.status as TaskStatus,
      title,
    },
  };
}
