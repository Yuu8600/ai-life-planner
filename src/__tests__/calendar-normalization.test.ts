import {
  intersectsHalfOpenInterval,
  normalizeCalendarEvent,
  normalizeCalendarEvents,
} from '@/features/calendar/normalization';
import type { CalendarInterval } from '@/features/calendar/types';

const interval: CalendarInterval = {
  endAt: '2026-09-16T00:00:00.000Z',
  startAt: '2026-09-15T00:00:00.000Z',
};

const titles = new Map([['calendar-1', '仕事']]);

function event(overrides: Record<string, unknown> = {}) {
  return {
    allDay: false,
    availability: 'busy',
    calendarId: 'calendar-1',
    endDate: new Date('2026-09-15T11:00:00.000Z'),
    id: 'event-1',
    instanceId: 'instance-1',
    location: '会議室A',
    startDate: new Date('2026-09-15T10:00:00.000Z'),
    status: 'confirmed',
    timeZone: 'Asia/Tokyo',
    title: '定例会議',
    ...overrides,
  };
}

describe('Calendar event normalization', () => {
  it('converts a platform event to comparable ISO instants and preserves useful metadata', () => {
    expect(normalizeCalendarEvent(event(), titles)).toEqual({
      allDay: false,
      allDayEndDate: null,
      allDayStartDate: null,
      availability: 'busy',
      calendarId: 'calendar-1',
      calendarTitle: '仕事',
      endAt: '2026-09-15T11:00:00.000Z',
      id: 'event-1',
      instanceId: 'instance-1',
      location: '会議室A',
      startAt: '2026-09-15T10:00:00.000Z',
      status: 'confirmed',
      timeZone: 'Asia/Tokyo',
      title: '定例会議',
    });
  });

  it('preserves all-day and every supported availability without choosing busy semantics', () => {
    const values = ['busy', 'free', 'tentative', 'unavailable', 'notSupported'] as const;

    expect(
      values.map((availability) =>
        normalizeCalendarEvent(
          event({
            allDay: true,
            availability,
            endDate: '2026-09-16T00:00:00.000Z',
            startDate: '2026-09-15T00:00:00.000Z',
          }),
          titles,
        ),
      ),
    ).toEqual(
      values.map((availability) =>
        expect.objectContaining({
          allDay: true,
          availability: availability === 'notSupported' ? 'not-supported' : availability,
        }),
      ),
    );
  });

  it('uses null for unavailable timezone information and unknown for unfamiliar availability', () => {
    expect(
      normalizeCalendarEvent(event({ availability: 'maybe', timeZone: null }), titles),
    ).toEqual(expect.objectContaining({ availability: 'unknown', timeZone: null }));
  });

  it.each([
    ['missing start', { startDate: undefined }],
    ['missing end', { endDate: undefined }],
    ['invalid start', { startDate: 'not-a-date' }],
    ['equal start and end', { endDate: '2026-09-15T10:00:00.000Z' }],
    ['end before start', { endDate: '2026-09-15T09:59:00.000Z' }],
  ])('rejects %s without throwing', (_label, overrides) => {
    expect(normalizeCalendarEvent(event(overrides), titles)).toBeNull();
  });

  it('counts malformed events, filters non-overlapping events, and sorts all-day first', () => {
    const result = normalizeCalendarEvents(
      [
        event({ id: 'timed' }),
        event({
          allDay: true,
          endDate: '2026-09-16T00:00:00.000Z',
          id: 'all-day',
          startDate: '2026-09-15T00:00:00.000Z',
          title: '終日予定',
        }),
        event({
          id: 'outside',
          startDate: '2026-09-16T00:00:00Z',
          endDate: '2026-09-16T01:00:00Z',
        }),
        event({ id: 'invalid', startDate: null }),
      ],
      titles,
      interval,
      '2026-09-15',
    );

    expect(result.discardedEventCount).toBe(1);
    expect(result.events.map(({ id }) => id)).toEqual(['all-day', 'timed']);
  });

  it('keeps platform-expanded recurring occurrences as separate normalized events', () => {
    const result = normalizeCalendarEvents(
      [
        event({
          endDate: '2026-09-15T09:30:00Z',
          instanceId: 101,
          startDate: '2026-09-15T09:00:00Z',
        }),
        event({
          endDate: '2026-09-15T10:30:00Z',
          instanceId: 'instance-2',
          startDate: '2026-09-15T10:00:00Z',
        }),
      ],
      titles,
      interval,
      '2026-09-15',
    );

    expect(result.events.map(({ id, instanceId }) => ({ id, instanceId }))).toEqual([
      { id: 'event-1', instanceId: '101' },
      { id: 'event-1', instanceId: 'instance-2' },
    ]);
  });
});

describe('Calendar half-open interval intersection', () => {
  it.each([
    ['inside the day', '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z', true],
    ['crossing from previous day', '2026-09-14T23:00:00Z', '2026-09-15T01:00:00Z', true],
    ['crossing into next day', '2026-09-15T23:00:00Z', '2026-09-16T01:00:00Z', true],
    ['spanning the full day', '2026-09-14T00:00:00Z', '2026-09-17T00:00:00Z', true],
    ['ending exactly at day start', '2026-09-14T23:00:00Z', '2026-09-15T00:00:00Z', false],
    ['starting exactly at day start', '2026-09-15T00:00:00Z', '2026-09-15T01:00:00Z', true],
    ['ending exactly at day end', '2026-09-15T23:00:00Z', '2026-09-16T00:00:00Z', true],
    ['starting exactly at day end', '2026-09-16T00:00:00Z', '2026-09-16T01:00:00Z', false],
    ['fully before', '2026-09-14T10:00:00Z', '2026-09-14T11:00:00Z', false],
    ['fully after', '2026-09-16T10:00:00Z', '2026-09-16T11:00:00Z', false],
  ])('%s', (_label, startAt, endAt, expected) => {
    expect(intersectsHalfOpenInterval({ endAt, startAt }, interval)).toBe(expected);
  });
});
