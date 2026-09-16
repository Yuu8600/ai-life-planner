import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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
  minimumFreeMinutes: 30,
  planningEnd: '22:00',
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
    expect(screen.getByText('空き時間')).toBeTruthy();
    expect(screen.getAllByText('仕事')).toHaveLength(2);
    expect(screen.getByText('会議室A')).toBeTruthy();
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
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: '次の日を表示' }));
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(2));
    expect(listEvents).toHaveBeenLastCalledWith(
      {
        endAt: '2026-09-16T15:00:00.000Z',
        startAt: '2026-09-15T15:00:00.000Z',
      },
      '2026-09-16',
    );

    await fireEvent.press(screen.getByRole('button', { name: '前の日を表示' }));
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(3));
    expect(listEvents).toHaveBeenLastCalledWith(
      {
        endAt: '2026-09-15T15:00:00.000Z',
        startAt: '2026-09-14T15:00:00.000Z',
      },
      '2026-09-15',
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
