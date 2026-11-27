import type { PolicyFields } from '@/features/recommendations/policy';
import type { PlannerPriority } from '@/features/planner';

type PriorDraftValues = {
  title: string;
  priority: PlannerPriority;
  deadline: string | null;
  minutes?: number | null;
  goalId?: string | null;
  recurrence?: string;
  weekdays?: number[];
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
  patch?: Record<string, unknown>;
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
export type PolicyProposal = PolicyFields & {
  key: string;
  kind: 'policy';
  title: string;
  targetTitle?: string | null;
};
export type CalendarShare =
  | { mode: 'availability_summary'; date: string; hasEvents: boolean }
  | {
      mode: 'selected_event_details';
      date: string;
      includeLocation: boolean;
      events: { title: string; startAt: string; endAt: string; location?: string }[];
    };
export type DraftItem = RecordProposal | PlanProposal | StepProposal | PolicyProposal;
export type Draft = {
  createdAt?: string;
  id: string;
  revision: string;
  approvedAt: string | null;
  rejectedAt?: string | null;
  undoTaskIds?: string[];
  calendarThreadId?: string;
  appliedKeys?: string[];
  items: DraftItem[];
};
export type PrivateConsultation = { reply: string; requestId: string; policies: PolicyProposal[] };
export type Thread = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  canManage?: boolean;
};
export type MessageCursor = { id: string; createdAt: string };
export type MessagePage = { messages: ChatMessage[]; olderCursor: MessageCursor | null };
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  createdAt?: string;
};
export type Usage = {
  configured: boolean;
  calendarSharing?: boolean;
  remainingMicros: number;
  month: string;
};
export interface ChatRepository {
  listThreads(): Promise<Thread[]>;
  createThread(title: string): Promise<Thread>;
  renameThread?(thread: Thread, title: string): Promise<Thread>;
  removeThread?(thread: Thread): Promise<void>;
  open(threadId: string): Promise<MessagePage & { drafts: Draft[] }>;
  listOlder(threadId: string, cursor: MessageCursor): Promise<MessagePage>;
  send(
    threadId: string,
    prompt: string,
    date?: string,
    draftId?: string,
    focus?: ChatFocus,
    calendar?: CalendarShare,
  ): Promise<PrivateConsultation | void>;
  usage(): Promise<Usage>;
  edit(draft: Draft, items: DraftItem[]): Promise<void>;
  reject?(draft: Draft): Promise<void>;
  undoTaskEdit?(draftId: string, taskId: string): Promise<void>;
  approve(draft: Draft, selected: string[], editedItems?: DraftItem[]): Promise<void>;
}
