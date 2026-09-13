import { matchesTaskFilter } from '@/features/tasks/presentation';
import type { Task } from '@/features/tasks/repositories/TaskRepository';
import { TASK_FILTERS } from '@/features/tasks/filters';

const baseTask: Task = {
  createdAt: '2026-09-13T00:00:00+00:00',
  deadline: null,
  estimatedMinutes: 30,
  goalId: null,
  id: '33333333-3333-4333-8333-333333333333',
  priority: 'medium',
  status: 'pending',
  title: 'Task',
  updatedAt: '2026-09-13T00:00:00+00:00',
  userId: '11111111-1111-4111-8111-111111111111',
};

function localDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe('Task filters', () => {
  it('labels the deadline-based filter without implying a planned action', () => {
    expect(TASK_FILTERS.find((filter) => filter.id === 'today')?.label).toBe('今日が期限');
  });

  it('matches Today by the local YYYY-MM-DD deadline regardless of status', () => {
    const now = localDate(2026, 9, 13, 12);
    const task = {
      ...baseTask,
      deadline: localDate(2026, 9, 13, 23, 59).toISOString(),
      status: 'completed' as const,
    };

    expect(matchesTaskFilter(task, 'today', now)).toBe(true);
  });

  it('does not treat a scheduled Task with another local deadline as Today', () => {
    const now = localDate(2026, 9, 13, 23, 59);
    const task = {
      ...baseTask,
      deadline: localDate(2026, 9, 14, 0).toISOString(),
      status: 'scheduled' as const,
    };

    expect(matchesTaskFilter(task, 'today', now)).toBe(false);
  });

  it('handles an ISO timestamp across the UTC date boundary using local date parts', () => {
    const now = localDate(2026, 9, 13, 0);
    const localDeadline = localDate(2026, 9, 13, 23, 59);

    expect(
      matchesTaskFilter({ ...baseTask, deadline: localDeadline.toISOString() }, 'today', now),
    ).toBe(true);
  });

  it('does not include a Task without a deadline in Today', () => {
    expect(matchesTaskFilter(baseTask, 'today', localDate(2026, 9, 13, 12))).toBe(false);
  });
});
