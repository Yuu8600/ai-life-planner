import {
  nextCalendarWindow,
  recommendationIntervals,
} from '@/features/calendar/recommendationCalendar';
import type { CalendarEvent } from '@/features/calendar';
import { effectivePolicies, type RecommendationPolicy } from '@/features/recommendations/policy';
import { recommend, recommendationGroup } from '@/features/recommendations/recommend';
import type { Task } from '@/features/tasks/repositories/TaskRepository';

const date = '2026-11-18';
const at = (time: string) => Date.parse(`${date}T${time}:00Z`);
const start = new Date(at('00:00')).toISOString();
function event(from: string, to: string, patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'device event',
    id: from,
    calendarId: 'calendar',
    calendarTitle: null,
    instanceId: null,
    location: null,
    timeZone: null,
    status: 'confirmed',
    availability: 'busy',
    allDay: false,
    allDayStartDate: null,
    allDayEndDate: null,
    startAt: new Date(at(from)).toISOString(),
    endAt: new Date(at(to)).toISOString(),
    ...patch,
  };
}
function task(id: string, minutes: number, deadline: string | null = null): Task {
  return {
    id,
    title: id,
    estimatedMinutes: minutes,
    localDeadline: deadline,
    deadline: null,
    userId: 'owner',
    goalId: null,
    status: 'pending',
    priority: 'medium',
    createdAt: start,
    updatedAt: start,
  };
}
const policy: RecommendationPolicy = {
  id: 'p',
  policyKind: 'focus_task',
  targetTaskId: 'focus',
  startDate: '2026-11-16',
  endDate: '2026-11-22',
  source: 'ai',
  status: 'active',
  revision: 1,
  createdAt: start,
};

it('calculates the next occupied interval, ignoring canceled/free and unconfirmed all-day availability', () => {
  const events = [
    event('00:00', '23:59', { allDay: true, availability: 'unknown' }),
    event('01:00', '02:00', { status: 'canceled' }),
    event('01:10', '04:00', { availability: 'free' }),
    event('02:00', '03:00'),
    event('02:55', '03:30'),
  ];
  const intervals = recommendationIntervals(events, [], 'UTC');
  expect(nextCalendarWindow(intervals, at('01:30'), at('23:59'))).toEqual({
    minutes: 30,
    until: at('02:00'),
  });
  expect(nextCalendarWindow(intervals, at('03:00'), at('23:59'))).toEqual({
    minutes: 0,
    until: at('03:30'),
  });
  expect(nextCalendarWindow([], at('00:00'), at('23:59'))).toEqual({ minutes: null, until: null });
});

it('uses inclusive local dates and excludes revoked or expired policies with deterministic precedence', () => {
  const manual = { ...policy, id: 'manual', source: 'manual' as const };
  const newer = { ...policy, id: 'new', createdAt: '2026-11-19T00:00:00Z' };
  const revoked = { ...policy, id: 'revoked', status: 'revoked' as const };
  expect(effectivePolicies([policy, newer, revoked, manual], '2026-11-16')).toEqual([manual]);
  expect(effectivePolicies([policy, newer, revoked], '2026-11-22')).toEqual([newer]);
  expect(effectivePolicies([policy, manual], '2026-11-23')).toEqual([]);
});

it('keeps urgent tasks and ranks measured calendar fit and policy matches', () => {
  const base = {
    date,
    timezone: 'Asia/Tokyo',
    tasks: [
      task('urgent', 90, '2026-11-19'),
      task('focus', 45),
      task('fit', 15),
      task('other', 40),
    ],
    steps: [],
    results: [],
    expandedToday: true,
    conditions: { minutes: 60 as const, effort: 'normal' as const },
    calendarMinutes: 20,
  };
  const regular = recommend(base);
  expect(regular.candidates.slice(0, 2).map((item) => item.id)).toEqual(['urgent', 'fit']);
  expect(regular.candidates[1].reason).toContain('次の予定まで20分');
  const focused = recommend({ ...base, policies: [policy] });
  expect(focused.candidates.slice(0, 2).map((item) => item.id)).toEqual(['urgent', 'focus']);
  expect(focused.candidates[1].reason).toContain('優先設定中');
});

it('merges a cross-midnight fixed slot and overlapping device slots', () => {
  const device = [event('00:25', '00:50'), event('00:25', '00:50')];
  const fixed = [{ startAt: '2026-11-17T23:45:00Z', endAt: '2026-11-18T00:30:00Z' }];
  const intervals = recommendationIntervals(device, fixed, 'UTC');
  expect(nextCalendarWindow(intervals, at('00:10'), at('23:59'))).toEqual({
    minutes: 0,
    until: at('00:50'),
  });
});

it('treats a busy all-day event as a local date in the profile timezone', () => {
  const busy = event('00:00', '23:59', {
    allDay: true,
    allDayStartDate: date,
    allDayEndDate: '2026-11-19',
  });
  const intervals = recommendationIntervals([busy], [], 'Asia/Tokyo');
  expect(intervals).toEqual([
    {
      startAt: '2026-11-17T15:00:00.000Z',
      endAt: '2026-11-18T15:00:00.000Z',
    },
  ]);
  expect(nextCalendarWindow(intervals, at('08:00'), at('15:00')).minutes).toBe(0);
});

it('puts each candidate into exactly one group without claiming an unknown estimate fits', () => {
  const sample = {
    id: 'test',
    kind: 'task' as const,
    taskId: 'test',
    taskTitle: 'test',
    title: 'test',
    goalId: null,
    deadline: date,
    reason: '',
    urgent: true,
    minutes: 15,
  };
  expect(recommendationGroup(sample, 30, 20)).toBe('fits');
  expect(recommendationGroup(sample, 30, 10)).toBe('deadline');
  expect(recommendationGroup({ ...sample, minutes: null }, 30)).toBe('deadline');
  expect(recommendationGroup({ ...sample, minutes: null, urgent: false }, 30)).toBe('checkTime');
});
