import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AccountPanel } from '@/features/auth/components/AccountPanel';
import { AuthLoadingScreen } from '@/features/auth/AuthLoadingScreen';
import { AppScreen } from '@/shared/components/AppScreen';
it.each([true, false])('supports a footer beside content with scrolling=%s', async (scroll) => {
  const screen = await render(
    <AppScreen scroll={scroll} footer={<Text>保存エリア</Text>}>
      <Text>入力内容</Text>
    </AppScreen>,
  );
  expect(screen.getByText('保存エリア')).toBeTruthy();
  expect(screen.getByText('入力内容')).toBeTruthy();
});
it('displays a long email without replacing it and keeps logout errors visible', async () => {
  const email = 'planner.long.address.for.responsive.testing@example.test';
  const signOut = jest.fn(async () => {
    throw new Error('Network request failed');
  });
  const screen = await render(<AccountPanel email={email} signOut={signOut} />);
  expect(screen.getByLabelText('ログイン中のメールアドレス ' + email)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'ログアウトする' }));
  await screen.findByText('認証サービスに接続できません。通信状況を確認してください。');
  expect(signOut).toHaveBeenCalledTimes(1);
});
it('preserves the authenticated fallback when an email is unavailable', async () => {
  const screen = await render(<AccountPanel signOut={jest.fn(async () => {})} />);
  expect(screen.getByLabelText('ログイン中のメールアドレス 不明')).toBeTruthy();
  expect(screen.getByText('認証済みユーザー')).toBeTruthy();
});
it('keeps a readable restoration state without adding auth operations', async () => {
  const screen = await render(<AuthLoadingScreen />);
  expect(screen.getByTestId('auth-loading-screen')).toBeTruthy();
  expect(screen.getByLabelText('認証状態を確認中')).toBeTruthy();
  expect(screen.getByText('アプリを準備しています…')).toBeTruthy();
});
