import { Platform } from 'react-native';
import * as ExpoCalendar from 'expo-calendar';

import { CalendarUnavailableError } from '@/features/calendar/errors';
import { normalizeCalendarEvents } from '@/features/calendar/normalization';
import type {
  CalendarPermission,
  CalendarRepository,
} from '@/features/calendar/repositories/CalendarRepository';
import type { CalendarInterval } from '@/features/calendar/types';
import { getUtcDayBounds } from '@/features/today';

export type CalendarNativeApi = {
  getEventCalendars: () => Promise<readonly unknown[]>;
  getPermission: () => Promise<unknown>;
  listEvents: (
    calendarIds: readonly string[],
    startDate: Date,
    endDate: Date,
  ) => Promise<readonly unknown[]>;
  requestPermission: () => Promise<unknown>;
};

type ReadableCalendar = {
  id: string;
  title: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readPermission(value: unknown): CalendarPermission {
  const permission = asRecord(value);
  const status = permission?.status;

  if (status !== 'denied' && status !== 'granted' && status !== 'undetermined') {
    throw new Error('Calendar permission response was invalid.');
  }

  return {
    canAskAgain: permission?.canAskAgain === true,
    status,
  };
}

function readCalendar(value: unknown): ReadableCalendar | null {
  const calendar = asRecord(value);
  if (!calendar || typeof calendar.id !== 'string' || !calendar.id.trim()) return null;
  if (calendar.entityType !== undefined && calendar.entityType !== 'event') return null;
  if (calendar.accessLevel === 'none' || calendar.isVisible === false) return null;

  return {
    id: calendar.id.trim(),
    title:
      typeof calendar.title === 'string' && calendar.title.trim()
        ? calendar.title.trim()
        : '名称未設定のカレンダー',
  };
}

function parseInterval(interval: CalendarInterval): { endDate: Date; startDate: Date } {
  const startDate = new Date(interval.startAt);
  const endDate = new Date(interval.endAt);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate.getTime() >= endDate.getTime()
  ) {
    throw new Error('Calendar interval was invalid.');
  }

  return { endDate, startDate };
}

function isUnavailableError(error: unknown): boolean {
  const record = asRecord(error);
  const code = record && typeof record.code === 'string' ? record.code : '';
  const message = error instanceof Error ? error.message : '';

  return (
    code === 'ERR_UNAVAILABLE' ||
    /not available in expo go|is not available|not supported on this platform|calendar@next/i.test(
      message,
    )
  );
}

const nativeApi: CalendarNativeApi = {
  getEventCalendars: () => ExpoCalendar.getCalendars(ExpoCalendar.EntityTypes.EVENT),
  getPermission: () => ExpoCalendar.getCalendarPermissions(false),
  listEvents: (calendarIds, startDate, endDate) =>
    ExpoCalendar.listEvents([...calendarIds], startDate, endDate),
  requestPermission: () => ExpoCalendar.requestCalendarPermissions(false),
};

export class ExpoCalendarRepository implements CalendarRepository {
  constructor(
    private readonly api: CalendarNativeApi = nativeApi,
    private readonly platform: string = Platform.OS,
    private readonly getDeviceTimeZone: () => string = () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {}

  async getPermission(): Promise<CalendarPermission> {
    this.assertSupportedPlatform();
    try {
      return readPermission(await this.api.getPermission());
    } catch (error) {
      this.rethrowUnavailable(error);
      throw error;
    }
  }

  async requestPermission(): Promise<CalendarPermission> {
    this.assertSupportedPlatform();
    try {
      return readPermission(await this.api.requestPermission());
    } catch (error) {
      this.rethrowUnavailable(error);
      throw error;
    }
  }

  async listEvents(interval: CalendarInterval, localDate: string) {
    this.assertSupportedPlatform();
    const { endDate, startDate } = parseInterval(interval);
    // EventKit returns all-day boundaries as device-local midnight instants.
    // Android encodes all-day dates at UTC midnight. Neither uses the profile timezone.
    const allDayTimeZone = this.platform === 'ios' ? this.getDeviceTimeZone() : 'UTC';
    const deviceDay = getUtcDayBounds(localDate, allDayTimeZone);
    const queryStart =
      this.platform === 'ios'
        ? new Date(Math.min(startDate.getTime(), Date.parse(deviceDay.startAt)))
        : startDate;
    const queryEnd =
      this.platform === 'ios'
        ? new Date(Math.max(endDate.getTime(), Date.parse(deviceDay.endAt)))
        : endDate;

    try {
      const readableCalendars = (await this.api.getEventCalendars())
        .map(readCalendar)
        .filter((calendar): calendar is ReadableCalendar => calendar !== null);

      if (readableCalendars.length === 0) {
        return { calendarCount: 0, discardedEventCount: 0, events: [] };
      }

      const calendarTitles = new Map(
        readableCalendars.map(({ id, title }) => [id, title] as const),
      );
      const platformEvents = await this.api.listEvents(
        readableCalendars.map(({ id }) => id),
        queryStart,
        queryEnd,
      );
      const normalized = normalizeCalendarEvents(
        platformEvents,
        calendarTitles,
        interval,
        localDate,
        this.platform === 'ios' ? allDayTimeZone : undefined,
      );

      return {
        calendarCount: readableCalendars.length,
        ...normalized,
      };
    } catch (error) {
      this.rethrowUnavailable(error);
      throw error;
    }
  }

  private assertSupportedPlatform() {
    if (this.platform !== 'android' && this.platform !== 'ios') {
      throw new CalendarUnavailableError();
    }
  }

  private rethrowUnavailable(error: unknown): void {
    if (isUnavailableError(error)) throw new CalendarUnavailableError();
  }
}

export function createExpoCalendarRepository(): CalendarRepository {
  return new ExpoCalendarRepository();
}
