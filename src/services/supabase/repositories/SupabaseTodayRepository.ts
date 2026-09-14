import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PlannedActionStatus,
  TodayPlannedAction,
  TodayProjection,
  TodayRepository,
} from '@/features/today/repositories/TodayRepository';
import { getLocalDate, getUtcDayBounds, resolveTimeZone } from '@/features/today/timezone';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DailyPlanRow = Database['public']['Tables']['daily_plans']['Row'];
type PlannedActionRow = Database['public']['Tables']['planned_actions']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type GoalRow = Database['public']['Tables']['goals']['Row'];

type DailyPlanQueryRow = Pick<DailyPlanRow, 'id' | 'plan_date' | 'summary' | 'user_id'>;
type PlannedActionQueryRow = Pick<
  PlannedActionRow,
  'daily_plan_id' | 'end_at' | 'id' | 'start_at' | 'status' | 'task_id' | 'title' | 'user_id'
>;
type TaskQueryRow = Pick<TaskRow, 'goal_id' | 'id' | 'title' | 'user_id'>;
type GoalQueryRow = Pick<GoalRow, 'id' | 'title' | 'user_id'>;

type DailyPlanRecord = {
  id: string;
  summary: string | null;
};

type PlannedActionRecord = {
  dailyPlanId: string;
  endAt: string;
  id: string;
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

function isActionStatus(value: string): value is PlannedActionStatus {
  return value === 'scheduled' || value === 'completed' || value === 'skipped';
}

function readDailyPlan(
  value: DailyPlanQueryRow,
  userId: string,
  localDate: string,
): DailyPlanRecord {
  if (!UUID_PATTERN.test(value.id) || value.user_id !== userId || value.plan_date !== localDate) {
    throw new Error('Unexpected daily plan data');
  }

  return {
    id: value.id,
    summary: value.summary?.trim() || null,
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
    startAt >= endBound ||
    !isActionStatus(value.status)
  ) {
    throw new Error('Unexpected planned action data');
  }

  return {
    dailyPlanId,
    endAt: new Date(endAt).toISOString(),
    id: value.id,
    startAt: new Date(startAt).toISOString(),
    status: value.status,
    taskId,
    title: value.title.trim(),
  };
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
      .select('timezone')
      .eq('id', this.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || typeof profile.timezone !== 'string') {
      throw new Error('Profile timezone not found');
    }

    const timeZone = resolveTimeZone(profile.timezone);
    const currentInstant = this.now();
    const localDate = getLocalDate(currentInstant, timeZone);
    const bounds = getUtcDayBounds(localDate, timeZone);

    const { data: dailyPlanData, error: dailyPlanError } = await this.client
      .from('daily_plans')
      .select('id, user_id, plan_date, summary')
      .eq('user_id', this.userId)
      .eq('plan_date', localDate)
      .maybeSingle();

    if (dailyPlanError) throw dailyPlanError;

    const baseProjection = {
      greeting: createGreeting(currentInstant, timeZone),
      localDate,
      timezone: timeZone,
    };

    if (!dailyPlanData) {
      return { ...baseProjection, actions: [], summary: null };
    }

    const dailyPlan = readDailyPlan(dailyPlanData, this.userId, localDate);
    const { data: actionData, error: actionsError } = await this.client
      .from('planned_actions')
      .select('id, user_id, daily_plan_id, task_id, title, start_at, end_at, status')
      .eq('user_id', this.userId)
      .eq('daily_plan_id', dailyPlan.id)
      .gte('start_at', bounds.startAt)
      .lt('start_at', bounds.endAt)
      .order('start_at', { ascending: true });

    if (actionsError) throw actionsError;

    const startBound = Date.parse(bounds.startAt);
    const endBound = Date.parse(bounds.endAt);
    const actionRecords = (actionData ?? []).map((action) =>
      readPlannedAction(action, this.userId, dailyPlan.id, startBound, endBound),
    );
    const taskIds = [
      ...new Set(actionRecords.flatMap((action) => (action.taskId ? [action.taskId] : []))),
    ];
    const tasksById = await this.loadTasks(taskIds);
    const goalIds = [
      ...new Set(
        [...tasksById.values()].flatMap((task) => (task.goalId === null ? [] : [task.goalId])),
      ),
    ];
    const goalsById = await this.loadGoals(goalIds);
    const actions: TodayPlannedAction[] = actionRecords.map((action) => {
      const task = action.taskId ? tasksById.get(action.taskId) : undefined;

      if (action.taskId && !task) throw new Error('Unexpected planned action task data');

      const goalTitle = task?.goalId ? goalsById.get(task.goalId) : undefined;

      if (task?.goalId && !goalTitle) throw new Error('Unexpected planned action goal data');

      return {
        endAt: action.endAt,
        goalTitle: goalTitle ?? null,
        id: action.id,
        startAt: action.startAt,
        status: action.status,
        taskId: action.taskId,
        taskTitle: task?.title ?? null,
        title: action.title,
      };
    });

    return { ...baseProjection, actions, summary: dailyPlan.summary };
  }

  private async loadTasks(taskIds: string[]): Promise<Map<string, TaskRecord>> {
    if (taskIds.length === 0) return new Map();

    const { data, error } = await this.client
      .from('tasks')
      .select('id, user_id, goal_id, title')
      .eq('user_id', this.userId)
      .in('id', taskIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map((task: TaskQueryRow) => {
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
}

export function createSupabaseTodayRepository(userId: string): TodayRepository {
  return new SupabaseTodayRepository(getSupabaseClient(), userId);
}
