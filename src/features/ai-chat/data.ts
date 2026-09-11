import type { ChatMessage } from './types';

export const DUMMY_CONVERSATION: ChatMessage[] = [
  {
    id: 'user-plan-change',
    role: 'user',
    text: '今日は18時から予定入った',
  },
  {
    id: 'assistant-proposal',
    role: 'assistant',
    text: '18時のPart 5と重なるため、17:00〜17:30へ移動できます。変更しますか？',
  },
];
