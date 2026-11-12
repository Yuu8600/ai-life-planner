import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TodayScreen } from '@/features/today/TodayScreen';
import type { TodayProjection } from '@/features/today';
import type {
  CalendarRepository,
  CalendarEvent,
  CalendarEventBufferRepository,
} from '@/features/calendar';
import type { ProfilePlanningSettings, SettingsRepository } from '@/features/settings';

const window = { startAt: '2026-11-07T00:00:00Z', endAt: '2026-11-07T03:00:00Z' };
const settings: ProfilePlanningSettings = {
  planningStart: '09:00',
  planningEnd: '12:00',
  planningEndDayOffset: 0,
  timezone: 'Asia/Tokyo',
  minimumFreeMinutes: 20,
  calendarBufferBeforeMinutes: 15,
  calendarBufferAfterMinutes: 30,
};
const event: CalendarEvent = {
  id: 'meeting',
  calendarId: 'calendar',
  calendarTitle: null,
  instanceId: null,
  timeZone: null,
  title: '会議',
  startAt: '2026-11-07T01:00:00Z',
  endAt: '2026-11-07T02:00:00Z',
  allDay: false,
  availability: 'busy',
  status: 'confirmed',
  location: null,
  allDayStartDate: null,
  allDayEndDate: null,
};
const action = {
  id: 'reserved',
  title: '既存Action',
  startAt: window.startAt,
  endAt: '2026-11-07T00:20:00Z',
  status: 'scheduled' as const,
  goalTitle: null,
  taskId: null,
  taskTitle: null,
  reason: null,
};
const today: TodayProjection = {
  localDate: '2026-11-07',
  profileTimezone: 'Asia/Tokyo',
  greeting: '',
  deadlineTasks: [],
  planningWindow: window,
  plan: {
    date: '2026-11-07',
    id: 'plan',
    timezone: 'Asia/Tokyo',
    window,
    summary: null,
    actions: [action],
  },
};
const now = () => new Date(window.startAt);
function setup() {
  const calendar: jest.Mocked<CalendarRepository> = {
    getPermission: jest.fn(async () => ({ status: 'granted' as const, canAskAgain: false })),
    requestPermission: jest.fn(),
    listEvents: jest.fn(async (_interval, day) => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: day === today.localDate ? [event] : [],
    })),
  };
  const profile: SettingsRepository = {
    getProfilePlanningSettings: jest.fn(async () => settings),
    updateProfilePlanningSettings: jest.fn(),
  };
  const overrides: CalendarEventBufferRepository = {
    list: jest.fn(async () => []),
    upsert: jest.fn(),
    remove: jest.fn(),
  };
  const props = {
    repository: { getToday: async () => today },
    calendarRepository: calendar,
    settingsRepository: profile,
    eventBufferRepository: overrides,
    now,
    onPressAi: jest.fn(),
    onPressSettings: jest.fn(),
    executionRepository: { transition: jest.fn(async () => {}) },
  };
  return { calendar, profile, overrides, props };
}
it('uses common buffers, existing Action reservations and minimum time, with deduplicated reads', async () => {
  const { props, calendar } = setup();
  const screen = await render(<TodayScreen {...props} />);
  expect(await screen.findByLabelText('配置可能な空き時間 09:20から09:45')).toBeTruthy();
  expect(screen.getByLabelText('配置可能な空き時間 11:30から12:00')).toBeTruthy();
  expect(screen.getAllByTestId('today-available-slot')).toHaveLength(2);
  expect(calendar.listEvents.mock.calls.map(([, date]) => date).sort()).toEqual([
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
  ]);
  expect(calendar.requestPermission).not.toHaveBeenCalled();
});
it('honors individual zero-minute overrides without changing the saved Action', async () => {
  const { props, overrides } = setup();
  overrides.list = async () => [
    {
      calendarId: event.calendarId,
      eventId: event.id,
      occurrenceStartAt: event.startAt,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    },
  ];
  const screen = await render(<TodayScreen {...props} />);
  expect(await screen.findByLabelText('配置可能な空き時間 09:20から10:00')).toBeTruthy();
  expect(screen.getByLabelText('配置可能な空き時間 11:00から12:00')).toBeTruthy();
  expect(action.startAt).toBe(window.startAt);
  expect(action.status).toBe('scheduled');
});
it.each(['permission', 'events', 'settings', 'overrides', 'no-calendars'])(
  'never claims capacity on %s failure, while saved Action controls remain usable',
  async (kind) => {
    const { props, calendar, profile, overrides } = setup();
    if (kind === 'permission')
      calendar.getPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
    if (kind === 'events') calendar.listEvents.mockRejectedValue(new Error('Calendar failed'));
    if (kind === 'settings')
      profile.getProfilePlanningSettings = async () => {
        throw new Error('Settings failed');
      };
    if (kind === 'overrides')
      overrides.list = async () => {
        throw new Error('Overrides failed');
      };
    if (kind === 'no-calendars')
      calendar.listEvents.mockResolvedValue({
        calendarCount: 0,
        events: [],
        discardedEventCount: 0,
      });
    const screen = await render(<TodayScreen {...props} />);
    await screen.findByRole('button', { name: '既存Actionを完了する' });
    await waitFor(() => expect(calendar.getPermission).toHaveBeenCalled());
    expect(screen.queryByTestId('today-available-slot')).toBeNull();
    expect(screen.getByTestId('today-capacity-status').props.children).toContain('確認できません');
    await fireEvent.press(screen.getByRole('button', { name: '既存Actionを完了する' }));
    await waitFor(() => expect(props.executionRepository.transition).toHaveBeenCalled());
  },
);
it('does not assume capacity before Calendar loading completes', async () => {
  const { props, calendar } = setup();
  calendar.listEvents.mockReturnValue(new Promise(() => {}));
  const screen = await render(<TodayScreen {...props} />);
  await screen.findByTestId('today-action-focus');
  expect(screen.queryByTestId('today-available-slot')).toBeNull();
});
it('loads overnight and adjacent buffer dates once each and blocks only the next day for an all-day event', async () => {
  const { props, calendar, profile } = setup();
  const overnight = {
    ...settings,
    planningStart: '23:00',
    planningEnd: '02:00',
    planningEndDayOffset: 1 as const,
  };
  profile.getProfilePlanningSettings = async () => overnight;
  props.now = () => new Date('2026-11-07T14:00:00Z');
  const bounds = { startAt: '2026-11-07T14:00:00Z', endAt: '2026-11-07T17:00:00Z' };
  props.repository.getToday = async () => ({ ...today, planningWindow: bounds, plan: null });
  calendar.listEvents.mockImplementation(async (_interval, day) => ({
    calendarCount: 1,
    discardedEventCount: 0,
    events:
      day === '2026-11-08'
        ? [
            {
              ...event,
              allDay: true,
              allDayStartDate: '2026-11-08',
              allDayEndDate: '2026-11-09',
              startAt: '2026-11-07T15:00:00Z',
              endAt: '2026-11-08T15:00:00Z',
            },
          ]
        : [],
  }));
  const screen = await render(<TodayScreen {...props} />);
  expect(await screen.findByLabelText('配置可能な空き時間 23:00から翌日 00:00')).toBeTruthy();
  expect(screen.getAllByTestId('today-available-slot')).toHaveLength(1);
  expect(calendar.listEvents.mock.calls.map(([, day]) => day).sort()).toEqual([
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
    '2026-11-09',
  ]);
  expect(screen.getByTestId('today-all-day')).toBeTruthy();
});
it('refreshes the display window and capacity while preserving saved Action times and operations', async () => {
  const { props, profile } = setup();
  const partial = {
    ...action,
    id: 'partial',
    title: '一部だけ表示されるAction',
    startAt: '2026-11-07T02:20:00Z',
    endAt: '2026-11-07T02:45:00Z',
  };
  const plan = { ...today.plan!, actions: [action, partial] };
  const projection = { ...today, plan };
  props.repository.getToday = async () => projection;
  const screen = await render(<TodayScreen {...props} />);
  expect(await screen.findByTestId('today-axis-duration-action:reserved')).toBeTruthy();

  profile.getProfilePlanningSettings = async () => ({
    ...settings,
    planningStart: '11:30',
    minimumFreeMinutes: 15,
  });
  props.repository.getToday = async () => ({
    ...projection,
    planningWindow: { ...window, startAt: '2026-11-07T02:30:00Z' },
  });
  await screen.rerender(<TodayScreen {...props} refreshToken={1} />);

  expect(await screen.findByLabelText('配置可能な空き時間 11:45から12:00')).toBeTruthy();
  expect(screen.queryByLabelText('配置可能な空き時間 09:20から09:45')).toBeNull();
  expect(screen.getByText(/保存済み計画の活動時間とは異なります/)).toBeTruthy();
  expect(screen.getByText(/時間軸の表示範囲外にActionが1件あります/)).toBeTruthy();
  expect(screen.getByText(/一部が範囲外のActionは1件です/)).toBeTruthy();
  expect(screen.queryByTestId('today-axis-duration-action:reserved')).toBeNull();
  const clippedBand = screen.getByTestId('today-axis-duration-action:partial');
  expect(StyleSheet.flatten(clippedBand.props.style).height).toBeCloseTo(20);

  const details = within(screen.getByTestId('today-details-list'));
  expect(details.getByLabelText(/11:20から11:45、一部だけ表示されるAction/)).toBeTruthy();
  await fireEvent.press(details.getByRole('button', { name: '既存Actionを完了する' }));
  await waitFor(() => expect(props.executionRepository.transition).toHaveBeenCalled());
  expect(plan.window).toEqual(window);
});
