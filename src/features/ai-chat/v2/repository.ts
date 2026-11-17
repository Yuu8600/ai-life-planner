import type { PlannerPriority } from '@/features/planner';

type PriorDraftValues = {
  title: string;
  priority: PlannerPriority;
  deadline: string | null;
  minutes?: number | null;
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
  goalId?: string | null;
  parentUpdatedAt?: string | null;
  parentTitle?: string | null;
  reason?: string | null;
};
export type PlanProposal = {
  key: string;
  kind: 'plan';
  title: string;
  date: string;
  taskId: string | null;
};
export type StepProposal = {
  key: string;
  kind: 'step';
  title: string;
  minutes: number | null;
  taskId: string;
  parentUpdatedAt: string;
  parentTitle: string;
  reason?: string | null;
};
export type ChatFocus = { kind: 'task' | 'goal'; id: string; title: string };
export type DraftItem = RecordProposal | PlanProposal | StepProposal;
export type Draft = { id: string; revision: string; approvedAt: string | null; items: DraftItem[] };
export type Thread = { id: string; title: string };
export type MessageCursor = { id: string; createdAt: string };
export type MessagePage = { messages: ChatMessage[]; olderCursor: MessageCursor | null };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; body: string };
export type Usage = { configured: boolean; remainingMicros: number; month: string };
export interface ChatRepository {
  listThreads(): Promise<Thread[]>;
  createThread(title: string): Promise<Thread>;
  open(threadId: string): Promise<MessagePage & { drafts: Draft[] }>;
  listOlder(threadId: string, cursor: MessageCursor): Promise<MessagePage>;
  send(
    threadId: string,
    prompt: string,
    date?: string,
    draftId?: string,
    focus?: ChatFocus,
  ): Promise<void>;
  usage(): Promise<Usage>;
  edit(draft: Draft, items: DraftItem[]): Promise<void>;
  approve(draft: Draft, selected: string[]): Promise<void>;
}
