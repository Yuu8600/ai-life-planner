import type { CalendarEvent } from '@/features/calendar';
import type { Goal } from '@/features/goals/repositories/GoalRepository';
import {
  buildPlannerInput,
  validatePlannerProposal,
  type FreeTimeCalculationResult,
} from '@/features/planner';
import type { Task } from '@/features/tasks/repositories/TaskRepository';

const userId = '99999999-9999-4999-8999-999999999999';
const activeGoalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const completedGoalId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const activeGoal: Goal = {
  createdAt: '2026-09-01T00:00:00.000Z',
  currentValue: 530,
  deadline: '2026-10-25',
  description: '英語学習',
  id: activeGoalId,
  priority: 'high',
  status: 'active',
  targetValue: 730,
  title: 'TOEIC 730',
  unit: '点',
  updatedAt: '2026-09-01T00:00:00.000Z',
  userId,
};

const completedGoal: Goal = {
  ...activeGoal,
  id: completedGoalId,
  status: 'completed',
  title: '完了Goal',
};

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    createdAt: '2026-09-01T00:00:00.000Z',
    deadline: null,
    estimatedMinutes: 30,
    goalId: null,
    id,
    priority: 'medium',
    status: 'pending',
    title: `Task ${id}`,
    updatedAt: '2026-09-01T00:00:00.000Z',
    userId,
    ...overrides,
  };
}

const timedEvent: CalendarEvent = {
  allDay: false,
  allDayEndDate: null,
  allDayStartDate: null,
  availability: 'busy',
  calendarId: 'calendar-1',
  calendarTitle: '仕事',
  endAt: '2026-09-17T01:00:00.000Z',
  id: 'timed-event',
  instanceId: null,
  location: '会議室',
  startAt: '2026-09-17T00:00:00.000Z',
  status: 'confirmed',
  timeZone: 'Asia/Tokyo',
  title: '会議',
};

const freeAllDayEvent: CalendarEvent = {
  ...timedEvent,
  allDay: true,
  allDayEndDate: '2026-09-18',
  allDayStartDate: '2026-09-17',
  availability: 'free',
  endAt: '2026-09-17T15:00:00.000Z',
  id: 'free-all-day-event',
  startAt: '2026-09-16T15:00:00.000Z',
  title: '記念日',
};

const freeTimeResult: FreeTimeCalculationResult = {
  busyIntervals: [],
  freeSlots: [
    {
      durationMinutes: 60,
      endAt: '2026-09-17T00:00:00.000Z',
      startAt: '2026-09-16T23:00:00.000Z',
    },
  ],
  planningWindow: {
    endAt: '2026-09-17T00:00:00.000Z',
    startAt: '2026-09-16T23:00:00.000Z',
  },
};

describe('buildPlannerInput', () => {
  it('preserves date, timezone, planningWindow, and freeSlots from trusted inputs', () => {
    const result = buildPlannerInput({
      calendarEvents: [],
      date: '2026-09-17',
      freeTimeResult,
      goals: [],
      tasks: [],
      timezone: 'Asia/Tokyo',
    });

    expect(result.date).toBe('2026-09-17');
    expect(result.timezone).toBe('Asia/Tokyo');
    expect(result.planningWindow).toBe(freeTimeResult.planningWindow);
    expect(result.freeSlots).toBe(freeTimeResult.freeSlots);
  });

  it('maps timed and all-day Calendar events without availability or provider metadata', () => {
    const result = buildPlannerInput({
      calendarEvents: [timedEvent, freeAllDayEvent],
      date: '2026-09-17',
      freeTimeResult,
      goals: [],
      tasks: [],
      timezone: 'Asia/Tokyo',
    });

    expect(result.calendarEvents).toEqual([
      {
        endAt: timedEvent.endAt,
        kind: 'timed',
        startAt: timedEvent.startAt,
        title: '会議',
      },
      {
        endDate: '2026-09-18',
        kind: 'allDay',
        startDate: '2026-09-17',
        title: '記念日',
      },
    ]);
    expect(result.calendarEvents[1]).not.toHaveProperty('availability');
    expect(result.calendarEvents[0]).not.toHaveProperty('calendarId');
    expect(result.calendarEvents[0]).not.toHaveProperty('location');
    expect(result.freeSlots).toBe(freeTimeResult.freeSlots);
  });

  it('maps only active Goals and strips repository ownership and audit fields', () => {
    const result = buildPlannerInput({
      calendarEvents: [],
      date: '2026-09-17',
      freeTimeResult,
      goals: [activeGoal, completedGoal],
      tasks: [],
      timezone: 'Asia/Tokyo',
    });

    expect(result.goals).toEqual([
      {
        currentValue: 530,
        deadline: '2026-10-25',
        description: '英語学習',
        id: activeGoalId,
        priority: 'high',
        targetValue: 730,
        title: 'TOEIC 730',
        unit: '点',
      },
    ]);
    expect(result.goals[0]).not.toHaveProperty('userId');
    expect(result.goals[0]).not.toHaveProperty('createdAt');
    expect(result.goals[0]).not.toHaveProperty('updatedAt');
  });

  it('maps only selected pending Tasks and strips repository ownership and audit fields', () => {
    const selectedTask = task('11111111-1111-4111-8111-111111111111', {
      deadline: '2026-09-16T23:30:00.000Z',
      goalId: activeGoalId,
      priority: 'high',
      title: 'Listening',
    });
    const result = buildPlannerInput({
      calendarEvents: [],
      date: '2026-09-17',
      freeTimeResult,
      goals: [activeGoal, completedGoal],
      tasks: [
        selectedTask,
        task('22222222-2222-4222-8222-222222222222', { status: 'completed' }),
        task('33333333-3333-4333-8333-333333333333', { goalId: completedGoalId }),
      ],
      timezone: 'Asia/Tokyo',
    });

    expect(result.tasks).toEqual([
      {
        deadline: '2026-09-17',
        estimatedMinutes: 30,
        goalId: activeGoalId,
        id: selectedTask.id,
        priority: 'high',
        status: 'pending',
        title: 'Listening',
      },
    ]);
    expect(result.tasks[0]).not.toHaveProperty('userId');
    expect(result.tasks[0]).not.toHaveProperty('createdAt');
    expect(result.tasks[0]).not.toHaveProperty('updatedAt');
  });

  it('keeps non-candidate Tasks outside Planner proposal coverage', () => {
    const result = buildPlannerInput({
      calendarEvents: [],
      date: '2026-09-17',
      freeTimeResult: {
        ...freeTimeResult,
        freeSlots: [{ ...freeTimeResult.freeSlots[0], durationMinutes: 30 }],
      },
      goals: [],
      tasks: [
        task('11111111-1111-4111-8111-111111111111', { estimatedMinutes: 20 }),
        task('22222222-2222-4222-8222-222222222222', { estimatedMinutes: 20 }),
        task('33333333-3333-4333-8333-333333333333', { estimatedMinutes: 20 }),
      ],
      timezone: 'Asia/Tokyo',
    });

    expect(result.tasks).toHaveLength(2);
    const validation = validatePlannerProposal(
      {
        actions: [],
        date: result.date,
        summary: '候補Taskを今回は配置しません。',
        unscheduled: result.tasks.map(({ id }) => ({ reason: '配置は次段階です。', taskId: id })),
      },
      result,
    );

    expect(validation.ok).toBe(true);
  });
});
