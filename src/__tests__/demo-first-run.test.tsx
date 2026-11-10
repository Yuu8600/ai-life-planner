import { act, fireEvent, render } from '@testing-library/react-native';

import { DemoBanner } from '@/features/demo/DemoBanner';
import { DemoProvider } from '@/features/demo/DemoProvider';
import { DemoWelcomeScreen } from '@/features/demo/DemoWelcomeScreen';
import { appAlert } from '@/shared/feedback/appAlert';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockClear());

it('offers direct planning first and a separate route to explore tasks', async () => {
  const screen = await render(<DemoWelcomeScreen />);
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(2);
  expect(screen.getByText('ログイン不要。サンプルですぐに試せます。')).toBeTruthy();
  expect(screen.getByText(/再読み込みやリセットで初期状態/)).toBeTruthy();

  expect(buttons[0]).toBe(screen.getByRole('button', { name: 'サンプルで計画を作ってみる' }));
  await fireEvent.press(buttons[0]);
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを見てから始める' }));
  expect(mockPush.mock.calls).toEqual([['/ai'], ['/tasks']]);
});

it('keeps clock and reset optional and preserves all demo controls', async () => {
  const alert = jest.spyOn(appAlert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(
      <DemoProvider>
        <DemoBanner />
      </DemoProvider>,
    );
    expect(screen.getByText('デモ時計（実際の時刻と別）')).toBeTruthy();
    expect(screen.getByText(/08:00（東京）/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'デモをリセット' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '時計・リセット', expanded: false }));
    expect(
      screen.getByRole('button', { name: '時計・リセットを閉じる', expanded: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '時計を15:00に進める' }));
    expect(screen.getByText(/15:00（東京）/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '時計を翌日01:00に進める' }));
    expect(screen.getByText(/01:00（東京）/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'デモをリセット' }));
    expect(screen.getByText(/01:00（東京）/)).toBeTruthy();
    await act(() => alert.mock.calls[0][2]?.[1]?.onPress?.());
    expect(screen.getByText(/08:00（東京）/)).toBeTruthy();
  } finally {
    alert.mockRestore();
  }
});
