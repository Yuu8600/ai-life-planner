import type {
  CreateGoalInput,
  Goal,
  GoalPriority,
  GoalStatus,
} from './repositories/GoalRepository';

export type GoalFormValues = {
  currentValue: string;
  deadline: string;
  description: string;
  priority: string;
  status: string;
  targetValue: string;
  title: string;
  unit: string;
};

export type GoalFormErrors = Partial<Record<keyof GoalFormValues, string>>;

export type GoalValidationResult =
  { errors: null; input: CreateGoalInput } | { errors: GoalFormErrors; input: null };

export const GOAL_PRIORITIES: readonly { label: string; value: GoalPriority }[] = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

export const GOAL_STATUSES: readonly { label: string; value: GoalStatus }[] = [
  { label: '進行中', value: 'active' },
  { label: '完了', value: 'completed' },
  { label: 'アーカイブ', value: 'archived' },
];

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isGoalPriority(value: string): value is GoalPriority {
  return GOAL_PRIORITIES.some((option) => option.value === value);
}

function isGoalStatus(value: string): value is GoalStatus {
  return GOAL_STATUSES.some((option) => option.value === value);
}

function parseOptionalNumber(
  value: string,
  field: 'currentValue' | 'targetValue',
  errors: GoalFormErrors,
): number | null {
  const normalized = value.trim();

  if (!normalized) return null;

  const parsed = Number(normalized);

  if (!NUMBER_PATTERN.test(normalized) || !Number.isFinite(parsed)) {
    errors[field] = '整数または小数で入力してください。';
    return null;
  }

  return parsed;
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function createGoalFormValues(goal?: Goal): GoalFormValues {
  return {
    currentValue:
      goal?.currentValue === null || goal?.currentValue === undefined
        ? ''
        : String(goal.currentValue),
    deadline: goal?.deadline ?? '',
    description: goal?.description ?? '',
    priority: goal?.priority ?? 'medium',
    status: goal?.status ?? 'active',
    targetValue:
      goal?.targetValue === null || goal?.targetValue === undefined ? '' : String(goal.targetValue),
    title: goal?.title ?? '',
    unit: goal?.unit ?? '',
  };
}

export function validateGoalForm(values: GoalFormValues): GoalValidationResult {
  const errors: GoalFormErrors = {};
  const title = values.title.trim();
  const deadline = values.deadline.trim();
  const currentValue = parseOptionalNumber(values.currentValue, 'currentValue', errors);
  const targetValue = parseOptionalNumber(values.targetValue, 'targetValue', errors);

  if (!title) {
    errors.title = 'タイトルを入力してください。';
  }

  if (!isGoalPriority(values.priority)) {
    errors.priority = '優先度を選択してください。';
  }

  if (!isGoalStatus(values.status)) {
    errors.status = '状態を選択してください。';
  }

  if (deadline && !isValidDate(deadline)) {
    errors.deadline = '期限はYYYY-MM-DD形式の実在する日付で入力してください。';
  }

  if (Object.keys(errors).length > 0) {
    return { errors, input: null };
  }

  return {
    errors: null,
    input: {
      currentValue,
      deadline: deadline || null,
      description: optionalText(values.description),
      priority: values.priority as GoalPriority,
      status: values.status as GoalStatus,
      targetValue,
      title,
      unit: optionalText(values.unit),
    },
  };
}
