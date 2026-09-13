export type TaskPriority = 'high' | 'low' | 'medium';
export type TaskStatus = 'completed' | 'pending' | 'scheduled' | 'skipped';

export type Task = {
  createdAt: string;
  deadline: string | null;
  estimatedMinutes: number;
  goalId: string | null;
  id: string;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  updatedAt: string;
  userId: string;
};

export type CreateTaskInput = Pick<
  Task,
  'deadline' | 'estimatedMinutes' | 'goalId' | 'priority' | 'status' | 'title'
>;

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type TaskGoalOption = {
  id: string;
  title: string;
};

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  list(): Promise<Task[]>;
  listGoalOptions(): Promise<TaskGoalOption[]>;
  remove(id: string): Promise<void>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
}
