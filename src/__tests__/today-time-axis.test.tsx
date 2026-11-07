import { act, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  axisPosition,
  axisTicks,
  datesInWindow,
  layoutTimeAxis,
  resolveAxisWindow,
  unallocatedSlots,
} from '@/features/today/timeAxis';
import { getUtcDayBounds } from '@/features/today';
import { Timeline } from '@/features/today/components/Timeline';
import { useTimelineClock } from '@/features/today/useTimelineClock';
import type { TimelineItem } from '@/features/today/types';

const window = { startAt: '2026-11-07T00:00:00Z', endAt: '2026-11-07T17:00:00Z' };
const action: TimelineItem = {
  id: 'short',
  startAt: '2026-11-07T01:00:00Z',
  endAt: '2026-11-07T01:02:00Z',
  start: '10:00',
  end: '10:02',
  title: '短いActionの省略しないタイトル',
  taskTitle: 'Task',
  goalTitle: 'Goal',
  reason: '理由',
  status: 'scheduled',
  statusLabel: '予定',
};

it('positions and clips cards by UTC elapsed minutes, preserving exact short durations', () => {
  const layout = layoutTimeAxis(window, [
    { ...action },
    { id: 'overlap', startAt: action.startAt, endAt: '2026-11-07T02:00:00Z' },
    { id: 'clipped', startAt: '2026-11-06T23:00:00Z', endAt: '2026-11-07T00:15:00Z' },
  ]);
  expect(layout.height).toBe(17 * 96);
  expect(layout.blocks.find((b) => b.id === 'short')).toMatchObject({ top: 96, height: 3.2 });
  expect(layout.blocks.find((b) => b.id === 'clipped')).toMatchObject({ top: 0, height: 24 });
  expect(new Set(layout.blocks.filter((b) => b.top === 96).map((b) => b.lane)).size).toBe(2);
  expect(layout.blocks).toHaveLength(3);
  expect(axisPosition('2026-11-07T16:00:00Z', window)).toBe(16 * 96);
});
it('keeps even adjacent short touch areas in independent lanes', () => {
  const layout = layoutTimeAxis(window, [
    action,
    { ...action, id: 'second', startAt: action.endAt, endAt: '2026-11-07T01:05:00Z' },
  ]);
  expect(layout.blocks[0].lane).not.toBe(layout.blocks[1].lane);
  expect(layout.blocks[1].top).toBeCloseTo(99.2);
});
it('rejects invalid windows and excludes events entirely outside the window', () => {
  expect(() => layoutTimeAxis({ startAt: window.endAt, endAt: window.startAt }, [])).toThrow();
  expect(
    layoutTimeAxis(window, [
      { id: 'outside', startAt: window.endAt, endAt: '2026-11-07T18:00:00Z' },
    ]).blocks,
  ).toEqual([]);
});
it('labels overnight and year boundaries continuously with exclusive end-date fetching', () => {
  const bounds = { startAt: '2026-12-31T14:00:00Z', endAt: '2026-12-31T17:00:00Z' };
  expect(axisTicks(bounds, '2026-12-31', 'Asia/Tokyo').map((t) => t.label)).toEqual([
    '23:00',
    '翌日 00:00',
    '翌日 01:00',
    '翌日 02:00',
  ]);
  expect(datesInWindow('2026-12-31', 'Asia/Tokyo', bounds)).toEqual(['2026-12-31', '2027-01-01']);
  expect(
    datesInWindow('2026-12-31', 'Asia/Tokyo', { ...bounds, endAt: '2026-12-31T15:00:00Z' }),
  ).toEqual(['2026-12-31']);
});
it('uses real elapsed height through DST spring-forward, without a fabricated 02:00 tick', () => {
  const bounds = getUtcDayBounds('2026-03-08', 'America/New_York');
  expect(layoutTimeAxis(bounds, []).height).toBe(23 * 96);
  const ticks = axisTicks(bounds, '2026-03-08', 'America/New_York');
  expect(ticks.some((t) => t.label === '02:00')).toBe(false);
  expect(
    ticks.find((t) => t.label === '03:00')!.top - ticks.find((t) => t.label === '01:00')!.top,
  ).toBe(96);
});
it('distinguishes both real 01:00 hours during DST fallback', () => {
  const bounds = getUtcDayBounds('2026-11-01', 'America/New_York');
  expect(layoutTimeAxis(bounds, []).height).toBe(25 * 96);
  const repeated = axisTicks(bounds, '2026-11-01', 'America/New_York').filter((t) =>
    t.label.startsWith('01:00'),
  );
  expect(repeated.map((t) => t.label)).toEqual(['01:00 (GMT-4)', '01:00 (GMT-5)']);
  expect(repeated[1].top - repeated[0].top).toBe(96);
});
it('preserves saved windows instead of reinterpreting them after settings change', () => {
  const current = { startAt: '2026-11-07T11:00:00Z', endAt: '2026-11-07T18:00:00Z' };
  expect(resolveAxisWindow('2026-11-07', 'Asia/Tokyo', window, current)).toEqual(window);
  expect(resolveAxisWindow('2026-11-07', 'Asia/Tokyo', undefined, current)).toEqual(current);
});
it('subtracts overlapping saved Actions, rounds the now cutoff upward, and reapplies minimum duration', () => {
  const slots = [{ startAt: '2026-11-07T00:00:00Z', endAt: '2026-11-07T04:00:00Z' }];
  const actions = [
    { startAt: '2026-11-07T01:00:00Z', endAt: '2026-11-07T02:00:00Z' },
    { startAt: '2026-11-07T01:30:00Z', endAt: '2026-11-07T03:45:00Z' },
  ];
  expect(unallocatedSlots(slots, actions, 20, new Date('2026-11-07T00:00:01Z'))).toEqual([
    { startAt: '2026-11-07T00:01:00.000Z', endAt: '2026-11-07T01:00:00.000Z' },
  ]);
  expect(unallocatedSlots(slots, actions, 20, new Date('2026-11-07T04:00:00Z'))).toEqual([]);
});
it('keeps all-day events above the axis and opens complete details for a two-minute Action', async () => {
  const execute = jest.fn();
  const screen = await render(
    <Timeline
      window={window}
      localDate="2026-11-07"
      timezone="Asia/Tokyo"
      now={new Date(window.startAt)}
      items={[action]}
      onExecute={execute}
      calendarEvents={[
        { title: '終日メモ', allDay: true, startAt: window.startAt, endAt: window.endAt },
      ]}
    />,
  );
  expect(within(screen.getByTestId('today-all-day')).getByText('終日メモ')).toBeTruthy();
  expect(
    StyleSheet.flatten(screen.getByTestId('today-axis-duration-action:short').props.style).height,
  ).toBe(3.2);
  expect(
    StyleSheet.flatten(screen.getByTestId('today-axis-action:short').props.style).height,
  ).toBeGreaterThanOrEqual(44);
  await fireEvent.press(screen.getByTestId('today-axis-action:short'));
  expect(screen.getByRole('button', { name: '閉じる' })).toBeTruthy();
  const buttons = screen.getAllByRole('button', { name: action.title + 'を完了する' });
  await fireEvent.press(buttons.at(-1)!);
  expect(execute).toHaveBeenCalledWith('short', 'completed');
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull();
});
it('updates the current-time line periodically and hides it outside the displayed window', async () => {
  jest.useFakeTimers();
  try {
    let value = new Date('2026-11-07T01:00:00Z');
    const now = () => value;
    function Probe() {
      const clock = useTimelineClock(now, 0);
      return (
        <Timeline
          window={window}
          localDate="2026-11-07"
          timezone="Asia/Tokyo"
          items={[]}
          now={clock}
        />
      );
    }
    const screen = await render(<Probe />);
    expect(screen.getByLabelText('現在時刻 10:00')).toBeTruthy();
    value = new Date('2026-11-07T01:01:00Z');
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByLabelText('現在時刻 10:01')).toBeTruthy();
    value = new Date(window.endAt);
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.queryByTestId('today-current-time')).toBeNull();
    await screen.unmount();
  } finally {
    jest.useRealTimers();
  }
});

it('changes chart width without changing UTC placement and keeps enlarged touch areas separate', async () => {
  const screen = await render(
    <Timeline
      window={window}
      localDate="2026-11-07"
      timezone="Asia/Tokyo"
      items={[action]}
      now={new Date(window.startAt)}
    />,
  );
  const position = StyleSheet.flatten(
    screen.getByTestId('today-axis-action:short').props.style,
  ).top;
  for (const width of [375, 1440]) {
    await fireEvent(screen.getByTestId('today-axis-container'), 'layout', {
      nativeEvent: { layout: { width } },
    });
    expect(StyleSheet.flatten(screen.getByTestId('today-time-axis').props.style).width).toBe(width);
    expect(StyleSheet.flatten(screen.getByTestId('today-axis-action:short').props.style).top).toBe(
      position,
    );
  }
  const layout = layoutTimeAxis(
    window,
    [
      action,
      { ...action, id: 'next', startAt: '2026-11-07T01:30:00Z', endAt: '2026-11-07T01:32:00Z' },
    ],
    90,
  );
  expect(layout.laneCount).toBe(2);
});
