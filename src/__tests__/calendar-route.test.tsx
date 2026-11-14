import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import CalendarRoute from '@/navigation/routes/CalendarRoute';

const mockUseAuth = jest.fn();
const mockCreateCalendarRepository = jest.fn(() => ({ type: 'calendar' }));
const mockCreateSettingsRepository = jest.fn((_userId: string) => ({ type: 'settings' }));
const mockCalendarScreen = jest.fn(({ settingsRepository }: { settingsRepository: unknown }) => (
  <Text testID="calendar-route-probe">
    {settingsRepository ? 'with-settings' : 'without-settings'}
  </Text>
));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/features/calendar/CalendarScreen', () => ({
  CalendarScreen: (props: { settingsRepository: unknown }) => mockCalendarScreen(props),
}));

jest.mock('@/services/calendar/ExpoCalendarRepository', () => ({
  createExpoCalendarRepository: () => mockCreateCalendarRepository(),
}));

jest.mock('@/services/supabase/repositories/SupabaseSettingsRepository', () => ({
  createSupabaseSettingsRepository: (userId: string) => mockCreateSettingsRepository(userId),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Calendar route composition', () => {
  it('does not create a profile repository without an authenticated session', async () => {
    mockUseAuth.mockReturnValue({ session: null });
    const screen = await render(<CalendarRoute />);

    expect(screen.getByTestId('calendar-route-probe').props.children).toBe('without-settings');
    expect(mockCreateCalendarRepository).toHaveBeenCalledTimes(1);
    expect(mockCreateSettingsRepository).not.toHaveBeenCalled();
  });

  it('scopes profile timezone loading to the authenticated user', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: userId } } });
    const screen = await render(<CalendarRoute />);

    expect(screen.getByTestId('calendar-route-probe').props.children).toBe('with-settings');
    expect(mockCreateSettingsRepository).toHaveBeenCalledWith(userId);
  });
});

const userId = '11111111-1111-4111-8111-111111111111';

// This composition test injects the new adapter; no Supabase client is constructed.
jest.mock('@/services/supabase/repositories/SupabaseCalendarEventBufferRepository', () => ({
  createSupabaseCalendarEventBufferRepository: (userId: string) => ({
    type: 'event-buffers',
    userId,
  }),
}));
