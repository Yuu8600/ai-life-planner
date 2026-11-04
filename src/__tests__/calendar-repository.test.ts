import { CalendarUnavailableError } from '@/features/calendar/errors';
import { calculateFreeTime } from '@/features/planner';
import { getUtcDayBounds } from '@/features/today';
import {
  type CalendarNativeApi,
  ExpoCalendarRepository,
} from '@/services/calendar/ExpoCalendarRepository';

const interval = {
  endAt: '2026-09-15T15:00:00.000Z',
  startAt: '2026-09-14T15:00:00.000Z',
};
const localDate = '2026-09-15';

function createNativeApi(
  overrides: Partial<jest.Mocked<CalendarNativeApi>> = {},
): jest.Mocked<CalendarNativeApi> {
  return {
    getEventCalendars: jest.fn(async () => [
      { accessLevel: 'read', entityType: 'event', id: 'calendar-1', title: '仕事' },
    ]),
    getPermission: jest.fn(async () => ({ canAskAgain: true, status: 'granted' })),
    listEvents: jest.fn<
      ReturnType<CalendarNativeApi['listEvents']>,
      Parameters<CalendarNativeApi['listEvents']>
    >(async () => [
      {
        allDay: false,
        availability: 'free',
        calendarId: 'calendar-1',
        endDate: '2026-09-15T01:00:00.000Z',
        id: 'event-1',
        startDate: '2026-09-15T00:00:00.000Z',
        title: '予定',
      },
    ]),
    requestPermission: jest.fn(async () => ({ canAskAgain: false, status: 'denied' })),
    ...overrides,
  };
}

describe('ExpoCalendarRepository', () => {
  it('maps granted, denied, and undetermined permission responses', async () => {
    const api = createNativeApi();
    const repository = new ExpoCalendarRepository(api, 'android');

    await expect(repository.getPermission()).resolves.toEqual({
      canAskAgain: true,
      status: 'granted',
    });
    await expect(repository.requestPermission()).resolves.toEqual({
      canAskAgain: false,
      status: 'denied',
    });

    api.getPermission.mockResolvedValueOnce({ canAskAgain: true, status: 'undetermined' });
    await expect(repository.getPermission()).resolves.toEqual({
      canAskAgain: true,
      status: 'undetermined',
    });
  });

  it('loads only readable, visible event calendars and normalizes returned occurrences', async () => {
    const api = createNativeApi({
      getEventCalendars: jest.fn(async () => [
        { accessLevel: 'read', entityType: 'event', id: 'calendar-1', title: '仕事' },
        { accessLevel: 'none', entityType: 'event', id: 'private', title: '非公開' },
        { accessLevel: 'read', entityType: 'reminder', id: 'reminders', title: 'Reminder' },
        {
          accessLevel: 'read',
          entityType: 'event',
          id: 'hidden',
          isVisible: false,
          title: '非表示',
        },
      ]),
    });
    const repository = new ExpoCalendarRepository(api, 'ios', () => 'Asia/Tokyo');

    await expect(repository.listEvents(interval, localDate)).resolves.toEqual({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [
        expect.objectContaining({
          availability: 'free',
          calendarId: 'calendar-1',
          calendarTitle: '仕事',
          id: 'event-1',
        }),
      ],
    });
    expect(api.listEvents).toHaveBeenCalledWith(
      ['calendar-1'],
      new Date(interval.startAt),
      new Date(interval.endAt),
    );
  });

  it('does not call the event API when there are no readable calendars', async () => {
    const api = createNativeApi({ getEventCalendars: jest.fn(async () => []) });
    const repository = new ExpoCalendarRepository(api, 'android');

    await expect(repository.listEvents(interval, localDate)).resolves.toEqual({
      calendarCount: 0,
      discardedEventCount: 0,
      events: [],
    });
    expect(api.listEvents).not.toHaveBeenCalled();
  });

  it.each([
    ['Asia/Tokyo', '2026-11-04T15:00:00.000Z', '2026-11-05T14:59:59.000Z', '2026-11-05'],
    ['Asia/Tokyo', '2026-11-04T15:00:00.000Z', '2026-11-05T15:00:00.000Z', '2026-11-05'],
    ['America/Los_Angeles', '2026-03-08T08:00:00.000Z', '2026-03-09T07:00:00.000Z', '2026-03-08'],
    ['Pacific/Kiritimati', '2026-11-04T10:00:00.000Z', '2026-11-05T10:00:00.000Z', '2026-11-05'],
  ])(
    'keeps iOS all-day dates in %s independently of the profile timezone',
    async (deviceZone, startDate, endDate, date) => {
      const profileZone = 'Etc/GMT+12';
      const day = getUtcDayBounds(date, profileZone);
      const rawEvent = {
        allDay: true,
        availability: 'busy',
        calendarId: 'calendar-1',
        id: 'all-day',
        startDate,
        endDate,
        timeZone: null,
      };
      const api = createNativeApi({
        listEvents: jest.fn(async (_ids, start, end) =>
          Date.parse(startDate) < end.getTime() && Date.parse(endDate) > start.getTime()
            ? [rawEvent]
            : [],
        ),
      });
      const repository = new ExpoCalendarRepository(api, 'ios', () => deviceZone);
      const result = await repository.listEvents(day, date);

      expect(result.events).toEqual([
        expect.objectContaining({ allDayStartDate: date, allDay: true }),
      ]);
      expect(
        calculateFreeTime({
          events: result.events,
          minimumFreeMinutes: 20,
          planningStart: '09:00',
          planningEnd: '18:00',
          selectedDate: date,
          timezone: profileZone,
        }).freeSlots,
      ).toEqual([]);
      const previousDate = startDate.slice(0, 10);
      if (previousDate !== date) {
        expect(
          (await repository.listEvents(getUtcDayBounds(previousDate, profileZone), previousDate))
            .events,
        ).toEqual([]);
      }
      const nextDate = new Date(Date.parse(date + 'T00:00:00Z') + 86400000)
        .toISOString()
        .slice(0, 10);
      expect(
        (await repository.listEvents(getUtcDayBounds(nextDate, profileZone), nextDate)).events,
      ).toEqual([]);
    },
  );

  it('retains Android UTC all-day dates and its original query interval', async () => {
    const api = createNativeApi({
      listEvents: jest.fn<
        ReturnType<CalendarNativeApi['listEvents']>,
        Parameters<CalendarNativeApi['listEvents']>
      >(async () => [
        {
          allDay: true,
          calendarId: 'calendar-1',
          id: 'all-day',
          startDate: '2026-09-15T00:00:00Z',
          endDate: '2026-09-16T00:00:00Z',
        },
      ]),
    });
    const repository = new ExpoCalendarRepository(api, 'android', () => 'America/Los_Angeles');
    expect((await repository.listEvents(interval, localDate)).events[0]).toEqual(
      expect.objectContaining({ allDayStartDate: localDate, allDayEndDate: '2026-09-16' }),
    );
    expect(api.listEvents).toHaveBeenCalledWith(
      ['calendar-1'],
      new Date(interval.startAt),
      new Date(interval.endAt),
    );
  });

  it('filters timed events outside the profile day after widening the iOS query', async () => {
    const day = getUtcDayBounds('2026-11-05', 'America/Los_Angeles');
    const api = createNativeApi({
      listEvents: jest.fn<
        ReturnType<CalendarNativeApi['listEvents']>,
        Parameters<CalendarNativeApi['listEvents']>
      >(async () => [
        {
          allDay: false,
          calendarId: 'calendar-1',
          id: 'outside-profile-day',
          startDate: '2026-11-05T01:00:00Z',
          endDate: '2026-11-05T02:00:00Z',
        },
      ]),
    });
    const repository = new ExpoCalendarRepository(api, 'ios', () => 'Asia/Tokyo');
    expect((await repository.listEvents(day, '2026-11-05')).events).toEqual([]);
    expect(api.listEvents).toHaveBeenCalledWith(
      ['calendar-1'],
      new Date('2026-11-04T15:00:00Z'),
      new Date(day.endAt),
    );
  });

  it('propagates native read errors and translates Expo Go unavailability', async () => {
    const nativeError = new Error('provider failed');
    const nativeApi = createNativeApi({
      getEventCalendars: jest.fn(async () => Promise.reject(nativeError)),
    });
    const expoGoApi = createNativeApi({
      getPermission: jest.fn(async () =>
        Promise.reject(new Error('Calendar@next functionality is not available in Expo Go')),
      ),
    });

    await expect(
      new ExpoCalendarRepository(nativeApi, 'android').listEvents(interval, localDate),
    ).rejects.toBe(nativeError);
    await expect(
      new ExpoCalendarRepository(expoGoApi, 'android').getPermission(),
    ).rejects.toBeInstanceOf(CalendarUnavailableError);
  });

  it('reports unsupported platforms as unavailable before touching native APIs', async () => {
    const api = createNativeApi();
    const repository = new ExpoCalendarRepository(api, 'web');

    await expect(repository.getPermission()).rejects.toBeInstanceOf(CalendarUnavailableError);
    expect(api.getPermission).not.toHaveBeenCalled();
  });
});
