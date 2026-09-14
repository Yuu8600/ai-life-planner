export type PlannedActionStatus = 'completed' | 'scheduled' | 'skipped';

export type TodayPlannedAction = {
  endAt: string;
  goalTitle: string | null;
  id: string;
  startAt: string;
  status: PlannedActionStatus;
  taskId: string | null;
  taskTitle: string | null;
  title: string;
};

export type TodayProjection = {
  actions: TodayPlannedAction[];
  greeting: string;
  localDate: string;
  summary: string | null;
  timezone: string;
};

export interface TodayRepository {
  getToday(): Promise<TodayProjection>;
}
