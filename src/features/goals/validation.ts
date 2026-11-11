import type {
  CreateGoalInput,
  Goal,
  GoalPriority,
  GoalStatus,
} from './repositories/GoalRepository';

export type GoalFormValues = {
  deadline: string;
  description: string;
  priority: string;
  status: string;
  title: string;
};

export type GoalFormInput = Omit<CreateGoalInput, 'currentValue' | 'targetValue' | 'unit'>;

export type GoalFormErrors = Partial<Record<keyof GoalFormValues, string>>;

export type GoalValidationResult =
  { errors: null; input: GoalFormInput } | { errors: GoalFormErrors; input: null };

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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isGoalPriority(value: string): value is GoalPriority {
  return GOAL_PRIORITIES.some((option) => option.value === value);
}

function isGoalStatus(value: string): value is GoalStatus {
  return GOAL_STATUSES.some((option) => option.value === value);
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
    deadline: goal?.deadline ?? '',
    description: goal?.description ?? '',
    priority: goal?.priority ?? 'medium',
    status: goal?.status ?? 'active',
    title: goal?.title ?? '',
  };
}

export function validateGoalForm(values: GoalFormValues): GoalValidationResult {
  const errors: GoalFormErrors = {};
  const title = values.title.trim();
  const deadline = values.deadline.trim();

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
      deadline: deadline || null,
      description: optionalText(values.description),
      priority: values.priority as GoalPriority,
      status: values.status as GoalStatus,
      title,
    },
  };
}
