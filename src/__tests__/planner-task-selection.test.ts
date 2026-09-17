import type { FreeTimeSlot, PlannerGoalSource, PlannerTaskSource } from '@/features/planner';
import { selectPlannerTasks } from '@/features/planner';

const date = '2026-09-17' as const;
const timezone = 'Asia/Tokyo';

const activeHighGoal: PlannerGoalSource = {
  currentValue: null,
  deadline: null,
  description: null,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  priority: 'high',
  status: 'active',
  targetValue: null,
  title: 'High Goal',
  unit: null,
};

const activeLowGoal: PlannerGoalSource = {
  ...activeHighGoal,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  priority: 'low',
  title: 'Low Goal',
};

function task(id: string, overrides: Partial<PlannerTaskSource> = {}): PlannerTaskSource {
  return {
    deadline: null,
    estimatedMinutes: 30,
    goalId: null,
    id,
    priority: 'medium',
    status: 'pending',
    title: `Task ${id}`,
    ...overrides,
  };
}

function freeSlot(durationMinutes: number): FreeTimeSlot {
  return {
    durationMinutes,
    endAt: '2026-09-17T14:00:00.000Z',
    startAt: '2026-09-16T23:00:00.000Z',
  };
}

function select(
  tasks: readonly PlannerTaskSource[],
  freeSlots: readonly FreeTimeSlot[] = [freeSlot(1_000)],
  goals: readonly PlannerGoalSource[] = [activeHighGoal, activeLowGoal],
) {
  return selectPlannerTasks({ date, freeSlots, goals, tasks, timezone });
}

describe('Planner Task candidate selection', () => {
  it('excludes completed, skipped, and already scheduled Tasks', () => {
    const selected = select([
      task('11111111-1111-4111-8111-111111111111'),
      task('22222222-2222-4222-8222-222222222222', { status: 'completed' }),
      task('33333333-3333-4333-8333-333333333333', { status: 'skipped' }),
      task('44444444-4444-4444-8444-444444444444', { status: 'scheduled' }),
    ]);

    expect(selected.map(({ id }) => id)).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('ranks overdue, today, future, and no-deadline Tasks in that order', () => {
    const selected = select([
      task('44444444-4444-4444-8444-444444444444'),
      task('33333333-3333-4333-8333-333333333333', {
        deadline: '2026-09-17T15:00:00.000Z',
      }),
      task('22222222-2222-4222-8222-222222222222', {
        deadline: '2026-09-17T14:59:59.999Z',
      }),
      task('11111111-1111-4111-8111-111111111111', {
        deadline: '2026-09-16T14:59:59.999Z',
      }),
    ]);

    expect(selected.map(({ id }) => id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]);
  });

  it('uses Task priority after deadline urgency', () => {
    const selected = select([
      task('11111111-1111-4111-8111-111111111111', {
        deadline: '2026-09-17T14:59:59.999Z',
        priority: 'low',
      }),
      task('22222222-2222-4222-8222-222222222222', {
        deadline: '2026-09-17T14:59:59.999Z',
        priority: 'high',
      }),
    ]);

    expect(selected.map(({ priority }) => priority)).toEqual(['high', 'low']);
  });

  it('uses active Goal deadline and priority as deterministic tie-breakers', () => {
    const urgentLowGoal = { ...activeLowGoal, deadline: '2026-09-18' };
    const laterHighGoal = { ...activeHighGoal, deadline: '2026-09-30' };
    const selected = select(
      [
        task('11111111-1111-4111-8111-111111111111', { goalId: laterHighGoal.id }),
        task('22222222-2222-4222-8222-222222222222', { goalId: urgentLowGoal.id }),
      ],
      [freeSlot(1_000)],
      [laterHighGoal, urgentLowGoal],
    );

    expect(selected.map(({ goalId }) => goalId)).toEqual([urgentLowGoal.id, laterHighGoal.id]);
  });

  it('uses shorter estimated duration as the final planning-relevant tie-breaker', () => {
    const selected = select([
      task('11111111-1111-4111-8111-111111111111', { estimatedMinutes: 60 }),
      task('22222222-2222-4222-8222-222222222222', { estimatedMinutes: 20 }),
    ]);

    expect(selected.map(({ estimatedMinutes }) => estimatedMinutes)).toEqual([20, 60]);
  });

  it('excludes a Task linked to a completed or archived Goal', () => {
    const completedGoal = { ...activeHighGoal, status: 'completed' as const };
    const selected = select(
      [
        task('11111111-1111-4111-8111-111111111111', { goalId: completedGoal.id }),
        task('22222222-2222-4222-8222-222222222222'),
      ],
      [freeSlot(1_000)],
      [completedGoal],
    );

    expect(selected.map(({ id }) => id)).toEqual(['22222222-2222-4222-8222-222222222222']);
  });

  it('uses total available minutes as the candidate budget and permits one overflow candidate', () => {
    const selected = select(
      [
        task('11111111-1111-4111-8111-111111111111'),
        task('22222222-2222-4222-8222-222222222222'),
        task('33333333-3333-4333-8333-333333333333'),
      ],
      [freeSlot(50)],
    );

    expect(selected).toHaveLength(2);
    expect(selected.reduce((total, candidate) => total + candidate.estimatedMinutes, 0)).toBe(60);
  });

  it('returns no candidates without Tasks or available time', () => {
    expect(select([])).toEqual([]);
    expect(select([task('11111111-1111-4111-8111-111111111111')], [])).toEqual([]);
  });

  it('maps selected deadlines to profile-local date-only values', () => {
    const selected = select([
      task('11111111-1111-4111-8111-111111111111', {
        deadline: '2026-09-16T23:30:00.000Z',
      }),
    ]);

    expect(selected[0].deadline).toBe('2026-09-17');
  });
});
