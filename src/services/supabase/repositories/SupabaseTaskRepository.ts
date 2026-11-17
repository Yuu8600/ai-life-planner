import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid } from 'expo-modules-core';

import { TaskCreateResultError, TaskNotFoundError } from '@/features/tasks/errors';
import type {
  CreateTaskInput,
  Task,
  TaskGoalOption,
  TaskPriority,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
} from '@/features/tasks/repositories/TaskRepository';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

const VALID_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];
const VALID_STATUSES: readonly TaskStatus[] = ['pending', 'scheduled', 'completed', 'skipped'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTaskPriority(value: string): value is TaskPriority {
  return VALID_PRIORITIES.includes(value as TaskPriority);
}

function isTaskStatus(value: string): value is TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus);
}

function reportTaskIssue(operation: string, error: unknown) {
  if (!__DEV__) return;
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  // The PostgREST detail field can contain the entire rejected row.
  console.warn('[TaskRepository]', {
    operation,
    code: typeof code === 'string' && /^[A-Z0-9]{5,8}$/.test(code) ? code : undefined,
    message: typeof message === 'string' ? message : 'Unknown task error',
  });
}

function toTask(row: TaskRow | null, expectedUserId: string): Task {
  if (!row) throw new Error('Task response did not include a row');
  const hasValidDeadline = row.deadline === null || !Number.isNaN(Date.parse(row.deadline));
  const hasValidGoalId = row.goal_id === null || UUID_PATTERN.test(row.goal_id);

  if (
    row.user_id !== expectedUserId ||
    !UUID_PATTERN.test(row.id) ||
    !UUID_PATTERN.test(row.user_id) ||
    !hasValidGoalId ||
    typeof row.title !== 'string' ||
    !row.title.trim() ||
    (row.estimated_minutes !== null &&
      (!Number.isInteger(row.estimated_minutes) || row.estimated_minutes <= 0)) ||
    !hasValidDeadline ||
    !isTaskPriority(row.priority) ||
    !isTaskStatus(row.status)
  ) {
    throw new Error('Unexpected task data');
  }

  return {
    createdAt: row.created_at,
    deadline: row.deadline,
    ...(row.deadline_local ? { localDeadline: row.deadline_local } : {}),
    ...(row.recurrence
      ? {
          recurrence: {
            kind: row.recurrence as NonNullable<Task['recurrence']>['kind'],
            weekdays: row.recurrence_days,
          },
        }
      : {}),
    estimatedMinutes: row.estimated_minutes,
    goalId: row.goal_id,
    id: row.id,
    priority: row.priority,
    status: row.status,
    title: row.title.trim(),
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toTaskInsert(input: CreateTaskInput, userId: string): TaskInsert {
  return {
    deadline: input.deadline,
    ...(input.localDeadline !== undefined ? { deadline_local: input.localDeadline } : {}),
    ...(input.recurrence
      ? { recurrence: input.recurrence.kind, recurrence_days: input.recurrence.weekdays }
      : {}),
    estimated_minutes: input.estimatedMinutes,
    goal_id: input.goalId,
    priority: input.priority,
    status: input.status,
    title: input.title,
    user_id: userId,
  };
}

function toTaskUpdate(input: UpdateTaskInput): TaskUpdate {
  const update: TaskUpdate = {};

  if (input.localDeadline !== undefined) update.deadline_local = input.localDeadline;
  if (input.recurrence) {
    update.recurrence = input.recurrence.kind;
    update.recurrence_days = input.recurrence.weekdays;
  }
  if (input.deadline !== undefined) update.deadline = input.deadline;
  if (input.estimatedMinutes !== undefined) update.estimated_minutes = input.estimatedMinutes;
  if (input.goalId !== undefined) update.goal_id = input.goalId;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.status !== undefined) update.status = input.status;
  if (input.title !== undefined) update.title = input.title;

  return update;
}

export class SupabaseTaskRepository implements TaskRepository {
  private readonly unconfirmedCreations = new Map<string, string>();

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(): Promise<Task[]> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });

    if (error) {
      reportTaskIssue('list.select', error);
      throw error;
    }
    try {
      return (data ?? []).map((row) => toTask(row, this.userId));
    } catch (cause) {
      reportTaskIssue('list.decode', cause);
      throw cause;
    }
  }

  async listGoalOptions(): Promise<TaskGoalOption[]> {
    const { data, error } = await this.client
      .from('goals')
      .select('id, title')
      .eq('user_id', this.userId)
      .order('title', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((goal) => {
      if (!UUID_PATTERN.test(goal.id) || !goal.title.trim()) {
        throw new Error('Unexpected goal option data');
      }
      return { id: goal.id, title: goal.title.trim() };
    });
  }

  async findById(id: string): Promise<Task | null> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toTask(data, this.userId) : null;
  }

  private async readCreatedTask(id: string): Promise<Task> {
    try {
      const task = await this.findById(id);
      if (task?.id === id) return task;
      throw new Error('Saved task was not returned by ID');
    } catch (cause) {
      reportTaskIssue('create.readBack', cause);
      throw new TaskCreateResultError('saved');
    }
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const payload = toTaskInsert(input, this.userId);
    const key = JSON.stringify(payload);
    const previousId = this.unconfirmedCreations.get(key);
    const id = previousId ?? uuid.v4();
    this.unconfirmedCreations.set(key, id);

    const { data, error, status } = await this.client
      .from('tasks')
      .insert({ ...payload, id })
      .select('*')
      .single();

    let task: Task;
    if (error) {
      reportTaskIssue('create.insert', error);
      if (previousId && error.code === '23505') {
        // A previous request committed. Read the same owned row without rewriting it.
        task = await this.readCreatedTask(id);
      } else {
        if (status === 0 || status >= 500 || error.code === 'PGRST116') {
          throw new TaskCreateResultError('unconfirmed');
        }
        this.unconfirmedCreations.delete(key);
        throw error;
      }
    } else {
      try {
        task = toTask(data, this.userId);
        if (task.id !== id) throw new Error('Task response ID did not match the create request');
      } catch (cause) {
        reportTaskIssue('create.decode', cause);
        task = await this.readCreatedTask(id);
      }
    }
    this.unconfirmedCreations.delete(key);
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const { data, error } = await this.client
      .from('tasks')
      .update(toTaskUpdate(input))
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new TaskNotFoundError();
    return toTask(data, this.userId);
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await this.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new TaskNotFoundError();
  }
}

export function createSupabaseTaskRepository(userId: string): TaskRepository {
  return new SupabaseTaskRepository(getSupabaseClient(), userId);
}
