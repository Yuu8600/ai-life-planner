import type { Session, User } from '@supabase/supabase-js';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountSection } from '@/features/auth/components/AccountSection';

const mockUseAuth = jest.fn();

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AccountSection', () => {
  it('shows the account and prevents duplicate logout while the request succeeds', async () => {
    const logout = createDeferred();
    const signOut = jest.fn(() => logout.promise);
    mockUseAuth.mockReturnValue({ session: testSession, signOut });
    const screen = await render(<AccountSection />);

    expect(screen.getByLabelText('ログイン中のメールアドレス planner@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'ログアウトする' }));

    const pendingButton = await screen.findByRole('button', { name: 'ログアウト処理中' });
    expect(pendingButton.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(pendingButton);
    expect(signOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      logout.resolve();
      await logout.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウトする' })).toBeTruthy();
    });
  });

  it('shows a safe error when logout fails', async () => {
    const signOut = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    mockUseAuth.mockReturnValue({ session: testSession, signOut });
    const screen = await render(<AccountSection />);

    await fireEvent.press(screen.getByRole('button', { name: 'ログアウトする' }));

    expect(
      await screen.findByText('認証サービスに接続できません。通信状況を確認してください。'),
    ).toBeTruthy();
  });
});
