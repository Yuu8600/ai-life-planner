import type { CalendarEvent, CalendarRepository, FixedEventRepository } from '@/features/calendar';
import { getUtcDayBounds } from '@/features/today';

/** Read locally for an explicit sharing preview; nothing is sent by this function. */
export async function readCalendarForShare(
  date: string,
  timezone: string,
  device: CalendarRepository,
  fixed: FixedEventRepository,
) {
  const bounds = getUtcDayBounds(date, timezone);
  const [local, calendar] = await Promise.allSettled([
    fixed.list(bounds),
    (async () => {
      const permission = await device.getPermission();
      if (permission.status !== 'granted') throw new Error('Calendar permission');
      const result = await device.listEvents(bounds, date);
      if (!result.calendarCount) throw new Error('No readable calendars');
      return result.events;
    })(),
  ]);
  if (local.status === 'rejected' && calendar.status === 'rejected')
    throw new Error('予定を読み込めませんでした。');
  const appEvents: CalendarEvent[] =
    local.status === 'fulfilled'
      ? local.value.map((event) => ({
          ...event,
          calendarId: 'app',
          calendarTitle: 'アプリ内',
          allDay: false,
          allDayStartDate: null,
          allDayEndDate: null,
          status: 'confirmed',
          availability: 'busy',
          location: null,
          instanceId: null,
          timeZone: timezone,
        }))
      : [];
  return {
    timezone,
    events: [...appEvents, ...(calendar.status === 'fulfilled' ? calendar.value : [])]
      .filter((event) => event.status !== 'canceled')
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    warning:
      local.status === 'rejected' || calendar.status === 'rejected'
        ? `${calendar.status === 'rejected' ? '端末' : 'アプリ内'}の予定を取得できませんでした。表示できた予定だけを個別に選べます。`
        : undefined,
  };
}
