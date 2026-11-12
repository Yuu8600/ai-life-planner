import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
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
  expect(layout.height).toBe(17 * 80);
  expect(layout.blocks.find((b) => b.id === 'short')).toMatchObject({ top: 80, height: 80 / 30 });
  expect(layout.blocks.find((b) => b.id === 'clipped')).toMatchObject({ top: 0, height: 20 });
  expect(new Set(layout.blocks.filter((b) => b.top === 80).map((b) => b.lane)).size).toBe(2);
  expect(layout.blocks).toHaveLength(3);
  expect(axisPosition('2026-11-07T16:00:00Z', window)).toBe(16 * 80);
});
it('places 08:00–08:30 and 08:30–09:20 together and separates actual overlaps', () => {
  const layout = layoutTimeAxis(window, [
    { id: 'first', startAt: '2026-11-07T08:00:00Z', endAt: '2026-11-07T08:30:00Z' },
    { id: 'second', startAt: '2026-11-07T08:30:00Z', endAt: '2026-11-07T09:20:00Z' },
    { id: 'overlap', startAt: '2026-11-07T08:45:00Z', endAt: '2026-11-07T09:00:00Z' },
  ]);
  const [first, second, overlap] = layout.blocks;
  expect(first.lane).toBe(second.lane);
  expect(overlap.lane).not.toBe(second.lane);
  expect(first.top + first.height).toBe(second.top);
  expect(second.height).toBeCloseTo((50 * 80) / 60);
  expect(first.touchHeight).toBeGreaterThanOrEqual(44);
  expect(first.touchTop + first.touchHeight).toBeLessThanOrEqual(second.touchTop);
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
  expect(layoutTimeAxis(bounds, []).height).toBe(23 * 80);
  const ticks = axisTicks(bounds, '2026-03-08', 'America/New_York');
  expect(ticks.some((t) => t.label === '02:00')).toBe(false);
  expect(
    ticks.find((t) => t.label === '03:00')!.top - ticks.find((t) => t.label === '01:00')!.top,
  ).toBe(80);
});
it('distinguishes both real 01:00 hours during DST fallback', () => {
  const bounds = getUtcDayBounds('2026-11-01', 'America/New_York');
  expect(layoutTimeAxis(bounds, []).height).toBe(25 * 80);
  const repeated = axisTicks(bounds, '2026-11-01', 'America/New_York').filter((t) =>
    t.label.startsWith('01:00'),
  );
  expect(repeated.map((t) => t.label)).toEqual(['01:00 (GMT-4)', '01:00 (GMT-5)']);
  expect(repeated[1].top - repeated[0].top).toBe(80);
});
it('prefers the current window and falls back to the saved window', () => {
  const current = { startAt: '2026-11-07T11:00:00Z', endAt: '2026-11-07T18:00:00Z' };
  expect(resolveAxisWindow('2026-11-07', 'Asia/Tokyo', window, current)).toEqual(current);
  expect(resolveAxisWindow('2026-11-07', 'Asia/Tokyo', window)).toEqual(window);
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
  ).toBeCloseTo(80 / 30);
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
  expect(layout.laneCount).toBe(1);
  const [first, next] = layout.blocks;
  expect(first.touchTop + first.touchHeight).toBeLessThanOrEqual(next.touchTop);
});

it('keeps adjacent bands at their actual boundaries and shares the scale with free slots and now', async () => {
  const second = {
    ...action,
    id: 'one-minute',
    title: '1分のAction',
    startAt: action.endAt,
    endAt: '2026-11-07T01:03:00Z',
  };
  const third = {
    ...action,
    id: 'third',
    title: '続く短いAction',
    startAt: second.endAt,
    endAt: '2026-11-07T01:05:00Z',
  };
  const execute = jest.fn();
  const screen = await render(
    <Timeline
      window={window}
      items={[action, second, third]}
      onExecute={execute}
      now={new Date('2026-11-07T03:00:00Z')}
      freeSlots={[{ startAt: '2026-11-07T03:00:00Z', endAt: '2026-11-07T04:00:00Z' }]}
    />,
  );
  const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
  const first = style('today-axis-action:short');
  const firstBand = style('today-axis-duration-action:short');
  const next = style('today-axis-action:one-minute');
  const nextBand = style('today-axis-duration-action:one-minute');
  expect(next.left).toBe(first.left);
  expect(first.top + first.height).toBeCloseTo(next.top);
  expect(next.top + next.height).toBeCloseTo(style('today-axis-action:third').top);
  expect(next.height).toBeLessThan(44);
  expect(next.top + nextBand.top).toBeCloseTo(first.top + firstBand.top + firstBand.height);
  expect(nextBand).toMatchObject({ height: 80 / 60, borderTopWidth: 0 });
  expect(nextBand.borderBottomWidth).toBeGreaterThan(0);
  expect(nextBand.borderBottomWidth).toBeLessThan(1);
  expect(style('today-current-time').top).toBe(240);
  expect(style('today-available-slot')).toMatchObject({ top: 240, height: 80 });

  for (const item of [action, second, third]) {
    await fireEvent.press(screen.getByTestId(`today-axis-action:${item.id}`));
    expect(within(screen.getByTestId('selection-panel')).getByText(item.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  }

  const details = within(screen.getByTestId('today-details-list'));
  await fireEvent.press(details.getByRole('button', { name: `${second.title}を完了する` }));
  expect(execute).toHaveBeenCalledWith(second.id, 'completed');
});

it('separates contiguous Action and Calendar bands in the same lane', async () => {
  const time = (clock: string) => `2026-11-07T${clock}:00Z`;
  const screen = await render(
    <Timeline
      window={window}
      items={[
        { ...action, startAt: time('02:00'), endAt: time('04:00') },
        { ...action, id: 'next', startAt: time('04:00'), endAt: time('04:30') },
      ]}
      calendarEvents={[
        { title: '予定1', allDay: false, startAt: time('04:30'), endAt: time('06:00') },
        { title: '予定2', allDay: false, startAt: time('06:00'), endAt: time('08:00') },
      ]}
    />,
  );
  const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
  const cards = [
    { id: 'action:short', top: 160, height: 160 },
    { id: 'action:next', top: 320, height: 40 },
    { id: 'calendar:0', top: 360, height: 120 },
    { id: 'calendar:1', top: 480, height: 160 },
  ];
  const left = style('today-axis-action:short').left;
  cards.forEach(({ id, top, height }, index) => {
    expect(style(`today-axis-${id}`)).toMatchObject({ top, left, height });
    expect(style(`today-axis-duration-${id}`)).toMatchObject({
      height,
      borderWidth: 1,
      borderLeftWidth: 3,
      borderTopWidth: index === 0 ? 1 : 0,
      borderBottomWidth: 1,
    });
  });
});

it('scrolls after loading and layout once per visit, and yields to manual dragging', async () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  const focusVisit = () => {
    const isPending = jest.fn().mockReturnValue(true);
    return { isPending, consume: () => isPending.mockReturnValue(false) };
  };
  const focusScroll = focusVisit();
  const now = new Date('2026-11-07T06:00:00Z');
  const timeline = { window, now, items: [action], focusScroll };
  try {
    const screen = await render(<Timeline {...timeline} isLoading />);
    const axis = () => screen.getByTestId('today-axis-scroll');
    const frame = () =>
      act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await fireEvent(axis(), 'layout', { nativeEvent: { layout: { height: 560 } } });
    await fireEvent(axis(), 'contentSizeChange', 375, 1424);
    await frame();
    expect(scrollTo).not.toHaveBeenCalled();

    await screen.rerender(<Timeline {...timeline} />);
    await frame();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 372, animated: false });

    await screen.rerender(
      <Timeline {...timeline} now={new Date('2026-11-07T07:00:00Z')} items={[]} />,
    );
    await frame();
    expect(scrollTo).toHaveBeenCalledTimes(1);

    const nextVisit = focusVisit();
    await screen.rerender(<Timeline {...timeline} focusScroll={nextVisit} isLoading />);
    await fireEvent(axis(), 'scrollBeginDrag');
    await screen.rerender(<Timeline {...timeline} focusScroll={nextVisit} />);
    await frame();
    expect(scrollTo).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <Timeline {...timeline} focusScroll={focusVisit()} now={new Date(window.endAt)} />,
    );
    await frame();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 864, animated: false });

    await screen.rerender(
      <Timeline {...timeline} focusScroll={focusVisit()} now={new Date('2026-11-06T23:00:00Z')} />,
    );
    await frame();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    expect(scrollTo).toHaveBeenCalledTimes(3);
  } finally {
    scrollTo.mockRestore();
  }
});
