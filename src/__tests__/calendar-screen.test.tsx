import { DemoRepositories } from '@/services/demo/DemoRepositories';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import type {
  CalendarEventsResult,
  CalendarPermission,
  CalendarRepository,
} from '@/features/calendar/repositories/CalendarRepository';
import type { CalendarEvent } from '@/features/calendar/types';
import type { SettingsRepository } from '@/features/settings';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

const now = () => new Date('2026-09-15T03:00:00.000Z');
const settings = {
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
  minimumFreeMinutes: 30,
  planningEnd: '22:00',
  planningEndDayOffset: 0 as const,
  planningStart: '08:00',
  timezone: 'Asia/Tokyo',
};

const timedEvent: CalendarEvent = {
  allDay: false,
  allDayEndDate: null,
  allDayStartDate: null,
  availability: 'free',
  calendarId: 'calendar-1',
  calendarTitle: '仕事',
  endAt: '2026-09-15T00:00:00.000Z',
  id: 'timed',
  instanceId: null,
  location: '会議室A',
  startAt: '2026-09-14T23:00:00.000Z',
  status: 'confirmed',
  timeZone: 'Asia/Tokyo',
  title: '朝会',
};

const allDayEvent: CalendarEvent = {
  ...timedEvent,
  allDay: true,
  allDayEndDate: '2026-09-16',
  allDayStartDate: '2026-09-15',
  availability: 'busy',
  endAt: '2026-09-15T15:00:00.000Z',
  id: 'all-day',
  location: null,
  startAt: '2026-09-14T15:00:00.000Z',
  title: '終日予定',
};

const busyEvent: CalendarEvent = {
  ...timedEvent,
  availability: 'busy',
  endAt: '2026-09-15T01:00:00.000Z',
  id: 'busy',
  startAt: '2026-09-15T00:00:00.000Z',
  title: '会議',
};

function createSettingsRepository(
  overrides: Partial<SettingsRepository> = {},
): jest.Mocked<SettingsRepository> {
  return {
    getProfilePlanningSettings: jest.fn(async () => settings),
    updateProfilePlanningSettings: jest.fn(async (input) => input),
    ...overrides,
  } as jest.Mocked<SettingsRepository>;
}

function createCalendarRepository(
  overrides: Partial<CalendarRepository> = {},
): jest.Mocked<CalendarRepository> {
  return {
    getPermission: jest.fn<Promise<CalendarPermission>, []>(async () => ({
      canAskAgain: true,
      status: 'granted',
    })),
    listEvents: jest.fn<
      ReturnType<CalendarRepository['listEvents']>,
      Parameters<CalendarRepository['listEvents']>
    >(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [allDayEvent, timedEvent],
    })),
    requestPermission: jest.fn<Promise<CalendarPermission>, []>(async () => ({
      canAskAgain: true,
      status: 'granted',
    })),
    ...overrides,
  } as jest.Mocked<CalendarRepository>;
}

async function renderCalendar(
  calendarRepository: CalendarRepository | null,
  settingsRepository: SettingsRepository | null = createSettingsRepository(),
  onOpenSettings = jest.fn(),
) {
  return render(
    <CalendarScreen
      calendarRepository={calendarRepository}
      now={now}
      onOpenSettings={onOpenSettings}
      settingsRepository={settingsRepository}
    />,
  );
}

describe('CalendarScreen', () => {
  it('shows checking while profile and permission state are loading', async () => {
    const deferred = createDeferred<CalendarPermission>();
    const repository = createCalendarRepository({
      getPermission: jest.fn(() => deferred.promise),
    });
    const screen = await renderCalendar(repository);

    expect(screen.getByTestId('calendar-checking-state')).toBeTruthy();

    await act(async () => {
      deferred.resolve({ canAskAgain: true, status: 'granted' });
      await deferred.promise;
    });

    expect(await screen.findByText('終日予定')).toBeTruthy();
  });

  it('requests permission only after the user acts and then loads events', async () => {
    const repository = createCalendarRepository({
      getPermission: jest.fn(
        async () => ({ canAskAgain: true, status: 'undetermined' }) satisfies CalendarPermission,
      ),
    });
    const screen = await renderCalendar(repository);

    expect(await screen.findByTestId('calendar-permission-prompt')).toBeTruthy();
    expect(repository.requestPermission).not.toHaveBeenCalled();
    expect(repository.listEvents).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'アクセスを許可する' }));

    expect(await screen.findByText('朝会')).toBeTruthy();
    expect(repository.requestPermission).toHaveBeenCalledTimes(1);
    expect(repository.listEvents).toHaveBeenCalledTimes(1);
  });

  it('explains denied permission and opens OS settings when it cannot ask again', async () => {
    const onOpenSettings = jest.fn();
    const repository = createCalendarRepository({
      getPermission: jest.fn(
        async () => ({ canAskAgain: false, status: 'denied' }) satisfies CalendarPermission,
      ),
    });
    const screen = await renderCalendar(repository, createSettingsRepository(), onOpenSettings);

    expect(await screen.findByText(/OS設定でこのアプリのカレンダー権限/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'OS設定を開く' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('allows a denied permission to be requested again when the OS permits it', async () => {
    const repository = createCalendarRepository({
      getPermission: jest.fn(
        async () => ({ canAskAgain: true, status: 'denied' }) satisfies CalendarPermission,
      ),
    });
    const screen = await renderCalendar(repository);

    await fireEvent.press(screen.getByRole('button', { name: 'もう一度許可する' }));

    expect(await screen.findByText('朝会')).toBeTruthy();
    expect(repository.requestPermission).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'no readable calendars',
      { calendarCount: 0, discardedEventCount: 0, events: [] },
      'calendar-no-calendars-state',
    ],
    [
      'no events on the selected date',
      { calendarCount: 1, discardedEventCount: 0, events: [] },
      'calendar-empty-state',
    ],
  ])('shows the %s state', async (_label, result, testID) => {
    const repository = createCalendarRepository({ listEvents: jest.fn(async () => result) });
    const screen = await renderCalendar(repository);

    expect(await screen.findByTestId(testID)).toBeTruthy();
  });

  it('shows normalized timed and all-day events with source metadata', async () => {
    const screen = await renderCalendar(createCalendarRepository());

    expect(await screen.findByText('終日予定')).toBeTruthy();
    expect(screen.getByText('終日')).toBeTruthy();
    expect(screen.getByText('朝会')).toBeTruthy();
    expect(screen.getByText('08:00–09:00')).toBeTruthy();
    expect(screen.getAllByText('空き時間')).toHaveLength(2);
    expect(screen.getAllByText('仕事')).toHaveLength(2);
    expect(screen.getByText('会議室A')).toBeTruthy();
  });

  it('shows free time calculated from profile planning settings and blocking events', async () => {
    const repository = createCalendarRepository({
      listEvents: jest.fn(async () => ({
        calendarCount: 1,
        discardedEventCount: 0,
        events: [busyEvent],
      })),
    });
    const screen = await renderCalendar(repository);

    expect(await screen.findByTestId('calendar-free-time')).toBeTruthy();
    expect(screen.getByText('08:00–09:00')).toBeTruthy();
    expect(screen.getByText('60分')).toBeTruthy();
    expect(screen.getByText('10:00–22:00')).toBeTruthy();
    expect(screen.getByText('720分')).toBeTruthy();
  });

  it('shows no free slots when a blocking all-day event covers the selected date', async () => {
    const screen = await renderCalendar(createCalendarRepository());

    expect(await screen.findByTestId('calendar-free-time')).toBeTruthy();
    expect(screen.getByText('条件を満たす空き時間はありません。')).toBeTruthy();
  });

  it('shows a safe error and retries event loading', async () => {
    const listEvents = jest
      .fn<
        ReturnType<CalendarRepository['listEvents']>,
        Parameters<CalendarRepository['listEvents']>
      >()
      .mockRejectedValueOnce(new Error('private provider failure'))
      .mockResolvedValueOnce({ calendarCount: 1, discardedEventCount: 0, events: [timedEvent] });
    const repository = createCalendarRepository({ listEvents });
    const screen = await renderCalendar(repository);

    expect(await screen.findByTestId('calendar-error-state')).toBeTruthy();
    expect(screen.queryByText(/private provider failure/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));

    expect(await screen.findByText('朝会')).toBeTruthy();
    expect(listEvents).toHaveBeenCalledTimes(2);
  });

  it('loads profile-timezone day bounds when navigating to previous and next dates', async () => {
    const emptyResult: CalendarEventsResult = {
      calendarCount: 1,
      discardedEventCount: 0,
      events: [],
    };
    const listEvents = jest.fn<
      ReturnType<CalendarRepository['listEvents']>,
      Parameters<CalendarRepository['listEvents']>
    >(async () => emptyResult);
    const repository = createCalendarRepository({ listEvents });
    const screen = await renderCalendar(repository);

    expect(await screen.findByText('2026年9月15日（火）')).toBeTruthy();
    expect(screen.getAllByText('2026年9月15日（火）')).toHaveLength(1);
    expect(screen.getByText('今日')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '今日に戻る' })).toBeNull();
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: '次の日を表示' }));
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(2));
    expect(screen.getByText('2026年9月16日（水）')).toBeTruthy();
    expect(screen.queryByText('今日')).toBeNull();
    expect(listEvents).toHaveBeenLastCalledWith(
      {
        endAt: '2026-09-16T15:00:00.000Z',
        startAt: '2026-09-15T15:00:00.000Z',
      },
      '2026-09-16',
    );

    await fireEvent.press(screen.getByRole('button', { name: '今日に戻る' }));
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(3));
    expect(listEvents).toHaveBeenLastCalledWith(
      {
        endAt: '2026-09-15T15:00:00.000Z',
        startAt: '2026-09-14T15:00:00.000Z',
      },
      '2026-09-15',
    );
    expect(screen.getByText('今日')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '今日に戻る' })).toBeNull();
  });

  it.each([
    [
      '2026-09-30T03:00:00Z',
      '2026年9月30日（水）',
      '2026年10月1日（木）',
      '2026-10-01',
      '2026-09-30T15:00:00.000Z',
      '2026-10-01T15:00:00.000Z',
    ],
    [
      '2026-12-31T03:00:00Z',
      '2026年12月31日（木）',
      '2027年1月1日（金）',
      '2027-01-01',
      '2026-12-31T15:00:00.000Z',
      '2027-01-01T15:00:00.000Z',
    ],
    [
      '2028-02-28T03:00:00Z',
      '2028年2月28日（月）',
      '2028年2月29日（火）',
      '2028-02-29',
      '2028-02-28T15:00:00.000Z',
      '2028-02-29T15:00:00.000Z',
    ],
  ])(
    'navigates both directions across date boundaries from %s',
    async (instant, initialLabel, nextLabel, nextDate, startAt, endAt) => {
      const repository = createCalendarRepository({
        listEvents: jest.fn(async () => ({ calendarCount: 1, discardedEventCount: 0, events: [] })),
      });
      const clock = () => new Date(instant);
      const screen = await render(
        <CalendarScreen
          calendarRepository={repository}
          now={clock}
          settingsRepository={createSettingsRepository()}
        />,
      );
      expect(await screen.findByText(initialLabel)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: '次の日を表示' }));
      expect(await screen.findByText(nextLabel)).toBeTruthy();
      await waitFor(() =>
        expect(repository.listEvents).toHaveBeenLastCalledWith({ startAt, endAt }, nextDate),
      );
      await fireEvent.press(screen.getByRole('button', { name: '前の日を表示' }));
      expect(await screen.findByText(initialLabel)).toBeTruthy();
      await waitFor(() => expect(repository.listEvents).toHaveBeenCalledTimes(3));
      expect(repository.listEvents.mock.calls[2]).toEqual(repository.listEvents.mock.calls[0]);
      expect(screen.getByText('今日')).toBeTruthy();
    },
  );

  it('uses the profile timezone and injected clock for today and returning after midnight', async () => {
    let instant = '2027-01-01T03:00:00Z';
    const clock = () => new Date(instant);
    const repository = createCalendarRepository({
      listEvents: jest.fn(async () => ({ calendarCount: 1, discardedEventCount: 0, events: [] })),
    });
    const screen = await render(
      <CalendarScreen
        calendarRepository={repository}
        now={clock}
        settingsRepository={createSettingsRepository({
          getProfilePlanningSettings: jest.fn(async () => ({
            ...settings,
            timezone: 'America/Los_Angeles',
          })),
        })}
      />,
    );
    expect(await screen.findByText('2026年12月31日（木）')).toBeTruthy();
    expect(screen.getByText('今日')).toBeTruthy();
    await waitFor(() =>
      expect(repository.listEvents).toHaveBeenLastCalledWith(
        {
          startAt: '2026-12-31T08:00:00.000Z',
          endAt: '2027-01-01T08:00:00.000Z',
        },
        '2026-12-31',
      ),
    );
    await fireEvent.press(screen.getByRole('button', { name: '前の日を表示' }));
    expect(await screen.findByText('2026年12月30日（水）')).toBeTruthy();
    instant = '2027-01-01T09:00:00Z';
    await fireEvent.press(screen.getByRole('button', { name: '今日に戻る' }));
    expect(await screen.findByText('2027年1月1日（金）')).toBeTruthy();
    expect(screen.getByText('今日')).toBeTruthy();
    await waitFor(() =>
      expect(repository.listEvents).toHaveBeenLastCalledWith(
        {
          startAt: '2027-01-01T08:00:00.000Z',
          endAt: '2027-01-02T08:00:00.000Z',
        },
        '2027-01-01',
      ),
    );
  });

  it('shows profile errors without calling the native event API', async () => {
    const repository = createCalendarRepository();
    const settingsRepository = createSettingsRepository({
      getProfilePlanningSettings: jest.fn(async () => Promise.reject(new Error('profile failed'))),
    });
    const screen = await renderCalendar(repository, settingsRepository);

    expect(await screen.findByTestId('calendar-error-state')).toBeTruthy();
    expect(repository.listEvents).not.toHaveBeenCalled();
  });
});

it('shows buffer-adjusted free time without changing the displayed event times', async () => {
  const repository = createCalendarRepository({
    listEvents: jest.fn(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [busyEvent],
    })),
  });
  const screen = await renderCalendar(
    repository,
    createSettingsRepository({
      getProfilePlanningSettings: jest.fn(async () => ({
        ...settings,
        calendarBufferBeforeMinutes: 15,
        calendarBufferAfterMinutes: 30,
      })),
    }),
  );
  expect(await screen.findByTestId('calendar-free-time')).toBeTruthy();
  expect(screen.getByText('08:00–08:45')).toBeTruthy();
  expect(screen.getByText('10:30–22:00')).toBeTruthy();
  expect(screen.getByText('09:00–10:00')).toBeTruthy();
  expect(screen.getByText('予定前後の余白時間を除いて計算しています。')).toBeTruthy();
  expect(repository.listEvents).toHaveBeenCalledTimes(3);
});

it('edits only eligible Calendar cards and recalculates after saving or restoring common buffers', async () => {
  const store = new DemoRepositories().eventBufferRepository;
  const repository = createCalendarRepository({
    listEvents: jest.fn(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [
        busyEvent,
        timedEvent,
        { ...allDayEvent, availability: 'free' as const },
        { ...busyEvent, id: 'canceled', status: 'canceled' as const, title: '中止' },
      ],
    })),
  });
  const screen = await render(
    <CalendarScreen
      calendarRepository={repository}
      eventBufferRepository={store}
      settingsRepository={createSettingsRepository()}
      now={now}
    />,
  );
  await screen.findByRole('button', { name: '会議の余白を設定' });
  expect(screen.queryByRole('button', { name: '朝会の余白を設定' })).toBeNull();
  expect(screen.queryByRole('button', { name: '終日予定の余白を設定' })).toBeNull();
  expect(screen.queryByRole('button', { name: '中止の余白を設定' })).toBeNull();
  expect(within(screen.getByTestId('calendar-free-time')).getByText('08:00–09:00')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '会議の余白を設定' }));
  await fireEvent.press(screen.getByText('この予定だけ変更する'));
  await fireEvent.changeText(screen.getByLabelText('この予定の前の余白（分）'), '30');
  await fireEvent.press(screen.getByText('余白設定を保存'));
  expect(await screen.findByText('個別余白')).toBeTruthy();
  expect(within(screen.getByTestId('calendar-free-time')).getByText('08:00–08:30')).toBeTruthy();
  expect(await store.list()).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: '会議の余白を設定' }));
  await fireEvent.press(screen.getByText('共通設定を使う'));
  await fireEvent.press(screen.getByText('余白設定を保存'));
  await waitFor(() => expect(screen.queryByText('個別余白')).toBeNull());
  expect(await store.list()).toEqual([]);
});
