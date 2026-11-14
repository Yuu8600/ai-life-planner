import type { ProfilePlanningSettings } from '@/features/settings';
import type { DailyPlan, DayInput, FlexibleEvent, PlanningTask, FixedEvent } from './types';

export type LocalEvent =
  | (FixedEvent & { kind: 'fixed'; before: number; after: number })
  | (FlexibleEvent & { kind: 'flexible' });
export type SavedPlan = { revision: string; plan: DailyPlan };
export type DaySnapshot = {
  source: string;
  saved: SavedPlan | null;
  settings: ProfilePlanningSettings;
  tasks: PlanningTask[];
  gap: number;
  events: LocalEvent[];
  history: DayInput['history'];
};

export interface DailyPlanningRepository {
  getSettings(): Promise<ProfilePlanningSettings>;
  load(date: string): Promise<DaySnapshot>;
  save(date: string, revision: string | null, source: string, plan: DailyPlan): Promise<void>;
  addEvent(date: string, event: LocalEvent): Promise<void>;
  removeEvent(id: string): Promise<void>;
  getGap(): Promise<number>;
  setGap(minutes: number): Promise<void>;
}

export class PlanConflictError extends Error {
  constructor() {
    super('確認中に予定やタスクが更新されました。最新の状態から確認し直してください。');
  }
}
