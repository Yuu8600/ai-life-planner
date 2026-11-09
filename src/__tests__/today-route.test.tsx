import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import TodayRoute from '@/app/(tabs)/today';

jest.mock('@/services/supabase/repositories/SupabaseSettingsRepository', () => ({
  createSupabaseSettingsRepository: jest.fn(() => ({ type: 'settings' })),
}));
jest.mock('@/services/supabase/repositories/SupabaseCalendarEventBufferRepository', () => ({
  createSupabaseCalendarEventBufferRepository: jest.fn(() => ({ type: 'buffers' })),
}));
const mockPush = jest.fn();
const mockUseAuth = jest.fn();
const mockCreateRepository = jest.fn((_userId: string) => ({ repository: true }));
const mockCreateExecutionRepository = jest.fn(() => ({ executionRepository: true }));
const mockCreateActivityRepository = jest.fn((_userId: string) => ({ history: true }));
let mockFocusCallback: (() => void) | undefined;
const mockTodayScreen = jest.fn(
  ({ refreshToken, repository }: { refreshToken: number; repository: unknown }) => (
    <>
      <Text testID="today-route-probe">
        {repository ? 'with-repository' : 'without-repository'}
      </Text>
      <Text testID="today-refresh-token">{refreshToken}</Text>
    </>
  ),
);

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocusCallback = callback;
  },
  useIsFocused: () => true,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/today/TodayScreen', () => ({
  TodayScreen: (props: { refreshToken: number; repository: unknown }) => mockTodayScreen(props),
}));

jest.mock('@/services/supabase/repositories/SupabaseTodayRepository', () => ({
  createSupabaseTodayRepository: (userId: string) => mockCreateRepository(userId),
}));
jest.mock('@/services/supabase/repositories/SupabasePlannedActionExecutionRepository', () => ({
  createSupabasePlannedActionExecutionRepository: () => mockCreateExecutionRepository(),
}));
jest.mock('@/services/supabase/repositories/SupabaseActivityLogRepository', () => ({
  createSupabaseActivityLogRepository: (userId: string) => mockCreateActivityRepository(userId),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallback = undefined;
});

describe('Today route composition', () => {
  it('opens the shared AI tab with a new Replan entry token on each request', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });
    await render(<TodayRoute />);
    const props = mockTodayScreen.mock.calls.at(-1)?.[0] as unknown as {
      onPressReplan: () => void;
      onPressAi: () => void;
    };
    props.onPressReplan();
    props.onPressReplan();
    expect(mockPush.mock.calls[0][0]).toEqual({
      pathname: '/ai',
      params: { mode: 'replan', entry: expect.any(String) },
    });
    expect(mockPush.mock.calls[0][0].params.entry).not.toBe(mockPush.mock.calls[1][0].params.entry);
    props.onPressAi();
    expect(mockPush.mock.calls.at(-1)?.[0].params.mode).toBe('generate');
  });
  it('does not create a repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const screen = await render(<TodayRoute />);

    expect(screen.getByTestId('today-route-probe').props.children).toBe('without-repository');
    expect(mockCreateRepository).not.toHaveBeenCalled();
    expect(mockCreateExecutionRepository).not.toHaveBeenCalled();
    expect(mockCreateActivityRepository).not.toHaveBeenCalled();
    expect(mockTodayScreen.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ executionRepository: null, activityLogRepository: null }),
    );
  });

  it('creates the repository with the existing Auth session user id', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    const screen = await render(<TodayRoute />);

    expect(screen.getByTestId('today-route-probe').props.children).toBe('with-repository');
    expect(mockCreateRepository).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(mockCreateExecutionRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateActivityRepository).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(mockTodayScreen.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        executionRepository: { executionRepository: true },
        activityLogRepository: { history: true },
      }),
    );
  });

  it('increments the refresh token when Today regains focus', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });
    const screen = await render(<TodayRoute />);

    expect(screen.getByTestId('today-refresh-token').props.children).toBe(0);
    await act(async () => {
      mockFocusCallback?.();
      await Promise.resolve();
    });
    await act(async () => {
      mockFocusCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('today-refresh-token').props.children).toBe(1);
    });
  });
});
