import type {
  ProfilePlanningSettings,
  UpdateProfilePlanningSettingsInput,
} from './repositories/SettingsRepository';

export type SettingsFormValues = {
  minimumFreeMinutes: string;
  planningEnd: string;
  planningStart: string;
  timezone: string;
};

export type SettingsFormErrors = Partial<Record<keyof SettingsFormValues, string>>;

export type SettingsValidationResult =
  | { errors: null; input: UpdateProfilePlanningSettingsInput }
  | { errors: SettingsFormErrors; input: null };

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function resolveIanaTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function createSettingsFormValues(settings: ProfilePlanningSettings): SettingsFormValues {
  return {
    minimumFreeMinutes: String(settings.minimumFreeMinutes),
    planningEnd: settings.planningEnd,
    planningStart: settings.planningStart,
    timezone: settings.timezone,
  };
}

export function validateSettingsForm(values: SettingsFormValues): SettingsValidationResult {
  const errors: SettingsFormErrors = {};
  const timezone = values.timezone.trim();
  const planningStart = values.planningStart.trim();
  const planningEnd = values.planningEnd.trim();
  const minimumFreeMinutesValue = values.minimumFreeMinutes.trim();
  const resolvedTimeZone = timezone ? resolveIanaTimeZone(timezone) : null;
  const minimumFreeMinutes = Number(minimumFreeMinutesValue);

  if (!timezone) {
    errors.timezone = 'タイムゾーンを入力してください。';
  } else if (!resolvedTimeZone) {
    errors.timezone = '有効なIANAタイムゾーンを入力してください（例: Asia/Tokyo）。';
  }

  if (!TIME_PATTERN.test(planningStart)) {
    errors.planningStart = '開始時刻はHH:mm形式で入力してください。';
  }

  if (!TIME_PATTERN.test(planningEnd)) {
    errors.planningEnd = '終了時刻はHH:mm形式で入力してください。';
  }

  if (
    TIME_PATTERN.test(planningStart) &&
    TIME_PATTERN.test(planningEnd) &&
    toMinutes(planningStart) >= toMinutes(planningEnd)
  ) {
    errors.planningEnd = '終了時刻は開始時刻より後にしてください。';
  }

  if (
    !POSITIVE_INTEGER_PATTERN.test(minimumFreeMinutesValue) ||
    !Number.isInteger(minimumFreeMinutes) ||
    minimumFreeMinutes <= 0 ||
    minimumFreeMinutes > POSTGRES_INTEGER_MAX
  ) {
    errors.minimumFreeMinutes = '1以上の整数で入力してください。';
  }

  if (Object.keys(errors).length > 0 || !resolvedTimeZone) {
    return { errors, input: null };
  }

  return {
    errors: null,
    input: {
      minimumFreeMinutes,
      planningEnd,
      planningStart,
      timezone: resolvedTimeZone,
    },
  };
}
