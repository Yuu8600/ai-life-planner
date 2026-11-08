import type { User } from '@supabase/supabase-js';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthForm } from '@/features/auth/components/AuthForm';
import type { SignUpResult } from '@/services/supabase/auth';

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

const testUser = {
  email: 'planner@example.com',
  id: '11111111-1111-4111-8111-111111111111',
} as User;

function createDefaultProps() {
  return {
    onSignIn: jest.fn(async (): Promise<void> => undefined),
    onSignUp: jest.fn(async (): Promise<SignUpResult> => ({ session: null, user: testUser })),
  };
}

describe('AuthForm', () => {
  it('submits login credentials after trimming the email', async () => {
    const props = createDefaultProps();
    const screen = await render(<AuthForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), '  planner@example.com  ');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'ログインする' }));

    await waitFor(() => {
      expect(props.onSignIn).toHaveBeenCalledWith({
        email: 'planner@example.com',
        password: 'password123',
      });
    });
    expect(props.onSignUp).not.toHaveBeenCalled();
  });

  it('switches to signup and explains when email confirmation leaves the session null', async () => {
    const props = createDefaultProps();
    const screen = await render(<AuthForm {...props} />);

    await fireEvent.press(screen.getByLabelText('新規登録に切り替える'));
    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'planner@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'アカウントを作成する' }));

    await waitFor(() => {
      expect(props.onSignUp).toHaveBeenCalledWith({
        email: 'planner@example.com',
        password: 'password123',
      });
    });
    expect(
      await screen.findByText(
        '確認メールを送信しました。メール内のリンクを開いてからログインしてください。',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('パスワード').props.value).toBe('');
  });

  it('disables input and duplicate submission while login is pending', async () => {
    const login = createDeferred<void>();
    const props = createDefaultProps();
    props.onSignIn.mockImplementation(() => login.promise);
    const screen = await render(<AuthForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'planner@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'ログインする' }));

    const pendingButton = await screen.findByRole('button', { name: 'ログイン中…' });
    expect(pendingButton.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(screen.getByLabelText('メールアドレス').props.editable).toBe(false);
    expect(screen.getByLabelText('パスワード').props.editable).toBe(false);

    await fireEvent.press(pendingButton);
    expect(props.onSignIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      login.resolve(undefined);
      await login.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログインする' })).toBeTruthy();
    });
  });

  it('shows a safe Japanese message for invalid login credentials', async () => {
    const props = createDefaultProps();
    props.onSignIn.mockRejectedValue(new Error('Invalid login credentials'));
    const screen = await render(<AuthForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'planner@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'ログインする' }));

    expect(
      await screen.findByText('メールアドレスまたはパスワードが正しくありません。'),
    ).toBeTruthy();
  });
});
