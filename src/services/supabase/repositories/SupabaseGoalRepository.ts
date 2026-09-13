import type { SupabaseClient } from '@supabase/supabase-js';

import { GoalNotFoundError } from '@/features/goals/errors';
import type {
  CreateGoalInput,
  Goal,
  GoalPriority,
  GoalRepository,
  GoalStatus,
  UpdateGoalInput,
} from '@/features/goals/repositories/GoalRepository';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

type GoalRow = Database['public']['Tables']['goals']['Row'];
type GoalInsert = Database['public']['Tables']['goals']['Insert'];
type GoalUpdate = Database['public']['Tables']['goals']['Update'];

function isGoalPriority(value: string): value is GoalPriority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isGoalStatus(value: string): value is GoalStatus {
  return value === 'active' || value === 'completed' || value === 'archived';
}

function toGoal(row: GoalRow): Goal {
  if (!isGoalPriority(row.priority) || !isGoalStatus(row.status)) {
    throw new Error('Unexpected goal data');
  }

  return {
    createdAt: row.created_at,
    currentValue: row.current_value,
    deadline: row.deadline,
    description: row.description,
    id: row.id,
    priority: row.priority,
    status: row.status,
    targetValue: row.target_value,
    title: row.title,
    unit: row.unit,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toGoalInsert(input: CreateGoalInput, userId: string): GoalInsert {
  return {
    current_value: input.currentValue,
    deadline: input.deadline,
    description: input.description,
    priority: input.priority,
    status: input.status,
    target_value: input.targetValue,
    title: input.title,
    unit: input.unit,
    user_id: userId,
  };
}

function toGoalUpdate(input: UpdateGoalInput): GoalUpdate {
  const update: GoalUpdate = {};

  if (input.currentValue !== undefined) update.current_value = input.currentValue;
  if (input.deadline !== undefined) update.deadline = input.deadline;
  if (input.description !== undefined) update.description = input.description;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.status !== undefined) update.status = input.status;
  if (input.targetValue !== undefined) update.target_value = input.targetValue;
  if (input.title !== undefined) update.title = input.title;
  if (input.unit !== undefined) update.unit = input.unit;

  return update;
}

export class SupabaseGoalRepository implements GoalRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(): Promise<Goal[]> {
    const { data, error } = await this.client
      .from('goals')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toGoal);
  }

  async findById(id: string): Promise<Goal | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toGoal(data) : null;
  }

  async create(input: CreateGoalInput): Promise<Goal> {
    const { data, error } = await this.client
      .from('goals')
      .insert(toGoalInsert(input, this.userId))
      .select('*')
      .single();

    if (error) throw error;
    return toGoal(data);
  }

  async update(id: string, input: UpdateGoalInput): Promise<Goal> {
    const { data, error } = await this.client
      .from('goals')
      .update(toGoalUpdate(input))
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new GoalNotFoundError();
    return toGoal(data);
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await this.client
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new GoalNotFoundError();
  }
}

export function createSupabaseGoalRepository(userId: string): GoalRepository {
  return new SupabaseGoalRepository(getSupabaseClient(), userId);
}
