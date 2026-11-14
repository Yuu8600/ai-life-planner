import type { PlannerPriority } from '@/features/planner';

type PriorDraftValues = {
  title: string;
  priority: PlannerPriority;
  deadline: string | null;
  minutes?: number;
};
export type RecordProposal = {
  key: string;
  kind: 'goal' | 'task';
  title: string;
  priority: PlannerPriority;
  deadline: string | null;
  minutes: number | null;
  goalKey: string | null;
  targetId: string | null;
  before: PriorDraftValues | null;
  expectedUpdatedAt: string | null;
};
export type PlanProposal = {
  key: string;
  kind: 'plan';
  title: string;
  date: string;
  taskId: string | null;
};
export type DraftItem = RecordProposal | PlanProposal;
export type Draft = { id: string; revision: string; approvedAt: string | null; items: DraftItem[] };
export type Thread = { id: string; title: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; body: string };
export type Usage = { configured: boolean; remainingMicros: number; month: string };
export interface ChatRepository {
  listThreads(): Promise<Thread[]>;
  createThread(title: string): Promise<Thread>;
  open(threadId: string): Promise<{ drafts: Draft[]; messages: ChatMessage[] }>;
  send(threadId: string, prompt: string, date?: string, draftId?: string): Promise<void>;
  usage(): Promise<Usage>;
  edit(draft: Draft, items: DraftItem[]): Promise<void>;
  approve(draft: Draft, selected: string[]): Promise<void>;
}
