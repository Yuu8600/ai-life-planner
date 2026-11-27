import { fireEvent, render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import AiRoute from '@/app/(tabs)/ai';
import CalendarRoute from '@/app/(tabs)/calendar';
import TodayRoute from '@/app/(tabs)/today';
import AdvancedPlannerRoute from '@/app/advanced-planner';
import type { PlanProposal } from '@/features/ai-chat/v2/repository';

const userId = '11111111-1111-4111-8111-111111111111';
const mockUseAuth = jest.fn();
const mockPush = jest.fn();
const mockCreateDailyRepository = jest.fn((_id: string) => ({}));
const mockCreateChatRepository = jest.fn((_id: string) => ({}));
const mockParams = { date: '2026-11-16', taskId: 'task', review: 'review' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/services/supabase/repositories/SupabaseSettingsRepository', () => ({
  createSupabaseSettingsRepository: () => ({
    getProfilePlanningSettings: () => Promise.resolve({ timezone: 'Asia/Tokyo' }),
  }),
}));
jest.mock('@/services/supabase/repositories/SupabaseFixedEventRepository', () => ({
  createSupabaseFixedEventRepository: () => ({}),
}));
jest.mock('@/services/supabase/repositories/SupabaseTaskRepository', () => ({
  createSupabaseTaskRepository: () => ({}),
}));
jest.mock('@/services/supabase/repositories/SupabaseRecommendationRepository', () => ({
  createSupabaseRecommendationRepository: () => ({}),
}));
jest.mock('@/features/calendar/DayAgenda', () => ({
  DayAgenda: () => <MockText>予定だけを表示</MockText>,
}));
jest.mock('@/features/recommendations/TodayRecommendationsScreen', () => ({
  TodayRecommendationsScreen: ({
    askTaskAI,
  }: {
    askTaskAI: (task: { id: string; title: string }) => void;
  }) => (
    <MockText onPress={() => askTaskAI({ id: 'parent-task', title: '相談するタスク' })}>
      今日のおすすめ
    </MockText>
  ),
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
jest.mock('@/services/supabase/repositories/SupabaseTodayRepository', () => ({
  createSupabaseTodayRepository: () => ({}),
}));
jest.mock('@/services/supabase/repositories/SupabaseActivityLogRepository', () => ({
  createSupabaseActivityLogRepository: () => ({}),
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
      <AdvancedPlannerRoute />
    </>,
  );
  expect(screen.toJSON()).toBeNull();
  expect(mockCreateDailyRepository).not.toHaveBeenCalled();
  expect(mockCreateChatRepository).not.toHaveBeenCalled();
});

it('opens everyday routes without loading Planner and sends AI plan drafts to advanced review', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
  const screen = await render(
    <>
      <TodayRoute />
      <CalendarRoute />
      <AiRoute />
    </>,
  );
  expect(screen.getByText('今日のおすすめ')).toBeTruthy();
  expect(screen.getByText('予定だけを表示')).toBeTruthy();
  expect(mockCreateDailyRepository).not.toHaveBeenCalled();
  expect(mockCreateChatRepository).toHaveBeenCalledWith(userId);
  await fireEvent.press(screen.getByText('確認'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/advanced-planner',
    params: { date: mockParams.date, taskId: mockParams.taskId, review: expect.any(String) },
  });
});

it('retains the advanced Planner route with the existing account and date', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
  const screen = await render(<AdvancedPlannerRoute />);
  expect(screen.getByText('today 2026-11-16')).toBeTruthy();
  expect(mockCreateDailyRepository).toHaveBeenCalledWith(userId);
});

it('opens a task-focused AI conversation directly from Today', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
  const screen = await render(<TodayRoute />);
  await fireEvent.press(screen.getByText('今日のおすすめ'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/ai',
    params: {
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      intent: 'edit',
      focusKind: 'task',
      focusId: 'parent-task',
      focusTitle: '相談するタスク',
      entry: expect.any(String),
    },
  });
});
