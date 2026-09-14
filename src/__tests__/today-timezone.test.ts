import {
  formatLocalDateJa,
  formatLocalTimeJa,
  getLocalDate,
  getUtcDayBounds,
  InvalidLocalDateError,
  InvalidTimeZoneError,
  resolveTimeZone,
} from '@/features/today/timezone';

describe('Today timezone utilities', () => {
  it('determines the Asia/Tokyo local date across a UTC date boundary', () => {
    expect(getLocalDate('2026-09-12T14:59:59.999Z', 'Asia/Tokyo')).toBe('2026-09-12');
    expect(getLocalDate('2026-09-12T15:00:00.000Z', 'Asia/Tokyo')).toBe('2026-09-13');
  });

  it('converts a Tokyo local day to an exclusive UTC range', () => {
    const bounds = getUtcDayBounds('2026-09-13', 'Asia/Tokyo');

    expect(bounds).toEqual({
      endAt: '2026-09-13T15:00:00.000Z',
      startAt: '2026-09-12T15:00:00.000Z',
    });
    expect(getLocalDate(Date.parse(bounds.startAt) - 1, 'Asia/Tokyo')).toBe('2026-09-12');
    expect(getLocalDate(bounds.startAt, 'Asia/Tokyo')).toBe('2026-09-13');
    expect(getLocalDate(Date.parse(bounds.endAt) - 1, 'Asia/Tokyo')).toBe('2026-09-13');
    expect(getLocalDate(bounds.endAt, 'Asia/Tokyo')).toBe('2026-09-14');
  });

  it('uses the next local midnight across a daylight-saving transition', () => {
    const bounds = getUtcDayBounds('2024-03-10', 'America/New_York');

    expect(bounds).toEqual({
      endAt: '2024-03-11T04:00:00.000Z',
      startAt: '2024-03-10T05:00:00.000Z',
    });
    expect(Date.parse(bounds.endAt) - Date.parse(bounds.startAt)).toBe(23 * 60 * 60 * 1_000);
  });

  it('formats Japanese local dates and zero-padded times in the profile timezone', () => {
    const instant = '2026-09-12T15:05:00.000Z';

    expect(formatLocalDateJa(instant, 'Asia/Tokyo')).toBe('2026年9月13日（日）');
    expect(formatLocalTimeJa(instant, 'Asia/Tokyo')).toBe('00:05');
  });

  it('rejects an invalid timezone without falling back to the device timezone', () => {
    expect(() => resolveTimeZone('Not/A_Time_Zone')).toThrow(InvalidTimeZoneError);
    expect(() => getLocalDate('2026-09-13T00:00:00.000Z', 'Not/A_Time_Zone')).toThrow(
      InvalidTimeZoneError,
    );
    expect(() => getUtcDayBounds('2026-09-13', '')).toThrow(InvalidTimeZoneError);
  });

  it('rejects impossible or non-ISO local dates', () => {
    expect(() => getUtcDayBounds('2026-02-29', 'Asia/Tokyo')).toThrow(InvalidLocalDateError);
    expect(() => getUtcDayBounds('2026/09/13', 'Asia/Tokyo')).toThrow(InvalidLocalDateError);
  });
});
