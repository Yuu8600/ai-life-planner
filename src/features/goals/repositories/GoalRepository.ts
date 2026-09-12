export type GoalPriority = 'high' | 'low' | 'medium';
export type GoalStatus = 'active' | 'archived' | 'completed';

export type Goal = {
  createdAt: string;
  currentValue: number | null;
  deadline: string | null;
  description: string | null;
  id: string;
  priority: GoalPriority;
  status: GoalStatus;
  targetValue: number | null;
  title: string;
  unit: string | null;
  updatedAt: string;
  userId: string;
};

export type CreateGoalInput = Pick<
  Goal,
  | 'currentValue'
  | 'deadline'
  | 'description'
  | 'priority'
  | 'status'
  | 'targetValue'
  | 'title'
  | 'unit'
>;

export type UpdateGoalInput = Partial<CreateGoalInput>;

export interface GoalRepository {
  create(input: CreateGoalInput): Promise<Goal>;
  findById(id: string): Promise<Goal | null>;
  list(): Promise<Goal[]>;
  remove(id: string): Promise<void>;
  update(id: string, input: UpdateGoalInput): Promise<Goal>;
}
