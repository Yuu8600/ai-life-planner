/** Display-only ordering. Never mutates persisted plans or proposals. */
export type DailyTimelineEntry<T> = {
  allDay: boolean;
  startAt: string;
  value: T;
};

export function orderDailyTimeline<T>(entries: readonly DailyTimelineEntry<T>[]): T[] {
  return entries
    .map((entry, index) => ({ ...entry, index }))
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.index - b.index,
    )
    .map(({ value }) => value);
}
