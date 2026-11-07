import type {
  ProfilePlanningSettings,
  UpdateProfilePlanningSettingsInput,
} from './repositories/SettingsRepository';

export type SettingsFormValues = {
  calendarBufferBeforeHours: string;
  calendarBufferBeforeMinutes: string;
  calendarBufferAfterHours: string;
  calendarBufferAfterMinutes: string;
  minimumFreeMinutes: string;
  planningEnd: string;
  planningEndDayOffset: string;
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
    calendarBufferBeforeHours: String(Math.floor(settings.calendarBufferBeforeMinutes / 60)),
    calendarBufferBeforeMinutes: String(settings.calendarBufferBeforeMinutes % 60),
    calendarBufferAfterHours: String(Math.floor(settings.calendarBufferAfterMinutes / 60)),
    calendarBufferAfterMinutes: String(settings.calendarBufferAfterMinutes % 60),
    minimumFreeMinutes: String(settings.minimumFreeMinutes),
    planningEnd: settings.planningEnd,
    planningEndDayOffset: String(settings.planningEndDayOffset),
    planningStart: settings.planningStart,
    timezone: settings.timezone,
  };
}

export function validateSettingsForm(values: SettingsFormValues): SettingsValidationResult {
  const errors: SettingsFormErrors = {};
  const readBuffer = (prefix: 'calendarBufferBefore' | 'calendarBufferAfter') => {
    const hoursKey = `${prefix}Hours` as const;
    const minutesKey = `${prefix}Minutes` as const;
    const hours = values[hoursKey];
    const minutes = values[minutesKey];
    const total = Number(hours) * 60 + Number(minutes);
    if (
      !/^\d+$/.test(hours) ||
      !/^\d+$/.test(minutes) ||
      !Number.isSafeInteger(total) ||
      Number(minutes) > 59 ||
      total > 240
    ) {
      errors[minutesKey] = '時間と分は整数で、分は0〜59、合計は0〜240分にしてください。';
    }
    return total;
  };
  const calendarBufferBeforeMinutes = readBuffer('calendarBufferBefore');
  const calendarBufferAfterMinutes = readBuffer('calendarBufferAfter');
  const timezone = values.timezone.trim();
  const planningStart = values.planningStart.trim();
  const planningEnd = values.planningEnd.trim();
  const planningEndDayOffset = values.planningEndDayOffset;
  if (planningEndDayOffset !== '0' && planningEndDayOffset !== '1')
    errors.planningEndDayOffset = '終了日は当日または翌日を選択してください。';
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
    (Number(planningEndDayOffset) * 1440 + toMinutes(planningEnd) - toMinutes(planningStart) <= 0 ||
      Number(planningEndDayOffset) * 1440 + toMinutes(planningEnd) - toMinutes(planningStart) >
        1440)
  ) {
    errors.planningEnd =
      planningEndDayOffset === '0'
        ? '終了時刻は開始時刻より後にしてください。'
        : '活動時間は0分より長く、24時間以内にしてください。';
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
      calendarBufferBeforeMinutes,
      calendarBufferAfterMinutes,
      minimumFreeMinutes,
      planningEnd,
      planningEndDayOffset: Number(planningEndDayOffset) as 0 | 1,
      planningStart,
      timezone: resolvedTimeZone,
    },
  };
}
