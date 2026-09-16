import {
  formatLocalDateJa,
  formatLocalTimeJa,
  getLocalDate,
  getUtcDayBounds,
} from '@/features/today';

import type { CalendarAvailability, CalendarEvent } from './types';

export type CalendarEventViewModel = {
  accessibilityLabel: string;
  availabilityLabel: string;
  calendarTitle: string | null;
  isCanceled: boolean;
  key: string;
  location: string | null;
  timeLabel: string;
  title: string;
};

const availabilityLabels: Record<CalendarAvailability, string> = {
  busy: '予定あり',
  free: '空き時間',
  tentative: '仮の予定',
  unavailable: '時間外',
  'not-supported': '状態未対応',
  unknown: '状態不明',
};

function formatEndpoint(instant: string, selectedDate: string, timeZone: string): string {
  const localDate = getLocalDate(instant, timeZone);
  const time = formatLocalTimeJa(instant, timeZone);

  if (localDate === selectedDate) return time;

  const [, month, day] = localDate.split('-');
  return `${Number(month)}/${Number(day)} ${time}`;
}

export function getCalendarDateLabel(localDate: string, timeZone: string): string {
  const { startAt } = getUtcDayBounds(localDate, timeZone);
  return formatLocalDateJa(startAt, timeZone);
}

export function toCalendarEventViewModel(
  event: CalendarEvent,
  selectedDate: string,
  timeZone: string,
): CalendarEventViewModel {
  const timeLabel = event.allDay
    ? '終日'
    : `${formatEndpoint(event.startAt, selectedDate, timeZone)}–${formatEndpoint(
        event.endAt,
        selectedDate,
        timeZone,
      )}`;
  const availabilityLabel = availabilityLabels[event.availability];
  const canceledLabel = event.status === 'canceled' ? '、キャンセル済み' : '';

  return {
    accessibilityLabel: `${timeLabel}、${event.title}、${availabilityLabel}${canceledLabel}`,
    availabilityLabel,
    calendarTitle: event.calendarTitle,
    isCanceled: event.status === 'canceled',
    key: `${event.calendarId}:${event.id}:${event.instanceId ?? event.startAt}`,
    location: event.location,
    timeLabel,
    title: event.title,
  };
}
