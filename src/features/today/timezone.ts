const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const SEARCH_WINDOW_MILLISECONDS = 3 * MILLISECONDS_PER_DAY;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LocalDate = `${number}-${number}-${number}`;

export type UtcDayBounds = {
  endAt: string;
  startAt: string;
};

export class InvalidTimeZoneError extends Error {
  readonly code = 'INVALID_TIME_ZONE';

  constructor() {
    super('タイムゾーン設定が正しくありません。設定を確認してください。');
    this.name = 'InvalidTimeZoneError';
  }
}

export class InvalidLocalDateError extends Error {
  readonly code = 'INVALID_LOCAL_DATE';

  constructor() {
    super('日付を正しく取得できませんでした。');
    this.name = 'InvalidLocalDateError';
  }
}

export class InvalidInstantError extends Error {
  readonly code = 'INVALID_INSTANT';

  constructor() {
    super('日時を正しく取得できませんでした。');
    this.name = 'InvalidInstantError';
  }
}

type LocalDateParts = {
  day: number;
  month: number;
  year: number;
};

function toDate(instant: Date | number | string): Date {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new InvalidInstantError();
  }

  return date;
}

function toUtcMidnight({ day, month, year }: LocalDateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function parseLocalDate(localDate: string): LocalDateParts {
  const match = LOCAL_DATE_PATTERN.exec(localDate);
  if (!match) throw new InvalidLocalDateError();

  const parts = {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
  const normalized = new Date(toUtcMidnight(parts));

  if (
    parts.year === 0 ||
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day
  ) {
    throw new InvalidLocalDateError();
  }

  return parts;
}

function toLocalDate(parts: LocalDateParts): LocalDate {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

function getDateParts(formatter: Intl.DateTimeFormat, instant: Date | number): LocalDateParts {
  const values = new Map(
    formatter
      .formatToParts(instant)
      .filter(({ type }) => type === 'day' || type === 'month' || type === 'year')
      .map(({ type, value }) => [type, Number(value)]),
  );
  const day = values.get('day');
  const month = values.get('month');
  const year = values.get('year');

  if (day === undefined || month === undefined || year === undefined) {
    throw new InvalidLocalDateError();
  }

  return { day, month, year };
}

function createDatePartsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
}

function getLocalDateWithFormatter(
  instant: Date | number,
  formatter: Intl.DateTimeFormat,
): LocalDate {
  return toLocalDate(getDateParts(formatter, instant));
}

function addOneLocalDay(parts: LocalDateParts): LocalDateParts {
  const date = new Date(toUtcMidnight(parts) + MILLISECONDS_PER_DAY);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function findStartOfLocalDate(
  localDate: LocalDate,
  parts: LocalDateParts,
  formatter: Intl.DateTimeFormat,
): number {
  const approximateUtcMidnight = toUtcMidnight(parts);
  let lowerBound = approximateUtcMidnight - SEARCH_WINDOW_MILLISECONDS;
  let upperBound = approximateUtcMidnight + SEARCH_WINDOW_MILLISECONDS;

  if (
    getLocalDateWithFormatter(lowerBound, formatter) >= localDate ||
    getLocalDateWithFormatter(upperBound, formatter) < localDate
  ) {
    throw new InvalidLocalDateError();
  }

  while (upperBound - lowerBound > 1) {
    const midpoint = lowerBound + Math.floor((upperBound - lowerBound) / 2);

    if (getLocalDateWithFormatter(midpoint, formatter) < localDate) {
      lowerBound = midpoint;
    } else {
      upperBound = midpoint;
    }
  }

  if (getLocalDateWithFormatter(upperBound, formatter) !== localDate) {
    throw new InvalidLocalDateError();
  }

  return upperBound;
}

export function resolveTimeZone(timeZone: string): string {
  const normalizedTimeZone = timeZone.trim();
  if (!normalizedTimeZone) throw new InvalidTimeZoneError();

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedTimeZone,
    }).resolvedOptions().timeZone;
  } catch {
    throw new InvalidTimeZoneError();
  }
}

export function getLocalDate(instant: Date | number | string, timeZone: string): LocalDate {
  const canonicalTimeZone = resolveTimeZone(timeZone);
  const formatter = createDatePartsFormatter(canonicalTimeZone);
  return getLocalDateWithFormatter(toDate(instant), formatter);
}

export function addLocalDays(localDate: string, amount: number): LocalDate {
  if (!Number.isInteger(amount)) throw new InvalidLocalDateError();

  const parts = parseLocalDate(localDate);
  const date = new Date(toUtcMidnight(parts) + amount * MILLISECONDS_PER_DAY);

  return toLocalDate({
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  });
}

export function getUtcDayBounds(localDate: string, timeZone: string): UtcDayBounds {
  const canonicalTimeZone = resolveTimeZone(timeZone);
  const startParts = parseLocalDate(localDate);
  const startLocalDate = toLocalDate(startParts);
  const endParts = addOneLocalDay(startParts);
  const endLocalDate = toLocalDate(endParts);
  const formatter = createDatePartsFormatter(canonicalTimeZone);

  const startAt = findStartOfLocalDate(startLocalDate, startParts, formatter);
  const endAt = findStartOfLocalDate(endLocalDate, endParts, formatter);

  return {
    endAt: new Date(endAt).toISOString(),
    startAt: new Date(startAt).toISOString(),
  };
}

export function formatLocalDateJa(instant: Date | number | string, timeZone: string): string {
  const date = toDate(instant);
  const canonicalTimeZone = resolveTimeZone(timeZone);
  const parts = getDateParts(createDatePartsFormatter(canonicalTimeZone), date);
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    timeZone: canonicalTimeZone,
    weekday: 'short',
  }).format(date);

  return `${parts.year}年${parts.month}月${parts.day}日（${weekday}）`;
}

export function formatLocalTimeJa(instant: Date | number | string, timeZone: string): string {
  const date = toDate(instant);
  const canonicalTimeZone = resolveTimeZone(timeZone);
  const values = new Map(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      timeZone: canonicalTimeZone,
    })
      .formatToParts(date)
      .filter(({ type }) => type === 'hour' || type === 'minute')
      .map(({ type, value }) => [type, value]),
  );
  const hour = values.get('hour');
  const minute = values.get('minute');

  if (hour === undefined || minute === undefined) {
    throw new InvalidInstantError();
  }

  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}
