export type PlannedActionStatus = 'completed' | 'scheduled' | 'skipped';

export type TodayPlannedAction = {
  endAt: string;
  goalTitle: string | null;
  id: string;
  reason: string | null;
  startAt: string;
  status: PlannedActionStatus;
  taskId: string | null;
  taskTitle: string | null;
  title: string;
};

export type TodayDailyPlan = {
  actions: TodayPlannedAction[];
  date: string;
  id: string;
  summary: string | null;
  timezone: string;
};

export type TodayTaskStatus = 'completed' | 'pending' | 'scheduled' | 'skipped';

export type TodayDeadlineTask = {
  deadlineAt: string;
  goalTitle: string | null;
  id: string;
  status: TodayTaskStatus;
  title: string;
};

export type TodayProjection = {
  deadlineTasks: TodayDeadlineTask[];
  greeting: string;
  localDate: string;
  plan: TodayDailyPlan | null;
  profileTimezone: string;
};

export interface TodayRepository {
  getToday(): Promise<TodayProjection>;
}
