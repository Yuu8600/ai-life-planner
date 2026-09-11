export type GoalPriority = 'high' | 'medium';

export type GoalSummary = {
  currentValue: string;
  deadline: string;
  id: string;
  priority: GoalPriority;
  priorityLabel: string;
  progress: number;
  targetValue: string;
  title: string;
  unit: string;
};
