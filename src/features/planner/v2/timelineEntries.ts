import { axisPosition, getUtcDayBounds, type AxisWindow } from '@/features/today';
import { effectiveEventBuffers } from '@/features/calendar';
import { isBlockingCalendarEvent } from '../index';
import type { LoadedDay } from './dayService';
import type { WorkSession } from './types';

const MINUTE = 60_000;
const SNAP = 5 * MINUTE;

type TimelineItem = AxisWindow & { id: string; title: string };
export type TimelineEntry =
  | (TimelineItem & { kind: 'task'; session: WorkSession })
  | (TimelineItem & { kind: 'fixed' | 'device' | 'lifestyle' | 'leisure' | 'travel' });

export function timelineWindow(day: LoadedDay): AxisWindow {
  const bounds = getUtcDayBounds(day.input.date, day.input.timezone);
  const { window } = day.input;
  return {
    startAt: new Date(
      Math.min(Date.parse(bounds.startAt), Date.parse(window.startAt)),
    ).toISOString(),
    endAt: new Date(Math.max(Date.parse(bounds.endAt), Date.parse(window.endAt))).toISOString(),
  };
}

export function focusedTimelineWindow(
  full: AxisWindow,
  work: AxisWindow,
  entries: readonly TimelineEntry[],
  openedAt: number,
): AxisWindow {
  const start = Date.parse(work.startAt);
  const end = Date.parse(work.endAt);
  const hour = 60 * MINUTE;
  const insideWork = openedAt >= start && openedAt < end;
  // Keep the controls and relevant hours on the first screen. The full-day view
  // still includes the earlier hours and any completed work hidden by this range.
  const first = insideWork
    ? Math.floor(openedAt / hour) * hour - 30 * MINUTE
    : entries.reduce((earliest, item) => Math.min(earliest, Date.parse(item.startAt)), start);
  return { ...full, startAt: new Date(Math.max(Date.parse(full.startAt), first)).toISOString() };
}

export function timelineEntries(day: LoadedDay): TimelineEntry[] {
  const plan = day.saved?.plan;
  const items: TimelineEntry[] = [
    ...(plan?.sessions ?? []).flatMap((session): TimelineEntry[] =>
      session.status === 'deferred' || session.status === 'skipped'
        ? []
        : [{ ...session, id: `task:${session.id}`, kind: 'task', session }],
    ),
    ...(plan?.lifestyle ?? []).map((item): TimelineEntry => ({
      ...item,
      id: `life:${item.id}`,
      kind: 'lifestyle',
    })),
    ...(plan?.leisure ?? []).map((item): TimelineEntry => ({
      ...item,
      id: `free:${item.startAt}`,
      kind: 'leisure',
      title: '自由時間',
    })),
  ];
  for (const event of day.events) {
    if (event.kind !== 'fixed') continue;
    const fixed = { ...event, id: `fixed:${event.id}`, kind: 'fixed' as const };
    items.push(fixed, ...bufferEntries(fixed, event.before, event.after, '移動時間'));
  }
  for (const event of day.timelineDeviceEvents) {
    if (event.allDay || event.status === 'canceled') continue;
    const device = {
      ...event,
      id: `device:${event.calendarId}:${event.instanceId ?? event.id}:${event.startAt}`,
      kind: 'device' as const,
      title: event.title || '名称未設定の予定',
    };
    items.push(device);
    if (isBlockingCalendarEvent(event)) {
      const { before, after } = effectiveEventBuffers(
        event,
        day.settings.calendarBufferBeforeMinutes,
        day.settings.calendarBufferAfterMinutes,
        day.calendarOverrides,
      );
      items.push(...bufferEntries(device, before, after, '予定の余白'));
    }
  }
  return items;
}

function bufferEntries(
  item: TimelineItem,
  before: number,
  after: number,
  label: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  if (before)
    entries.push({
      id: `before:${item.id}`,
      kind: 'travel',
      title: `${item.title}前の${label}`,
      startAt: new Date(Date.parse(item.startAt) - before * MINUTE).toISOString(),
      endAt: item.startAt,
    });
  if (after)
    entries.push({
      id: `after:${item.id}`,
      kind: 'travel',
      title: `${item.title}後の${label}`,
      startAt: item.endAt,
      endAt: new Date(Date.parse(item.endAt) + after * MINUTE).toISOString(),
    });
  return entries;
}

export function moveByPixels(
  session: AxisWindow,
  window: AxisWindow,
  verticalPixels: number,
  scale: number,
): AxisWindow {
  const from = Date.parse(session.startAt);
  const length = Date.parse(session.endAt) - from;
  const windowStart = Date.parse(window.startAt);
  const pixelsPerMinute = axisPosition(windowStart + MINUTE, window) * scale;
  const offset = Math.round(verticalPixels / pixelsPerMinute / 5) * SNAP;
  const start = Math.max(windowStart, Math.min(Date.parse(window.endAt) - length, from + offset));
  return { startAt: new Date(start).toISOString(), endAt: new Date(start + length).toISOString() };
}

export function sessionLabel(session: WorkSession, now: number) {
  if (session.status === 'completed') return '完了';
  if (session.status === 'skipped') return '今日はしない';
  if (session.status === 'deferred') return 'あとで';
  if (Date.parse(session.endAt) <= now) return '未確認';
  if (Date.parse(session.startAt) <= now) return '進行時間内';
  return session.locked ? '固定' : '予定';
}
