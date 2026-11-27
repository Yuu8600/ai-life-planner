import { fireEvent, render } from '@testing-library/react-native';
import { CalendarShareEditor } from '@/features/ai-chat/v2/CalendarShareEditor';
import type { CalendarEvent } from '@/features/calendar';

const day = '2026-11-18';
const event: CalendarEvent = {
  title: '講義',
  id: 'local-event-id',
  calendarId: 'local-calendar-id',
  calendarTitle: null,
  status: 'confirmed',
  availability: 'busy',
  location: '教室A',
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  timeZone: null,
  instanceId: null,
  startAt: day + 'T04:00:00.000Z',
  endAt: day + 'T06:00:00.000Z',
};

it('does not read or share by default, and previews only selected events without locations', async () => {
  const other = { ...event, id: 'second-event', title: 'アルバイト' };
  const read = jest.fn().mockResolvedValue({ events: [event, other], timezone: 'Asia/Tokyo' });
  const apply = jest.fn();
  const screen = await render(
    <CalendarShareEditor initialDate={day} readEvents={read} apply={apply} close={jest.fn()} />,
  );
  expect(read).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '共有しない' }));
  expect(apply).toHaveBeenCalledWith(day);
  await fireEvent.press(screen.getByRole('radio', { name: 'カレンダー共有 選んだ予定の詳細' }));
  await fireEvent.press(screen.getByRole('button', { name: '端末の予定を確認' }));
  await fireEvent.press(await screen.findByRole('button', { name: '講義' }));
  expect(screen.getByText(/11\/18 13:00.*11\/18 15:00/)).toBeTruthy();
  expect(screen.queryByText(/教室A/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '次の送信に使う' }));
  expect(apply).toHaveBeenLastCalledWith(day, {
    mode: 'selected_event_details',
    date: day,
    includeLocation: false,
    events: [{ title: '講義', startAt: event.startAt, endAt: event.endAt }],
  });
});
