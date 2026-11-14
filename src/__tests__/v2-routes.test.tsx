import { fireEvent, render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import AiRoute from '@/app/(tabs)/ai';
import CalendarRoute from '@/app/(tabs)/calendar';
import TodayRoute from '@/app/(tabs)/today';
import type { PlanProposal } from '@/features/ai-chat/v2/repository';

const userId = '11111111-1111-4111-8111-111111111111';
const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockCreateDailyRepository = jest.fn((_id: string) => ({}));
const mockCreateChatRepository = jest.fn((_id: string) => ({}));
const mockParams = { date: '2026-11-16', taskId: 'task', review: 'review' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/features/auth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/services/calendar/ExpoCalendarRepository', () => ({
  createExpoCalendarRepository: () => ({}),
}));
jest.mock('@/services/supabase/repositories/SupabaseCalendarEventBufferRepository', () => ({
  createSupabaseCalendarEventBufferRepository: () => ({}),
}));
jest.mock('@/services/supabase/repositories/SupabaseDailyPlanningRepository', () => ({
  createSupabaseDailyPlanningRepository: (id: string) => mockCreateDailyRepository(id),
}));
jest.mock('@/services/supabase/repositories/SupabaseChatRepository', () => ({
  createSupabaseChatRepository: (id: string) => mockCreateChatRepository(id),
}));
jest.mock('@/features/planner/v2/DailyPlanningScreen', () => ({
  DailyPlanningScreen: ({ mode, initialDate }: { mode: string; initialDate?: string }) => (
    <MockText>{[mode, initialDate].filter(Boolean).join(' ')}</MockText>
  ),
}));
jest.mock('@/features/ai-chat/v2/ChatScreen', () => ({
  ChatScreen: ({ reviewPlan }: { reviewPlan: (plan: PlanProposal) => void }) => (
    <MockText
      onPress={() =>
        reviewPlan({
          key: 'draft',
          kind: 'plan',
          title: 'Plan',
          date: mockParams.date,
          taskId: mockParams.taskId,
        })
      }
    >
      確認
    </MockText>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('requires a session for V2 planning and chat', async () => {
  mockUseAuth.mockReturnValue({ session: null });
  const screen = await render(
    <>
      <TodayRoute />
      <CalendarRoute />
      <AiRoute />
    </>,
  );
  expect(screen.toJSON()).toBeNull();
  expect(mockCreateDailyRepository).not.toHaveBeenCalled();
  expect(mockCreateChatRepository).not.toHaveBeenCalled();
});

it('scopes V2 repositories to the signed-in user and sends AI drafts to Today review', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
  const screen = await render(
    <>
      <TodayRoute />
      <CalendarRoute />
      <AiRoute />
    </>,
  );
  expect(screen.getByText('today 2026-11-16')).toBeTruthy();
  expect(screen.getByText('calendar')).toBeTruthy();
  expect(mockCreateDailyRepository).toHaveBeenCalledWith(userId);
  expect(mockCreateChatRepository).toHaveBeenCalledWith(userId);
  await fireEvent.press(screen.getByText('確認'));
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: '/today',
    params: { date: mockParams.date, taskId: mockParams.taskId, review: expect.any(String) },
  });
});
