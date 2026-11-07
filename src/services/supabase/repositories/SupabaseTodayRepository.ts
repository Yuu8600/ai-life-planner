import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getPlanningDate,
  getPlanningWindow,
  getUtcDayBounds,
  resolveTimeZone,
  type PlannedActionStatus,
  type TodayDailyPlan,
  type TodayDeadlineTask,
  type TodayPlannedAction,
  type TodayProjection,
  type TodayRepository,
  type TodayTaskStatus,
} from '@/features/today';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DailyPlanRow = Database['public']['Tables']['daily_plans']['Row'];
type GoalRow = Database['public']['Tables']['goals']['Row'];
type PlannedActionRow = Database['public']['Tables']['planned_actions']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];

type DailyPlanQueryRow = Pick<
  DailyPlanRow,
  'id' | 'plan_date' | 'summary' | 'timezone' | 'user_id' | 'window_start_at' | 'window_end_at'
>;
type GoalQueryRow = Pick<GoalRow, 'id' | 'title' | 'user_id'>;
type PlannedActionQueryRow = Pick<
  PlannedActionRow,
  | 'daily_plan_id'
  | 'end_at'
  | 'id'
  | 'reason'
  | 'start_at'
  | 'status'
  | 'task_id'
  | 'title'
  | 'user_id'
>;
type ActionTaskQueryRow = Pick<TaskRow, 'goal_id' | 'id' | 'title' | 'user_id'>;
type DeadlineTaskQueryRow = Pick<
  TaskRow,
  'deadline' | 'goal_id' | 'id' | 'status' | 'title' | 'user_id'
>;

type DailyPlanRecord = {
  window?: { startAt: string; endAt: string };
  date: string;
  id: string;
  summary: string | null;
  timezone: string;
};

type PlannedActionRecord = {
  dailyPlanId: string;
  endAt: string;
  id: string;
  reason: string | null;
  startAt: string;
  status: PlannedActionStatus;
  taskId: string | null;
  title: string;
};

type TaskRecord = {
  goalId: string | null;
  id: string;
  title: string;
};

type DeadlineTaskRecord = TaskRecord & {
  deadlineAt: string;
  status: TodayTaskStatus;
};

function isActionStatus(value: string): value is PlannedActionStatus {
  return value === 'scheduled' || value === 'completed' || value === 'skipped';
}

function isTaskStatus(value: string): value is TodayTaskStatus {
  return value === 'pending' || isActionStatus(value);
}

function readDailyPlan(
  value: DailyPlanQueryRow,
  userId: string,
  localDate: string,
): DailyPlanRecord {
  if (!UUID_PATTERN.test(value.id) || value.user_id !== userId || value.plan_date !== localDate) {
    throw new Error('Unexpected daily plan data');
  }

  if (
    (value.window_start_at || value.window_end_at) &&
    (!value.window_start_at ||
      !value.window_end_at ||
      !Number.isFinite(Date.parse(value.window_start_at)) ||
      !Number.isFinite(Date.parse(value.window_end_at)) ||
      Date.parse(value.window_start_at) >= Date.parse(value.window_end_at))
  )
    throw new Error('Unexpected saved Plan window');
  return {
    ...(value.window_start_at && value.window_end_at
      ? { window: { startAt: value.window_start_at, endAt: value.window_end_at } }
      : {}),
    date: value.plan_date,
    id: value.id,
    summary: value.summary?.trim() || null,
    timezone: resolveTimeZone(value.timezone),
  };
}

function readPlannedAction(
  value: PlannedActionQueryRow,
  userId: string,
  dailyPlanId: string,
  startBound: number,
  endBound: number,
): PlannedActionRecord {
  const startAt = Date.parse(value.start_at);
  const endAt = Date.parse(value.end_at);
  const taskId = value.task_id;

  if (
    !UUID_PATTERN.test(value.id) ||
    value.user_id !== userId ||
    value.daily_plan_id !== dailyPlanId ||
    (taskId !== null && !UUID_PATTERN.test(taskId)) ||
    !value.title.trim() ||
    !Number.isFinite(startAt) ||
    !Number.isFinite(endAt) ||
    endAt <= startAt ||
    startAt < startBound ||
    endAt > endBound ||
    !isActionStatus(value.status)
  ) {
    throw new Error('Unexpected planned action data');
  }

  return {
    dailyPlanId,
    endAt: new Date(endAt).toISOString(),
    id: value.id,
    reason: value.reason?.trim() || null,
    startAt: new Date(startAt).toISOString(),
    status: value.status,
    taskId,
    title: value.title.trim(),
  };
}

function readDeadlineTask(
  value: DeadlineTaskQueryRow,
  userId: string,
  startBound: number,
  endBound: number,
): DeadlineTaskRecord {
  const deadline = value.deadline === null ? Number.NaN : Date.parse(value.deadline);

  if (
    value.user_id !== userId ||
    !UUID_PATTERN.test(value.id) ||
    (value.goal_id !== null && !UUID_PATTERN.test(value.goal_id)) ||
    !value.title.trim() ||
    !Number.isFinite(deadline) ||
    deadline < startBound ||
    deadline >= endBound ||
    !isTaskStatus(value.status)
  ) {
    throw new Error('Unexpected Today deadline task data');
  }

  return {
    deadlineAt: new Date(deadline).toISOString(),
    goalId: value.goal_id,
    id: value.id,
    status: value.status,
    title: value.title.trim(),
  };
}

function compareActions(left: PlannedActionRecord, right: PlannedActionRecord): number {
  return Date.parse(left.startAt) - Date.parse(right.startAt) || left.id.localeCompare(right.id);
}

function createGreeting(instant: Date, timeZone: string): string {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone,
  })
    .formatToParts(instant)
    .find((part) => part.type === 'hour');
  const hour = Number(hourPart?.value);

  if (!Number.isInteger(hour)) throw new Error('Unexpected local time data');
  if (hour >= 5 && hour < 11) return 'おはようございます';
  if (hour >= 11 && hour < 18) return 'こんにちは';
  return 'こんばんは';
}

export class SupabaseTodayRepository implements TodayRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getToday(): Promise<TodayProjection> {
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('timezone, planning_start, planning_end, planning_end_day_offset')
      .eq('id', this.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || typeof profile.timezone !== 'string') {
      throw new Error('Profile timezone not found');
    }

    const profileTimezone = resolveTimeZone(profile.timezone);
    const currentInstant = this.now();
    const planningSettings = {
      timezone: profileTimezone,
      planningStart: profile.planning_start.slice(0, 5),
      planningEnd: profile.planning_end.slice(0, 5),
      planningEndDayOffset: profile.planning_end_day_offset,
    };
    const localDate = getPlanningDate(currentInstant, planningSettings);
    const planningWindow = getPlanningWindow(localDate, planningSettings);
    const profileDayBounds = getUtcDayBounds(localDate, profileTimezone);
    const [dailyPlanResult, deadlineTaskResult] = await Promise.all([
      this.client
        .from('daily_plans')
        .select('id, user_id, plan_date, timezone, summary, window_start_at, window_end_at')
        .eq('user_id', this.userId)
        .eq('plan_date', localDate)
        .maybeSingle(),
      this.client
        .from('tasks')
        .select('id, user_id, goal_id, title, deadline, status')
        .eq('user_id', this.userId)
        .gte('deadline', profileDayBounds.startAt)
        .lt('deadline', profileDayBounds.endAt)
        .order('deadline', { ascending: true }),
    ]);

    if (dailyPlanResult.error) throw dailyPlanResult.error;
    if (deadlineTaskResult.error) throw deadlineTaskResult.error;

    const profileStartBound = Date.parse(profileDayBounds.startAt);
    const profileEndBound = Date.parse(profileDayBounds.endAt);
    const deadlineTaskRecords = (deadlineTaskResult.data ?? []).map((task) =>
      readDeadlineTask(task, this.userId, profileStartBound, profileEndBound),
    );
    const dailyPlan = dailyPlanResult.data
      ? readDailyPlan(dailyPlanResult.data, this.userId, localDate)
      : null;
    const actionRecords = dailyPlan ? await this.loadActions(dailyPlan) : [];
    const deadlineTasksById = new Map(
      deadlineTaskRecords.map((task) => [task.id, task] satisfies [string, TaskRecord]),
    );
    const missingActionTaskIds = [
      ...new Set(
        actionRecords.flatMap((action) =>
          action.taskId && !deadlineTasksById.has(action.taskId) ? [action.taskId] : [],
        ),
      ),
    ];
    const actionTasksById = await this.loadActionTasks(missingActionTaskIds);
    const tasksById = new Map([...deadlineTasksById, ...actionTasksById]);
    const goalIds = [
      ...new Set(
        [...tasksById.values()].flatMap((task) => (task.goalId === null ? [] : [task.goalId])),
      ),
    ];
    const goalsById = await this.loadGoals(goalIds);
    const deadlineTasks: TodayDeadlineTask[] = deadlineTaskRecords.map((task) => ({
      deadlineAt: task.deadlineAt,
      goalTitle: task.goalId ? (goalsById.get(task.goalId) ?? null) : null,
      id: task.id,
      status: task.status,
      title: task.title,
    }));
    const plan = dailyPlan
      ? this.toTodayDailyPlan(dailyPlan, actionRecords, tasksById, goalsById)
      : null;

    return {
      planningWindow,
      deadlineTasks,
      greeting: createGreeting(currentInstant, profileTimezone),
      localDate,
      plan,
      profileTimezone,
    };
  }

  private async loadActions(dailyPlan: DailyPlanRecord): Promise<PlannedActionRecord[]> {
    const bounds = dailyPlan.window ?? getUtcDayBounds(dailyPlan.date, dailyPlan.timezone);
    const { data, error } = await this.client
      .from('planned_actions')
      .select('id, user_id, daily_plan_id, task_id, title, start_at, end_at, reason, status')
      .eq('user_id', this.userId)
      .eq('daily_plan_id', dailyPlan.id)
      .gte('start_at', bounds.startAt)
      .lt('start_at', bounds.endAt)
      .order('start_at', { ascending: true });

    if (error) throw error;

    const startBound = Date.parse(bounds.startAt);
    const endBound = Date.parse(bounds.endAt);
    return (data ?? [])
      .map((action) => readPlannedAction(action, this.userId, dailyPlan.id, startBound, endBound))
      .sort(compareActions);
  }

  private async loadActionTasks(taskIds: string[]): Promise<Map<string, TaskRecord>> {
    if (taskIds.length === 0) return new Map();

    const { data, error } = await this.client
      .from('tasks')
      .select('id, user_id, goal_id, title')
      .eq('user_id', this.userId)
      .in('id', taskIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map((task: ActionTaskQueryRow) => {
        if (
          task.user_id !== this.userId ||
          !UUID_PATTERN.test(task.id) ||
          (task.goal_id !== null && !UUID_PATTERN.test(task.goal_id)) ||
          !task.title.trim()
        ) {
          throw new Error('Unexpected task data');
        }

        return [
          task.id,
          { goalId: task.goal_id, id: task.id, title: task.title.trim() } satisfies TaskRecord,
        ];
      }),
    );
  }

  private async loadGoals(goalIds: string[]): Promise<Map<string, string>> {
    if (goalIds.length === 0) return new Map();

    const { data, error } = await this.client
      .from('goals')
      .select('id, user_id, title')
      .eq('user_id', this.userId)
      .in('id', goalIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map((goal: GoalQueryRow) => {
        if (goal.user_id !== this.userId || !UUID_PATTERN.test(goal.id) || !goal.title.trim()) {
          throw new Error('Unexpected goal data');
        }

        return [goal.id, goal.title.trim()];
      }),
    );
  }

  private toTodayDailyPlan(
    dailyPlan: DailyPlanRecord,
    actionRecords: PlannedActionRecord[],
    tasksById: ReadonlyMap<string, TaskRecord>,
    goalsById: ReadonlyMap<string, string>,
  ): TodayDailyPlan {
    const actions: TodayPlannedAction[] = actionRecords.map((action) => {
      const task = action.taskId ? tasksById.get(action.taskId) : undefined;

      if (action.taskId && !task) throw new Error('Unexpected planned action task data');

      const goalTitle = task?.goalId ? goalsById.get(task.goalId) : undefined;

      if (task?.goalId && !goalTitle) throw new Error('Unexpected planned action goal data');

      return {
        endAt: action.endAt,
        goalTitle: goalTitle ?? null,
        id: action.id,
        reason: action.reason,
        startAt: action.startAt,
        status: action.status,
        taskId: action.taskId,
        taskTitle: task?.title ?? null,
        title: action.title,
      };
    });

    return {
      actions,
      ...(dailyPlan.window ? { window: dailyPlan.window } : {}),
      date: dailyPlan.date,
      id: dailyPlan.id,
      summary: dailyPlan.summary,
      timezone: dailyPlan.timezone,
    };
  }
}

export function createSupabaseTodayRepository(userId: string): TodayRepository {
  return new SupabaseTodayRepository(getSupabaseClient(), userId);
}
