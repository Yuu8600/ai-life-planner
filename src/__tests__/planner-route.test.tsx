import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import AiRoute from '@/app/(tabs)/ai';

const userId = '11111111-1111-4111-8111-111111111111';
const mockUseAuth = jest.fn();
const mockCreateCalendarRepository = jest.fn(() => ({ type: 'calendar' }));
const mockCreateGoalRepository = jest.fn((_userId: string) => ({ type: 'goals' }));
const mockCreatePersistenceRepository = jest.fn(() => ({ type: 'persistence' }));
const mockCreateSettingsRepository = jest.fn((_userId: string) => ({ type: 'settings' }));
const mockCreateTaskRepository = jest.fn((_userId: string) => ({ type: 'tasks' }));
const mockPlannerScreen = jest.fn(
  ({
    goalRepository,
    persistenceRepository,
    taskRepository,
  }: {
    goalRepository: unknown;
    persistenceRepository: unknown;
    taskRepository: unknown;
  }) => (
    <Text testID="planner-route-probe">
      {goalRepository && persistenceRepository && taskRepository
        ? 'with-user-data'
        : 'without-user-data'}
    </Text>
  ),
);

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/planner/PlannerPreviewScreen', () => ({
  PlannerPreviewScreen: (props: {
    goalRepository: unknown;
    persistenceRepository: unknown;
    taskRepository: unknown;
  }) => mockPlannerScreen(props),
}));

jest.mock('@/services/calendar/ExpoCalendarRepository', () => ({
  createExpoCalendarRepository: () => mockCreateCalendarRepository(),
}));

jest.mock('@/services/supabase/repositories/SupabaseGoalRepository', () => ({
  createSupabaseGoalRepository: (id: string) => mockCreateGoalRepository(id),
}));

jest.mock('@/services/supabase/repositories/SupabasePlannerPersistenceRepository', () => ({
  createSupabasePlannerPersistenceRepository: () => mockCreatePersistenceRepository(),
}));

jest.mock('@/services/supabase/repositories/SupabaseSettingsRepository', () => ({
  createSupabaseSettingsRepository: (id: string) => mockCreateSettingsRepository(id),
}));

jest.mock('@/services/supabase/repositories/SupabaseTaskRepository', () => ({
  createSupabaseTaskRepository: (id: string) => mockCreateTaskRepository(id),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Planner route composition', () => {
  it('does not create user-scoped repositories without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });
    const screen = await render(<AiRoute />);

    expect(screen.getByTestId('planner-route-probe').props.children).toBe('without-user-data');
    expect(mockCreateCalendarRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateGoalRepository).not.toHaveBeenCalled();
    expect(mockCreatePersistenceRepository).not.toHaveBeenCalled();
    expect(mockCreateSettingsRepository).not.toHaveBeenCalled();
    expect(mockCreateTaskRepository).not.toHaveBeenCalled();
  });

  it('scopes Planner data repositories to the authenticated user', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
    const screen = await render(<AiRoute />);

    expect(screen.getByTestId('planner-route-probe').props.children).toBe('with-user-data');
    expect(mockCreateGoalRepository).toHaveBeenCalledWith(userId);
    expect(mockCreatePersistenceRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateSettingsRepository).toHaveBeenCalledWith(userId);
    expect(mockCreateTaskRepository).toHaveBeenCalledWith(userId);
  });
});
