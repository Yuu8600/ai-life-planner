import type { CalendarEvent } from '@/features/calendar';
import type { Goal } from '@/features/goals/repositories/GoalRepository';
import type { ProfilePlanningSettings } from '@/features/settings';
import type { Task } from '@/features/tasks/repositories/TaskRepository';
import { addLocalDays, getUtcInstantForLocalTime } from '@/features/today';

// A visible, frozen sample day makes the demo useful at any real-world visit time.
export const DEMO_DATE = '2026-11-06';
export const DEMO_TIMEZONE = 'Asia/Tokyo';
export const DEMO_START = getUtcInstantForLocalTime(DEMO_DATE, '08:00', DEMO_TIMEZONE);
export const DEMO_OVERNIGHT = getUtcInstantForLocalTime(
  addLocalDays(DEMO_DATE, 1),
  '01:00',
  DEMO_TIMEZONE,
);
export const DEMO_AFTERNOON = getUtcInstantForLocalTime(DEMO_DATE, '15:00', DEMO_TIMEZONE);

export const DEMO_SETTINGS: ProfilePlanningSettings = {
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
  minimumFreeMinutes: 20,
  planningEnd: '23:00',
  planningEndDayOffset: 0,
  planningStart: '08:00',
  timezone: DEMO_TIMEZONE,
};

export function createSampleGoals(): Goal[] {
  return [
    {
      id: '10000000-0000-4000-8000-000000000001',
      userId: 'demo',
      title: 'TOEIC 730点を達成する',
      description: '授業の合間に、単語・文法・リスニングを少しずつ進める。',
      priority: 'high',
      status: 'active',
      currentValue: 600,
      targetValue: 730,
      unit: '点',
      deadline: addLocalDays(DEMO_DATE, 30),
      createdAt: DEMO_START,
      updatedAt: DEMO_START,
    },
  ];
}

export function createSampleTasks(): Task[] {
  return [
    {
      id: '20000000-0000-4000-8000-000000000001',
      title: '英単語学習',
      estimatedMinutes: 30,
      priority: 'high',
      deadline: getUtcInstantForLocalTime(DEMO_DATE, '23:59', DEMO_TIMEZONE),
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      title: 'Part 5演習',
      estimatedMinutes: 30,
      priority: 'high',
      deadline: getUtcInstantForLocalTime(addLocalDays(DEMO_DATE, 1), '23:59', DEMO_TIMEZONE),
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      title: 'リスニング',
      estimatedMinutes: 45,
      priority: 'medium',
      deadline: null,
    },
    {
      id: '20000000-0000-4000-8000-000000000004',
      title: '模試復習',
      estimatedMinutes: 60,
      priority: 'low',
      deadline: null,
    },
  ].map((task) => ({
    ...task,
    priority: task.priority as Task['priority'],
    goalId: '10000000-0000-4000-8000-000000000001',
    status: 'pending',
    userId: 'demo',
    createdAt: DEMO_START,
    updatedAt: DEMO_START,
  }));
}

export function createSampleEvents(): CalendarEvent[] {
  return [
    { title: '大学', start: '09:00', end: '10:30' },
    { title: '授業', start: '13:00', end: '14:30' },
    { title: 'サークルの予定', start: '18:00', end: '19:00' },
  ].map((event, index) => ({
    id: `demo-event-${index}`,
    instanceId: null,
    calendarId: 'demo-calendar',
    calendarTitle: 'サンプル予定',
    title: event.title,
    location: null,
    startAt: getUtcInstantForLocalTime(DEMO_DATE, event.start, DEMO_TIMEZONE),
    endAt: getUtcInstantForLocalTime(DEMO_DATE, event.end, DEMO_TIMEZONE),
    timeZone: DEMO_TIMEZONE,
    allDay: false,
    allDayStartDate: null,
    allDayEndDate: null,
    availability: 'busy',
    status: 'confirmed',
  }));
}
