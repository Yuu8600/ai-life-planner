import { addLocalDays, getLocalDate, getUtcDayBounds } from './timezone';
import { formatPlanningTime } from './planningTime';

export type AxisWindow = { startAt: string; endAt: string };
export type AxisInterval = AxisWindow & { id: string };
const PIXELS_PER_MINUTE = 80 / 60;
export const AXIS_TAP_HEIGHT = 44;

/** All coordinates use elapsed UTC time, including DST repeated / missing hours. */
export function axisPosition(instant: string | number, window: AxisWindow): number {
  return (
    (((typeof instant === 'number' ? instant : Date.parse(instant)) - Date.parse(window.startAt)) /
      60_000) *
    PIXELS_PER_MINUTE
  );
}
export function layoutTimeAxis(
  window: AxisWindow,
  intervals: readonly AxisInterval[],
  minimumCardHeight = AXIS_TAP_HEIGHT,
) {
  const start = Date.parse(window.startAt),
    end = Date.parse(window.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
    throw new Error('Invalid timeline window');
  const lanes: number[] = [];
  const positioned = intervals
    .flatMap((item) => {
      const a = Math.max(start, Date.parse(item.startAt)),
        b = Math.min(end, Date.parse(item.endAt));
      return Number.isFinite(a) && Number.isFinite(b) && a < b ? [{ ...item, a, b }] : [];
    })
    .sort((a, b) => a.a - b.a || a.b - b.b || a.id.localeCompare(b.id))
    .map(({ a, b, ...item }) => {
      // Continue a back-to-back sequence before using a lane with a gap.
      let lane = lanes.indexOf(a);
      if (lane < 0) lane = lanes.findIndex((until) => until < a);
      if (lane < 0) lane = lanes.length;
      const previousEnd = lanes[lane] ?? start;
      const joinsPrevious = lanes[lane] === a;
      lanes[lane] = b;
      return {
        ...item,
        lane,
        top: axisPosition(a, window),
        height: ((b - a) / 60_000) * PIXELS_PER_MINUTE,
        bottom: axisPosition(b, window),
        previousBottom: axisPosition(previousEnd, window),
        joinsPrevious,
      };
    });

  // Work backward so each touch area can use gaps without covering a neighbor.
  const nextTouchTops: number[] = [];
  const blocks = positioned
    .reverse()
    .map(({ bottom, previousBottom, ...block }) => {
      const desiredHeight = Math.max(minimumCardHeight, block.height);
      const touchBottom = Math.max(
        bottom,
        Math.min(block.top + desiredHeight, nextTouchTops[block.lane] ?? Infinity),
      );
      const touchTop = Math.min(block.top, Math.max(previousBottom, touchBottom - desiredHeight));
      nextTouchTops[block.lane] = touchTop;
      return { ...block, touchTop, touchHeight: touchBottom - touchTop };
    })
    .reverse();
  return { blocks, laneCount: Math.max(1, lanes.length), height: axisPosition(end, window) };
}
export function axisTicks(window: AxisWindow, date: string, timezone: string) {
  const start = Date.parse(window.startAt),
    end = Date.parse(window.endAt);
  const ticks: { instant: string; label: string; top: number }[] = [];
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const offsetFormat = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  // Scan real instants rather than constructing ambiguous local clock times.
  for (let time = Math.ceil(start / 60_000) * 60_000; time <= end; time += 60_000) {
    const instant = new Date(time).toISOString();
    if (!clock.format(new Date(time)).endsWith(':00')) continue;
    let label = formatPlanningTime(instant, date, timezone);
    const offset = offsetFormat
      .formatToParts(new Date(time))
      .find((part) => part.type === 'timeZoneName')?.value;
    // Offset disambiguates the two occurrences of 01:00 on a DST fallback day.
    if (ticks.some((tick) => tick.label.split(' (')[0] === label)) {
      for (const tick of ticks.filter((tick) => tick.label === label)) {
        const prior = offsetFormat
          .formatToParts(new Date(tick.instant))
          .find((part) => part.type === 'timeZoneName')?.value;
        tick.label += ` (${prior})`;
      }
      label += ` (${offset})`;
    }
    ticks.push({ instant, label, top: axisPosition(time, window) });
  }
  return ticks;
}

/** Display legacy saved Plans in their saved timezone, never reinterpret with new settings. */
export function resolveAxisWindow(
  date: string,
  timezone: string,
  saved?: AxisWindow,
  current?: AxisWindow,
): AxisWindow {
  return current ?? saved ?? getUtcDayBounds(date, timezone);
}

/** Remaining future capacity, not raw visual gaps. All saved Actions retain their reservation. */
export function unallocatedSlots(
  slots: readonly AxisWindow[],
  actions: readonly AxisWindow[],
  minimum: number,
  now: Date,
): AxisWindow[] {
  const cutoff = Math.ceil(now.getTime() / 60_000) * 60_000;
  return slots.flatMap((slot) => {
    let pieces = [
      { start: Math.max(Date.parse(slot.startAt), cutoff), end: Date.parse(slot.endAt) },
    ];
    for (const action of actions) {
      const a = Date.parse(action.startAt),
        b = Date.parse(action.endAt);
      pieces = pieces.flatMap((piece) =>
        b <= piece.start || a >= piece.end
          ? [piece]
          : [
              { start: piece.start, end: Math.min(a, piece.end) },
              { start: Math.max(b, piece.start), end: piece.end },
            ],
      );
    }
    return pieces
      .filter((piece) => piece.end - piece.start >= minimum * 60_000)
      .map((piece) => ({
        startAt: new Date(piece.start).toISOString(),
        endAt: new Date(piece.end).toISOString(),
      }));
  });
}

export function datesInWindow(date: string, timezone: string, window?: AxisWindow) {
  const first = window ? getLocalDate(window.startAt, timezone) : date;
  const last = window ? getLocalDate(Date.parse(window.endAt) - 1, timezone) : date;
  const dates = [first];
  while (dates.at(-1)! < last && dates.length < 5) dates.push(addLocalDays(dates.at(-1)!, 1));
  if (dates.at(-1)! < last) throw new Error('Unexpected timeline range');
  return dates;
}
