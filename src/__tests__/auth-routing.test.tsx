import type { Session, User } from '@supabase/supabase-js';
import { render } from '@testing-library/react-native';

import IndexRoute from '@/app/index';
import { RootNavigator } from '@/app/_layout';

const mockUseAuth = jest.fn();
const mockRedirect = jest.fn((_props: { href: string }) => null);
const mockStackScreen = jest.fn((_props: { name: string }) => null);
const mockStackProtected = jest.fn(
  ({ children }: { children?: React.ReactNode; guard: boolean }) => children,
);

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const MockStack = Object.assign(
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    {
      Protected: (props: { children?: React.ReactNode; guard: boolean }) =>
        mockStackProtected(props),
      Screen: (props: { name: string }) => mockStackScreen(props),
    },
  );

  return {
    Redirect: (props: { href: string }) => mockRedirect(props),
    Stack: MockStack,
  };
});

jest.mock('@/features/auth', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    AuthLoadingScreen: () =>
      React.createElement(Text, { testID: 'auth-loading-screen' }, 'loading'),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mockUseAuth(),
  };
});

const testSession = {
  access_token: 'test-access-token',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  user: {
    email: 'planner@example.com',
    id: '11111111-1111-4111-8111-111111111111',
  } as User,
} as Session;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authentication routing', () => {
  it('shows only the loading screen while session restoration is pending', async () => {
    mockUseAuth.mockReturnValue({ isRestoring: true, session: null });

    const screen = await render(<IndexRoute />);

    expect(screen.getByTestId('auth-loading-screen')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects a signed-out user to login', async () => {
    mockUseAuth.mockReturnValue({ isRestoring: false, session: null });

    await render(<IndexRoute />);

    expect(mockRedirect.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ href: '/login' }));
  });

  it('redirects a restored session to Today', async () => {
    mockUseAuth.mockReturnValue({ isRestoring: false, session: testSession });

    await render(<IndexRoute />);

    expect(mockRedirect.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ href: '/today' }));
  });

  it('guards auth and application routes with mutually exclusive Stack.Protected states', async () => {
    mockUseAuth.mockReturnValue({ isRestoring: true, session: null });
    const screen = await render(<RootNavigator />);
    expect(mockStackProtected.mock.calls.map(([props]) => props.guard)).toEqual([false, false]);

    mockStackProtected.mockClear();
    mockUseAuth.mockReturnValue({ isRestoring: false, session: null });
    await screen.rerender(<RootNavigator />);
    expect(mockStackProtected.mock.calls.map(([props]) => props.guard)).toEqual([true, false]);

    mockStackProtected.mockClear();
    mockUseAuth.mockReturnValue({ isRestoring: false, session: testSession });
    await screen.rerender(<RootNavigator />);
    expect(mockStackProtected.mock.calls.map(([props]) => props.guard)).toEqual([false, true]);
  });
});
