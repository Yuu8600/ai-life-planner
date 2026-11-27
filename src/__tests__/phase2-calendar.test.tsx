import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DayAgenda } from '@/features/calendar/DayAgenda';
import type { CalendarRepository } from '@/features/calendar';
import type { FixedEvent, FixedEventRepository } from '@/features/calendar/FixedEventRepository';
import { EventEditor } from '@/features/planner/v2/EventEditor';
import type { ProfilePlanningSettings } from '@/features/settings';

const event: FixedEvent = {
  id: 'local',
  title: '打ち合わせ',
  startAt: '2026-11-27T01:00:12Z',
  endAt: '2026-11-27T02:00:12Z',
};
const settings: ProfilePlanningSettings = {
  timezone: 'Asia/Tokyo',
  planningStart: '09:00',
  planningEnd: '12:00',
  planningEndDayOffset: 0,
  minimumFreeMinutes: 15,
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
};
function fixed(values: FixedEvent[] = [event]): FixedEventRepository {
  return {
    list: jest.fn(async () => values),
    add: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}
function calendar(granted = true): CalendarRepository {
  return {
    getPermission: jest.fn(async () => ({
      status: granted ? ('granted' as const) : ('denied' as const),
      canAskAgain: true,
    })),
    requestPermission: jest.fn(),
    listEvents: jest.fn(async () => ({ events: [], calendarCount: 1, discardedEventCount: 0 })),
  };
}

it('opens only app events for editing and summarizes activity-window free slots', async () => {
  const onEditEvent = jest.fn();
  const screen = await render(
    <DayAgenda
      date="2026-11-27"
      timezone="Asia/Tokyo"
      revision={0}
      calendar={calendar()}
      fixed={fixed()}
      planningSettings={settings}
      onEditEvent={onEditEvent}
    />,
  );
  await fireEvent.press(await screen.findByRole('button', { name: '打ち合わせを編集' }));
  expect(onEditEvent).toHaveBeenCalledWith(event);
  expect(screen.getByText('空き時間：合計 120 分')).toBeTruthy();
  expect(screen.queryByText(/参考の空き時間/)).toBeNull();
});
it('marks partial data as provisional and waits for both sources before calculating', async () => {
  const screen = await render(
    <DayAgenda
      date="2026-11-27"
      timezone="Asia/Tokyo"
      revision={0}
      calendar={calendar(false)}
      fixed={fixed([])}
      planningSettings={settings}
    />,
  );
  expect(await screen.findByText('参考の空き時間：合計 180 分')).toBeTruthy();
  expect(screen.getByText(/確認できた予定のみ/)).toBeTruthy();
});
it('loads the next date and clips overnight events to the configured activity window', async () => {
  const source = calendar();
  const local = fixed([
    { ...event, startAt: '2026-11-27T15:00:00Z', endAt: '2026-11-27T16:00:00Z' },
  ]);
  const screen = await render(
    <DayAgenda
      date="2026-11-27"
      timezone="Asia/Tokyo"
      revision={0}
      calendar={source}
      fixed={local}
      planningSettings={{
        ...settings,
        planningStart: '23:00',
        planningEnd: '02:00',
        planningEndDayOffset: 1,
      }}
    />,
  );
  expect(await screen.findByText('空き時間：合計 120 分')).toBeTruthy();
  expect(source.listEvents).toHaveBeenCalledWith(
    expect.objectContaining({ endAt: '2026-11-27T17:00:00.000Z' }),
    '2026-11-28',
  );
  expect(screen.getByText('翌日 01:00 – 翌日 02:00（60分）')).toBeTruthy();
});
it('retains the edited form after failure and preserves unedited instants including seconds', async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error('保存失敗'))
    .mockResolvedValueOnce(undefined);
  const close = jest.fn();
  const screen = await render(
    <EventEditor
      date="2026-11-27"
      timezone="Asia/Tokyo"
      fixedOnly
      initialEvent={{ ...event, kind: 'fixed', before: 0, after: 0 }}
      save={save}
      close={close}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('予定名'), '変更した予定');
  await fireEvent.press(screen.getByRole('button', { name: '予定を保存' }));
  expect(screen.getByText('保存失敗')).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '予定を保存' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: event.id,
      title: '変更した予定',
      startAt: event.startAt,
      endAt: event.endAt,
    }),
  );
});
