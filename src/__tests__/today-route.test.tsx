import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import TodayRoute from '@/app/(tabs)/today';

const mockPush = jest.fn();
const mockUseAuth = jest.fn();
const mockCreateRepository = jest.fn((_userId: string) => ({ repository: true }));
const mockTodayScreen = jest.fn(({ repository }: { repository: unknown }) => (
  <Text testID="today-route-probe">{repository ? 'with-repository' : 'without-repository'}</Text>
));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/today/TodayScreen', () => ({
  TodayScreen: (props: { repository: unknown }) => mockTodayScreen(props),
}));

jest.mock('@/services/supabase/repositories/SupabaseTodayRepository', () => ({
  createSupabaseTodayRepository: (userId: string) => mockCreateRepository(userId),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Today route composition', () => {
  it('does not create a repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const screen = await render(<TodayRoute />);

    expect(screen.getByTestId('today-route-probe').props.children).toBe('without-repository');
    expect(mockCreateRepository).not.toHaveBeenCalled();
  });

  it('creates the repository with the existing Auth session user id', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    const screen = await render(<TodayRoute />);

    expect(screen.getByTestId('today-route-probe').props.children).toBe('with-repository');
    expect(mockCreateRepository).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
});
