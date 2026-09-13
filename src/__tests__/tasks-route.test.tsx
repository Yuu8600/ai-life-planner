import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import TasksRoute from '@/app/(tabs)/tasks';

const mockUseAuth = jest.fn();
const mockCreateRepository = jest.fn((_userId: string) => ({ repository: true }));
const mockTasksScreen = jest.fn(({ repository }: { repository: unknown }) => (
  <Text testID="tasks-route-probe">{repository ? 'with-repository' : 'without-repository'}</Text>
));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/tasks/TasksScreen', () => ({
  TasksScreen: (props: { repository: unknown }) => mockTasksScreen(props),
}));

jest.mock('@/services/supabase/repositories/SupabaseTaskRepository', () => ({
  createSupabaseTaskRepository: (userId: string) => mockCreateRepository(userId),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Tasks route composition', () => {
  it('does not create a Supabase repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const screen = await render(<TasksRoute />);

    expect(screen.getByTestId('tasks-route-probe').props.children).toBe('without-repository');
    expect(mockCreateRepository).not.toHaveBeenCalled();
  });

  it('creates the repository with the existing Auth session user id', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    const screen = await render(<TasksRoute />);

    expect(screen.getByTestId('tasks-route-probe').props.children).toBe('with-repository');
    expect(mockCreateRepository).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
});
