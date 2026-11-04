import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AiRoute from '@/app/(tabs)/ai';
import type { EdgeProviderAvailability } from '@/services/supabase/providers/EdgeFunctionPlannerProvider';

const userId = '11111111-1111-4111-8111-111111111111';
const mockUseAuth = jest.fn();
let mockParams: { mode?: string; entry?: string } = {};
let mockInstanceSequence = 0;
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockCreateCalendarRepository = jest.fn(() => ({ type: 'calendar' }));
const mockCreateGoalRepository = jest.fn((_userId: string) => ({ type: 'goals' }));
const mockCreatePersistenceRepository = jest.fn(() => ({ type: 'persistence' }));
const mockCreateSettingsRepository = jest.fn((_userId: string) => ({ type: 'settings' }));
const mockCreateTaskRepository = jest.fn((_userId: string) => ({ type: 'tasks' }));
const mockCheckAvailability = jest.fn<Promise<EdgeProviderAvailability>, []>(async () => ({
  available: false,
  reason: 'configuration',
}));
const mockPlannerScreen = jest.fn(
  ({
    goalRepository,
    persistenceRepository,
    provider,
    onSelectProvider,
    openAiAvailability,
    taskRepository,
  }: {
    goalRepository: unknown;
    persistenceRepository: unknown;
    provider: { id: string };
    onSelectProvider: (id: 'openai' | 'rule-based') => void;
    openAiAvailability: string;
    taskRepository: unknown;
  }) => (
    <View>
      <Text testID="planner-route-probe">
        {goalRepository && persistenceRepository && taskRepository
          ? 'with-user-data'
          : 'without-user-data'}
      </Text>
      <Text testID="planner-route-provider">{provider.id}</Text>
      <Text testID="planner-route-availability">{openAiAvailability}</Text>
      <Pressable testID="route-select-openai" onPress={() => onSelectProvider('openai')} />
      <Pressable testID="route-select-rule" onPress={() => onSelectProvider('rule-based')} />
    </View>
  ),
);

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ navigate: mockNavigate, setParams: mockSetParams }),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/planner/PlannerPreviewScreen', () => ({
  PlannerPreviewScreen: (props: {
    goalRepository: unknown;
    persistenceRepository: unknown;
    provider: { id: string };
    onSelectProvider: (id: 'openai' | 'rule-based') => void;
    openAiAvailability: string;
    taskRepository: unknown;
  }) => mockPlannerScreen(props),
}));

jest.mock('@/services/calendar/ExpoCalendarRepository', () => ({
  createExpoCalendarRepository: () => mockCreateCalendarRepository(),
}));

jest.mock('@/services/supabase/providers/EdgeFunctionPlannerProvider', () => ({
  createEdgeFunctionPlannerProvider: () => ({
    checkAvailability: mockCheckAvailability,
    generate: jest.fn(),
    id: 'openai',
  }),
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
jest.mock('@/services/supabase/repositories/SupabasePlannerReplanRepository', () => ({
  createSupabasePlannerReplanRepository: () => ({ type: 'replan' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('Planner route composition', () => {
  it('remounts a retained Preview on EVERY Replan entry and returns to Today on save/cancel', async () => {
    function PreviewProbe() {
      const [instance] = useState(() => ++mockInstanceSequence);
      return <Text testID="preview-instance">{instance}</Text>;
    }
    const original = mockPlannerScreen.getMockImplementation()!;
    mockPlannerScreen.mockImplementation(() => <PreviewProbe />);
    mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
    const screen = await render(<AiRoute />);
    const initial = screen.getByTestId('preview-instance').props.children;
    mockParams = { mode: 'replan', entry: 'one' };
    await screen.rerender(<AiRoute />);
    const first = screen.getByTestId('preview-instance').props.children;
    expect(first).not.toBe(initial);
    mockParams = { mode: 'replan', entry: 'two' };
    await screen.rerender(<AiRoute />);
    expect(screen.getByTestId('preview-instance').props.children).not.toBe(first);
    const props = mockPlannerScreen.mock.calls.at(-1)?.[0] as unknown as {
      mode: string;
      onReplanSaved: () => void;
      onCancelReplan: () => void;
    };
    expect(props.mode).toBe('replan');
    props.onReplanSaved();
    props.onCancelReplan();
    expect(mockNavigate).toHaveBeenCalledWith('/today');
    expect(mockSetParams).toHaveBeenCalledWith({ mode: undefined, entry: undefined });
    mockPlannerScreen.mockImplementation(original);
  });
  it('does not create user-scoped repositories without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });
    const screen = await render(<AiRoute />);

    expect(screen.getByTestId('planner-route-probe').props.children).toBe('without-user-data');
    expect(screen.getByTestId('planner-route-provider').props.children).toBe('rule-based');
    expect(mockCreateCalendarRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateGoalRepository).not.toHaveBeenCalled();
    expect(mockCreatePersistenceRepository).not.toHaveBeenCalled();
    expect(mockCreateSettingsRepository).not.toHaveBeenCalled();
    expect(mockCreateTaskRepository).not.toHaveBeenCalled();
    expect(mockCheckAvailability).not.toHaveBeenCalled();
  });

  it('scopes Planner data repositories to the authenticated user', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
    const screen = await render(<AiRoute />);

    expect(screen.getByTestId('planner-route-probe').props.children).toBe('with-user-data');
    expect(mockCreateGoalRepository).toHaveBeenCalledWith(userId);
    expect(mockCreatePersistenceRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateSettingsRepository).toHaveBeenCalledWith(userId);
    expect(mockCreateTaskRepository).toHaveBeenCalledWith(userId);
    expect(mockCheckAvailability).toHaveBeenCalledTimes(1);
  });

  it('uses Edge only after explicit selection and keeps RuleBased as the default', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
    mockCheckAvailability.mockResolvedValueOnce({ available: true });
    const screen = await render(<AiRoute />);

    expect(screen.getByTestId('planner-route-provider').props.children).toBe('rule-based');
    await waitFor(() =>
      expect(screen.getByTestId('planner-route-availability').props.children).toBe('available'),
    );
    await fireEvent.press(screen.getByTestId('route-select-openai'));
    expect(screen.getByTestId('planner-route-provider').props.children).toBe('openai');
    await fireEvent.press(screen.getByTestId('route-select-rule'));
    expect(screen.getByTestId('planner-route-provider').props.children).toBe('rule-based');
  });
});
