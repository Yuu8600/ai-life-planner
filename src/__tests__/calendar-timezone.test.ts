import {
  intersectsCalendarDay,
  normalizeCalendarEvent,
  normalizeCalendarEvents,
  occursOnCalendarDate,
} from '@/features/calendar/normalization';
import { toCalendarEventViewModel } from '@/features/calendar/presentation';
import type { CalendarEvent } from '@/features/calendar/types';
import { getUtcDayBounds } from '@/features/today/timezone';

const calendarTitles = new Map([['calendar-1', 'テスト']]);

const overnightEvent: CalendarEvent = {
  allDay: false,
  allDayEndDate: null,
  allDayStartDate: null,
  availability: 'busy',
  calendarId: 'calendar-1',
  calendarTitle: 'テスト',
  endAt: '2026-09-16T16:00:00.000Z',
  id: 'overnight-event',
  instanceId: null,
  location: null,
  startAt: '2026-09-16T14:00:00.000Z',
  status: 'confirmed',
  timeZone: 'Asia/Tokyo',
  title: '日跨ぎテスト',
};

describe('Calendar timezone handling', () => {
  it('preserves the UTC instants returned by the calendar boundary', () => {
    expect(
      normalizeCalendarEvent(
        {
          allDay: false,
          availability: 'busy',
          calendarId: 'calendar-1',
          endDate: '2026-09-16T16:00:00.000Z',
          id: 'overnight-event',
          startDate: '2026-09-16T14:00:00.000Z',
          status: 'confirmed',
          timeZone: 'Asia/Tokyo',
          title: '日跨ぎテスト',
        },
        calendarTitles,
      ),
    ).toEqual(expect.objectContaining(overnightEvent));
  });

  it('includes an overnight event in both Tokyo local days it overlaps', () => {
    expect(
      intersectsCalendarDay(
        overnightEvent,
        getUtcDayBounds('2026-09-16', 'Asia/Tokyo'),
        '2026-09-16',
      ),
    ).toBe(true);
    expect(
      intersectsCalendarDay(
        overnightEvent,
        getUtcDayBounds('2026-09-17', 'Asia/Tokyo'),
        '2026-09-17',
      ),
    ).toBe(true);
  });

  it('formats UTC instants as 23:00 and next-day 01:00 in Asia/Tokyo', () => {
    expect(toCalendarEventViewModel(overnightEvent, '2026-09-16', 'Asia/Tokyo').timeLabel).toBe(
      '23:00–9/17 01:00',
    );
  });

  it('formats a daytime UTC instant once without adding the Tokyo offset twice', () => {
    const daytimeEvent: CalendarEvent = {
      ...overnightEvent,
      endAt: '2026-09-16T01:00:00.000Z',
      id: 'daytime-event',
      startAt: '2026-09-16T00:00:00.000Z',
      title: '日中テスト',
    };

    expect(toCalendarEventViewModel(daytimeEvent, '2026-09-16', 'Asia/Tokyo').timeLabel).toBe(
      '09:00–10:00',
    );
  });
});

describe('All-day calendar-date handling', () => {
  const singleDay = {
    allDayEndDate: '2026-09-16',
    allDayStartDate: '2026-09-15',
  };
  const multiDay = {
    allDayEndDate: '2026-09-18',
    allDayStartDate: '2026-09-15',
  };

  it.each([
    ['2026-09-14', false],
    ['2026-09-15', true],
    ['2026-09-16', false],
  ])('matches a single-day all-day event on %s: %s', (localDate, expected) => {
    expect(occursOnCalendarDate(singleDay, localDate)).toBe(expected);
  });

  it.each([
    ['2026-09-15', true],
    ['2026-09-16', true],
    ['2026-09-17', true],
    ['2026-09-18', false],
  ])('matches a multi-day all-day event on %s: %s', (localDate, expected) => {
    expect(occursOnCalendarDate(multiDay, localDate)).toBe(expected);
  });

  it('does not shift an all-day UTC date boundary in Asia/Tokyo', () => {
    const rawEvent = {
      allDay: true,
      calendarId: 'calendar-1',
      endDate: '2026-09-16T00:00:00.000Z',
      id: 'all-day-event',
      startDate: '2026-09-15T00:00:00.000Z',
      timeZone: 'UTC',
      title: 'テスト１',
    };

    expect(
      normalizeCalendarEvents(
        [rawEvent],
        calendarTitles,
        getUtcDayBounds('2026-09-15', 'Asia/Tokyo'),
        '2026-09-15',
      ).events,
    ).toEqual([
      expect.objectContaining({
        allDayEndDate: '2026-09-16',
        allDayStartDate: '2026-09-15',
      }),
    ]);
    expect(
      normalizeCalendarEvents(
        [rawEvent],
        calendarTitles,
        getUtcDayBounds('2026-09-16', 'Asia/Tokyo'),
        '2026-09-16',
      ).events,
    ).toEqual([]);
  });
});
