import {
  bufferKey,
  validateEventBuffer,
  type CalendarEventBufferRepository,
  type CalendarEventBufferOverride,
  intersectsCalendarDay,
  type CalendarRepository,
} from '@/features/calendar';
import type { ActivityLog, ActivityLogRepository } from '@/features/activity';
import { GoalNotFoundError } from '@/features/goals/errors';
import type { Goal, GoalRepository } from '@/features/goals/repositories/GoalRepository';
import {
  PlannerReplanConflictError,
  type PlannerPersistenceRepository,
  type PlannerPlanSnapshot,
  type PlannerReplanRepository,
  type SavePlannerProposalInput,
  type SavedDailyPlan,
} from '@/features/planner';
import type { SettingsRepository } from '@/features/settings';
import { createSettingsFormValues, validateSettingsForm } from '@/features/settings/validation';
import { TaskNotFoundError } from '@/features/tasks/errors';
import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';
import {
  getPlanningDate,
  getPlanningWindow,
  getUtcDayBounds,
  type LocalDate,
  type PlannedActionExecutionRepository,
  type TodayDailyPlan,
  type TodayRepository,
} from '@/features/today';

import {
  createSampleEvents,
  createSampleGoals,
  createSampleTasks,
  DEMO_AFTERNOON,
  DEMO_OVERNIGHT,
  DEMO_SETTINGS,
  DEMO_START,
} from './sampleData';

type DemoDailyPlan = TodayDailyPlan & { date: LocalDate };

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** One browser-tab session. No SDK, network, device permission or durable storage. */
export class DemoRepositories {
  private goals = createSampleGoals();
  private tasks = createSampleTasks();
  private settings = { ...DEMO_SETTINGS };
  private events = createSampleEvents();
  private plans = new Map<string, DemoDailyPlan>();
  private snapshots = new Map<string, PlannerPlanSnapshot>();
  private logs: ActivityLog[] = [];
  private sequence = 0;
  private instant = DEMO_START;
  readonly now = () => new Date(this.instant);

  advanceToOvernight() {
    this.instant = DEMO_OVERNIGHT;
  }
  advanceToAfternoon() {
    this.instant = DEMO_AFTERNOON;
  }
  private id() {
    return `30000000-0000-4000-8000-${String(++this.sequence).padStart(12, '0')}`;
  }
  private stamp() {
    return `${this.instant}/${++this.sequence}`;
  }

  private goal(id: string): Goal {
    const goal = this.goals.find((item) => item.id === id);
    if (!goal) throw new GoalNotFoundError();
    return goal;
  }
  private task(id: string): Task {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) throw new TaskNotFoundError();
    return task;
  }
  private assertGoal(goalId: string | null) {
    if (goalId !== null && !this.goals.some((goal) => goal.id === goalId))
      throw new Error('Unknown Demo Goal.');
  }

  readonly goalRepository: GoalRepository = {
    list: async () => copy(this.goals),
    findById: async (id) => copy(this.goals.find((goal) => goal.id === id) ?? null),
    create: async (input) => {
      const goal: Goal = {
        ...copy(input),
        id: this.id(),
        userId: 'demo',
        createdAt: this.instant,
        updatedAt: this.instant,
      };
      this.goals.push(goal);
      return copy(goal);
    },
    update: async (id, input) => {
      const goal = this.goal(id);
      Object.assign(goal, copy(input), { updatedAt: this.instant });
      return copy(goal);
    },
    remove: async (id) => {
      this.goal(id);
      this.goals = this.goals.filter((goal) => goal.id !== id);
      this.tasks = this.tasks.map((task) =>
        task.goalId === id ? { ...task, goalId: null } : task,
      );
    },
  };

  readonly taskRepository: TaskRepository = {
    list: async () => copy(this.tasks),
    findById: async (id) => copy(this.tasks.find((task) => task.id === id) ?? null),
    listGoalOptions: async () => this.goals.map(({ id, title }) => ({ id, title })),
    create: async (input) => {
      this.assertGoal(input.goalId);
      const task: Task = {
        ...copy(input),
        id: this.id(),
        userId: 'demo',
        createdAt: this.instant,
        updatedAt: this.instant,
      };
      this.tasks.push(task);
      return copy(task);
    },
    update: async (id, input) => {
      const task = this.task(id);
      this.assertGoal(input.goalId === undefined ? task.goalId : input.goalId);
      Object.assign(task, copy(input), { updatedAt: this.instant });
      return copy(task);
    },
    remove: async (id) => {
      this.task(id);
      this.tasks = this.tasks.filter((task) => task.id !== id);
      for (const plan of this.plans.values()) {
        for (const action of plan.actions) if (action.taskId === id) action.taskId = null;
        this.updateSnapshot(plan);
      }
    },
  };

  readonly settingsRepository: SettingsRepository = {
    getProfilePlanningSettings: async () => ({ ...this.settings }),
    updateProfilePlanningSettings: async (input) => {
      const validation = validateSettingsForm(createSettingsFormValues(input));
      if (!validation.input) throw new Error('Invalid Demo Settings.');
      this.settings = validation.input;
      return { ...this.settings };
    },
  };

  private eventBuffers = new Map<string, CalendarEventBufferOverride>();
  readonly eventBufferRepository: CalendarEventBufferRepository = {
    list: async () => [...this.eventBuffers.values()].map((value) => ({ ...value })),
    upsert: async (value) => {
      validateEventBuffer(value);
      this.eventBuffers.set(bufferKey(value), { ...value });
    },
    remove: async (key) => {
      this.eventBuffers.delete(bufferKey(key));
    },
  };

  readonly calendarRepository: CalendarRepository = {
    getPermission: async () => ({ status: 'granted', canAskAgain: false }),
    requestPermission: async () => ({ status: 'granted', canAskAgain: false }),
    listEvents: async (interval, localDate) => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: copy(
        this.events.filter((event) => intersectsCalendarDay(event, interval, localDate)),
      ),
    }),
  };

  readonly todayRepository: TodayRepository = {
    getToday: async () => {
      const timezone = this.settings.timezone;
      const date = getPlanningDate(this.now(), this.settings);
      const bounds = getUtcDayBounds(date, timezone);
      const plan = copy(this.plans.get(date) ?? null);
      if (plan)
        for (const action of plan.actions) {
          const task = this.tasks.find((item) => item.id === action.taskId);
          action.taskTitle = task?.title ?? null;
          action.goalTitle = this.goals.find((goal) => goal.id === task?.goalId)?.title ?? null;
        }
      return {
        planningWindow: getPlanningWindow(date, this.settings),
        greeting: 'サンプルの一日を計画しましょう。',
        localDate: date,
        profileTimezone: timezone,
        plan,
        deadlineTasks: this.tasks
          .filter(
            (task) =>
              task.deadline !== null &&
              task.deadline >= bounds.startAt &&
              task.deadline < bounds.endAt,
          )
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            deadlineAt: task.deadline!,
            goalTitle: this.goals.find((goal) => goal.id === task.goalId)?.title ?? null,
          })),
      };
    },
  };

  private updateSnapshot(plan: DemoDailyPlan) {
    const revision = this.stamp();
    this.snapshots.set(plan.date, {
      id: plan.id,
      planDate: plan.date,
      summary: plan.summary,
      timezone: plan.timezone,
      updatedAt: revision,
      actions: plan.actions.map((action) => ({
        id: action.id,
        status: action.status,
        updatedAt: revision,
      })),
    });
  }

  /** Synchronous validation + replacement makes this memory transaction indivisible. */
  private save(input: SavePlannerProposalInput): SavedDailyPlan {
    getUtcDayBounds(input.planDate, input.timezone);
    for (const action of input.actions) {
      if (action.taskId !== null && this.task(action.taskId).status !== 'pending')
        throw new PlannerReplanConflictError();
    }
    const plan: DemoDailyPlan = {
      id: this.plans.get(input.planDate)?.id ?? this.id(),
      date: input.planDate,
      timezone: input.timezone,
      summary: input.summary,
      window: getPlanningWindow(input.planDate, this.settings),
      actions: input.actions.map((action) => ({
        ...copy(action),
        id: this.id(),
        status: 'scheduled',
        taskTitle: null,
        goalTitle: null,
      })),
    };
    this.plans.set(plan.date, plan);
    this.updateSnapshot(plan);
    return { id: plan.id, planDate: plan.date, actionCount: plan.actions.length };
  }

  readonly persistenceRepository: PlannerPersistenceRepository = {
    savePlan: async (input) => this.save(input),
  };
  readonly replanRepository: PlannerReplanRepository = {
    getSnapshot: async (date) => copy(this.snapshots.get(date) ?? null),
    replaceIfCurrent: async (input, expected) => {
      const current = this.snapshots.get(input.planDate);
      if (!current || JSON.stringify(current) !== JSON.stringify(expected))
        throw new PlannerReplanConflictError();
      return this.save(input);
    },
  };
  readonly executionRepository: PlannedActionExecutionRepository = {
    transition: async ({ actionId, targetStatus }) => {
      if (targetStatus !== 'completed' && targetStatus !== 'skipped')
        throw new Error('Invalid transition.');
      const plan = [...this.plans.values()].find((item) =>
        item.actions.some((action) => action.id === actionId),
      );
      const action = plan?.actions.find((item) => item.id === actionId);
      if (!plan || !action) throw new Error('Demo Action no longer exists.');
      if (action.status === targetStatus) return;
      if (action.status !== 'scheduled') throw new Error('Demo Action was already executed.');
      action.status = targetStatus;
      if (targetStatus === 'completed' && action.taskId !== null) {
        const task = this.task(action.taskId);
        task.status = 'completed';
        task.updatedAt = this.instant;
      }
      this.logs.unshift({
        id: this.id(),
        actionTitle: action.title,
        eventType:
          targetStatus === 'completed' ? 'planned_action_completed' : 'planned_action_skipped',
        occurredAt: this.instant,
        planDate: plan.date,
        plannedActionId: action.id,
        scheduledEndAt: action.endAt,
        scheduledStartAt: action.startAt,
        taskId: action.taskId,
        timezone: plan.timezone,
      });
      this.updateSnapshot(plan);
    },
  };
  readonly activityLogRepository: ActivityLogRepository = {
    listForPlanDate: async (date) => copy(this.logs.filter((log) => log.planDate === date)),
  };
}
