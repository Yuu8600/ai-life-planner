import type { Session, User } from '@supabase/supabase-js';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import type { AuthStateListener, SupabaseAuthService } from '@/services/supabase/auth';

jest.mock('@/services/supabase/auth', () => ({
  supabaseAuthService: {},
}));

const testUser = {
  email: 'planner@example.com',
  id: '11111111-1111-4111-8111-111111111111',
} as User;

const testSession = {
  access_token: 'test-access-token',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  user: testUser,
} as Session;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function AuthStateProbe() {
  const { isRestoring, session } = useAuth();

  return (
    <>
      <Text testID="restoration-state">{isRestoring ? 'restoring' : 'ready'}</Text>
      <Text testID="session-state">{session?.user.email ?? 'no-session'}</Text>
    </>
  );
}

function createMockService(currentSession: Promise<Session | null>) {
  let authListener: AuthStateListener | undefined;
  const unsubscribe = jest.fn();
  const stopAutoRefresh = jest.fn();

  const service: SupabaseAuthService = {
    getCurrentSession: jest.fn(() => currentSession),
    loginWithPassword: jest.fn(async () => testSession),
    logout: jest.fn(async () => undefined),
    signupWithPassword: jest.fn(async () => ({ session: null, user: testUser })),
    startAuthAutoRefresh: jest.fn(() => stopAutoRefresh),
    subscribeToAuthState: jest.fn((listener) => {
      authListener = listener;
      return unsubscribe;
    }),
  };

  return {
    getAuthListener() {
      if (!authListener) {
        throw new Error('Auth listener was not registered');
      }

      return authListener;
    },
    service,
    stopAutoRefresh,
    unsubscribe,
  };
}

describe('AuthProvider', () => {
  it('keeps the restoration state active until a null session is restored and cleans up', async () => {
    const restoration = createDeferred<Session | null>();
    const { service, stopAutoRefresh, unsubscribe } = createMockService(restoration.promise);
    const screen = await render(
      <AuthProvider service={service}>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('restoration-state').props.children).toBe('restoring');
    expect(screen.getByTestId('session-state').props.children).toBe('no-session');

    await act(async () => {
      restoration.resolve(null);
      await restoration.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId('restoration-state').props.children).toBe('ready');
    });
    expect(screen.getByTestId('session-state').props.children).toBe('no-session');

    await screen.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('restores an existing session', async () => {
    const { service } = createMockService(Promise.resolve(testSession));
    const screen = await render(
      <AuthProvider service={service}>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('restoration-state').props.children).toBe('ready');
      expect(screen.getByTestId('session-state').props.children).toBe('planner@example.com');
    });
  });

  it('does not let a late restoration overwrite a newer auth event', async () => {
    const restoration = createDeferred<Session | null>();
    const { getAuthListener, service } = createMockService(restoration.promise);
    const screen = await render(
      <AuthProvider service={service}>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await act(() => {
      getAuthListener()('SIGNED_IN', testSession);
    });
    expect(screen.getByTestId('session-state').props.children).toBe('planner@example.com');

    await act(async () => {
      restoration.resolve(null);
      await restoration.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId('restoration-state').props.children).toBe('ready');
    });
    expect(screen.getByTestId('session-state').props.children).toBe('planner@example.com');

    await act(() => {
      getAuthListener()('SIGNED_OUT', null);
    });
    expect(screen.getByTestId('session-state').props.children).toBe('no-session');
  });
});
