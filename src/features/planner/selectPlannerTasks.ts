import { addLocalDays, type LocalDate } from '@/features/today';

import type { PlannerPriority, PlannerTask } from './contracts';
import { getPlannerTaskDeadlineDate } from './plannerTaskDeadline';
import type { FreeTimeSlot } from './types';

export type PlannerGoalSource = {
  currentValue: number | null;
  deadline: string | null;
  description: string | null;
  id: string;
  priority: PlannerPriority;
  status: 'active' | 'archived' | 'completed';
  targetValue: number | null;
  title: string;
  unit: string | null;
};

export type PlannerTaskSource = {
  deadline: string | null;
  estimatedMinutes: number;
  goalId: string | null;
  id: string;
  priority: PlannerPriority;
  status: 'completed' | 'pending' | 'scheduled' | 'skipped';
  title: string;
};

export type SelectPlannerTasksInput = {
  date: LocalDate;
  freeSlots: readonly FreeTimeSlot[];
  goals: readonly PlannerGoalSource[];
  tasks: readonly PlannerTaskSource[];
  timezone: string;
};

type RankedPlannerTask = {
  goal: PlannerGoalSource | null;
  task: PlannerTask;
};

const PRIORITY_ORDER: Record<PlannerPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function deadlineGroup(deadline: LocalDate | null, date: LocalDate): number {
  if (deadline === null) return 3;
  if (deadline < date) return 0;
  if (deadline === date) return 1;
  return 2;
}

function compareDeadlines(
  left: LocalDate | null,
  right: LocalDate | null,
  date: LocalDate,
): number {
  const groupDifference = deadlineGroup(left, date) - deadlineGroup(right, date);
  if (groupDifference !== 0) return groupDifference;
  if (left === null || right === null) return 0;
  return left.localeCompare(right);
}

function getGoalDeadline(goal: PlannerGoalSource | null): LocalDate | null {
  return goal?.deadline ? addLocalDays(goal.deadline, 0) : null;
}

function compareRankedTasks(
  left: RankedPlannerTask,
  right: RankedPlannerTask,
  date: LocalDate,
): number {
  return (
    compareDeadlines(left.task.deadline, right.task.deadline, date) ||
    PRIORITY_ORDER[left.task.priority] - PRIORITY_ORDER[right.task.priority] ||
    compareDeadlines(getGoalDeadline(left.goal), getGoalDeadline(right.goal), date) ||
    (left.goal ? PRIORITY_ORDER[left.goal.priority] : 3) -
      (right.goal ? PRIORITY_ORDER[right.goal.priority] : 3) ||
    left.task.estimatedMinutes - right.task.estimatedMinutes ||
    left.task.id.localeCompare(right.task.id)
  );
}

function getAvailableMinutes(freeSlots: readonly FreeTimeSlot[]): number {
  return freeSlots.reduce((total, slot) => total + slot.durationMinutes, 0);
}

function getLargestFreeSlotMinutes(freeSlots: readonly FreeTimeSlot[]): number {
  return freeSlots.reduce(
    (largestDuration, slot) => Math.max(largestDuration, slot.durationMinutes),
    0,
  );
}

export function selectPlannerTasks({
  date,
  freeSlots,
  goals,
  tasks,
  timezone,
}: SelectPlannerTasksInput): PlannerTask[] {
  const availableMinutes = getAvailableMinutes(freeSlots);
  if (availableMinutes <= 0) return [];
  const largestFreeSlotMinutes = getLargestFreeSlotMinutes(freeSlots);

  const activeGoals = new Map(
    goals.filter((goal) => goal.status === 'active').map((goal) => [goal.id, goal]),
  );
  const rankedTasks = tasks
    .flatMap((task): RankedPlannerTask[] => {
      if (task.status !== 'pending') return [];

      const activeGoal = task.goalId === null ? null : activeGoals.get(task.goalId);
      if (task.goalId !== null && !activeGoal) return [];
      const goal = activeGoal ?? null;

      return [
        {
          goal,
          task: {
            deadline: getPlannerTaskDeadlineDate(task.deadline, timezone),
            estimatedMinutes: task.estimatedMinutes,
            goalId: task.goalId,
            id: task.id,
            priority: task.priority,
            status: 'pending',
            title: task.title,
          },
        },
      ];
    })
    .sort((left, right) => compareRankedTasks(left, right, date));

  const selected: PlannerTask[] = [];
  let selectedMinutes = 0;

  for (const { task } of rankedTasks) {
    selected.push(task);

    if (task.estimatedMinutes > largestFreeSlotMinutes) continue;

    selectedMinutes += task.estimatedMinutes;

    if (selectedMinutes >= availableMinutes) break;
  }

  return selected;
}
