import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import SettingsRoute from '@/app/settings';

const mockBack = jest.fn();
const mockUseAuth = jest.fn();
const mockCreateRepository = jest.fn((_userId: string) => ({ repository: true }));
const mockSettingsScreen = jest.fn(({ repository }: { repository: unknown }) => (
  <Text testID="settings-route-probe">{repository ? 'with-repository' : 'without-repository'}</Text>
));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/settings/SettingsScreen', () => ({
  SettingsScreen: (props: { repository: unknown }) => mockSettingsScreen(props),
}));

jest.mock('@/services/supabase/repositories/SupabaseSettingsRepository', () => ({
  createSupabaseSettingsRepository: (userId: string) => mockCreateRepository(userId),
}));

jest.mock('@/services/supabase/repositories/SupabaseDailyPlanningRepository', () => ({
  createSupabaseDailyPlanningRepository: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Settings route composition', () => {
  it('does not create a Supabase repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const screen = await render(<SettingsRoute />);

    expect(screen.getByTestId('settings-route-probe').props.children).toBe('without-repository');
    expect(mockCreateRepository).not.toHaveBeenCalled();
  });

  it('creates the repository with the existing Auth session user id', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: userId } },
    });

    const screen = await render(<SettingsRoute />);

    expect(screen.getByTestId('settings-route-probe').props.children).toBe('with-repository');
    expect(mockCreateRepository).toHaveBeenCalledWith(userId);
  });
});

const userId = '11111111-1111-4111-8111-111111111111';
