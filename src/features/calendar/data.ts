import type { CalendarItem } from './types';

export const CALENDAR_DATE = '9月11日（金）';

export const CALENDAR_ITEMS: CalendarItem[] = [
  {
    endMinutes: 8 * 60 + 50,
    endTime: '08:50',
    id: 'kin-fure',
    kind: 'planned',
    startMinutes: 8 * 60 + 30,
    startTime: '08:30',
    title: '金フレ',
  },
  {
    endMinutes: 16 * 60,
    endTime: '16:00',
    id: 'university',
    kind: 'calendar',
    startMinutes: 10 * 60,
    startTime: '10:00',
    title: '大学',
  },
  {
    endMinutes: 17 * 60,
    endTime: '17:00',
    id: 'listening',
    kind: 'planned',
    startMinutes: 16 * 60 + 30,
    startTime: '16:30',
    title: 'TOEIC Listening',
  },
  {
    endMinutes: 18 * 60 + 30,
    endTime: '18:30',
    id: 'part-5',
    kind: 'planned',
    startMinutes: 18 * 60,
    startTime: '18:00',
    title: 'Part 5',
  },
];
