import type { TimelineItem } from './types';
/** Presentation only: active first, then overdue unfinished, then upcoming. */
export function selectNextAction(items: readonly TimelineItem[], now: Date) {
  const pending = items
    .filter((item) => item.status === 'scheduled')
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
  const instant = now.getTime();
  const active = pending.find(
    (item) => Date.parse(item.startAt) <= instant && instant < Date.parse(item.endAt),
  );
  const overdue = pending.find((item) => Date.parse(item.endAt) <= instant);
  const item = active ?? overdue ?? pending[0];
  return item
    ? {
        item,
        label: active ? '予定時間内・未完了' : overdue ? '予定時刻を過ぎた未完了' : '次の予定',
      }
    : null;
}
