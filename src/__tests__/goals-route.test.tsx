import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import GoalsRoute from '@/app/(tabs)/goals';

const mockUseAuth = jest.fn();
const mockCreateRepository = jest.fn((_userId: string) => ({ repository: true }));
const mockGoalsScreen = jest.fn(({ repository }: { repository: unknown }) => (
  <Text testID="goals-route-probe">{repository ? 'with-repository' : 'without-repository'}</Text>
));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/goals/GoalsScreen', () => ({
  GoalsScreen: (props: { repository: unknown }) => mockGoalsScreen(props),
}));

jest.mock('@/services/supabase/repositories/SupabaseGoalRepository', () => ({
  createSupabaseGoalRepository: (userId: string) => mockCreateRepository(userId),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Goals route composition', () => {
  it('does not create a Supabase repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const screen = await render(<GoalsRoute />);

    expect(screen.getByTestId('goals-route-probe').props.children).toBe('without-repository');
    expect(mockCreateRepository).not.toHaveBeenCalled();
  });

  it('creates the repository with the existing Auth session user id', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    const screen = await render(<GoalsRoute />);

    expect(screen.getByTestId('goals-route-probe').props.children).toBe('with-repository');
    expect(mockCreateRepository).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
});
