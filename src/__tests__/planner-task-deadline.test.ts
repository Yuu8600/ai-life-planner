import { getPlannerTaskDeadlineDate } from '@/features/planner/plannerTaskDeadline';

describe('Planner Task deadline semantics', () => {
  it('returns null when a Task has no deadline', () => {
    expect(getPlannerTaskDeadlineDate(null, 'Asia/Tokyo')).toBeNull();
  });

  it.each([
    ['overdue', '2026-09-16T14:59:59.999Z', '2026-09-16'],
    ['today', '2026-09-17T14:59:59.999Z', '2026-09-17'],
    ['tomorrow', '2026-09-17T15:00:00.000Z', '2026-09-18'],
  ])('resolves a %s deadline in the profile timezone', (_label, deadline, expected) => {
    expect(getPlannerTaskDeadlineDate(deadline, 'Asia/Tokyo')).toBe(expected);
  });

  it('uses the profile date across a UTC date boundary', () => {
    expect(getPlannerTaskDeadlineDate('2026-09-16T23:30:00.000Z', 'Asia/Tokyo')).toBe('2026-09-17');
  });

  it('uses the previous New York local date near a UTC boundary', () => {
    expect(getPlannerTaskDeadlineDate('2026-09-18T03:30:00.000Z', 'America/New_York')).toBe(
      '2026-09-17',
    );
  });

  it('rejects invalid instants and timezones instead of falling back', () => {
    expect(() => getPlannerTaskDeadlineDate('invalid', 'Asia/Tokyo')).toThrow();
    expect(() => getPlannerTaskDeadlineDate('2026-09-17T00:00:00.000Z', 'Mars/Olympus')).toThrow();
  });
});
