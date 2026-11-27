import { getLocalDate } from '@/features/today';
import type { Task } from './repositories/TaskRepository';

export type TaskSort = 'recent' | 'deadline' | 'priority' | 'title';
export function selectTaskList(
  tasks: readonly Task[],
  options: { query: string; goal: string; sort: TaskSort; timezone?: string },
) {
  const query = options.query.normalize('NFKC').trim().toLocaleLowerCase('ja');
  const rank = { high: 0, medium: 1, low: 2 };
  const deadline = (task: Task) =>
    task.localDeadline ??
    (task.deadline
      ? options.timezone
        ? getLocalDate(task.deadline, options.timezone)
        : task.deadline.slice(0, 10)
      : '9999-12-31');
  const timestamp = (task: Task) => Date.parse(task.updatedAt || task.createdAt) || 0;
  return tasks
    .filter(
      (task) =>
        (!query || task.title.normalize('NFKC').toLocaleLowerCase('ja').includes(query)) &&
        (options.goal === 'all' ||
          (options.goal === 'none' ? task.goalId === null : task.goalId === options.goal)),
    )
    .sort((a, b) => {
      const order =
        options.sort === 'deadline'
          ? deadline(a).localeCompare(deadline(b))
          : options.sort === 'priority'
            ? rank[a.priority] - rank[b.priority]
            : options.sort === 'title'
              ? a.title.localeCompare(b.title, 'ja')
              : timestamp(b) - timestamp(a);
      return order || a.id.localeCompare(b.id);
    });
}
