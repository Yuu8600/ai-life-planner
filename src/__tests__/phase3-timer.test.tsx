import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, AppState, Platform } from 'react-native';
import { FocusTimerProvider, useFocusTimer } from '@/features/focus-timer';
import { ActionButton } from '@/shared/components/ActionButton';
import {
  formatRemaining,
  pauseTimer,
  remainingAt,
  resumeTimer,
  startTimer,
  type TimerTarget,
} from '@/features/focus-timer/timer';
const task: TimerTarget = { kind: 'task', id: 'task', title: '読む' };
function Launcher() {
  const timer = useFocusTimer();
  return (
    <>
      <ScreenHeader title="テスト画面" />
      <ActionButton label="タスクのタイマー" onPress={() => timer?.open(task)} />
      <ActionButton
        label="行動のタイマー"
        onPress={() => timer?.open({ kind: 'step', id: 'step', title: '一歩目' })}
      />
    </>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-28T00:00:00Z'));
});
afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

it('calculates elapsed time from deadlines and excludes paused time', () => {
  const timer = startTimer(task, '1', 1000);
  expect(remainingAt(timer, 11000)).toBe(50000);
  const paused = pauseTimer(timer, 11000);
  expect(remainingAt(paused, 91000)).toBe(50000);
  const resumed = resumeTimer(paused, 91000);
  expect(formatRemaining(remainingAt(resumed, 101000))).toBe('0:40');
  expect(remainingAt(resumed, 200000)).toBe(0);
  expect(() => startTimer(task, '0', 0)).toThrow();
  expect(() => startTimer(task, '181', 0)).toThrow();
});
it('starts, pauses, resumes, stays available after closing and ends only explicitly', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(
      <FocusTimerProvider>
        <Launcher />
      </FocusTimerProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'タスクのタイマー' }));
    await fireEvent.changeText(screen.getByLabelText('タイマーの作業時間'), '1');
    await fireEvent.press(screen.getByRole('button', { name: '開始' }));
    await act(() => jest.advanceTimersByTime(10000));
    expect(screen.getByLabelText('残り 0:50')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '一時停止' }));
    await act(() => jest.advanceTimersByTime(30000));
    expect(screen.getByLabelText('残り 0:50')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '再開' }));
    const dismiss = screen.getByTestId('focus-timer-modal-presentation').props.onDismiss;
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    expect(screen.queryByRole('button', { name: /作業タイマーを開く/ })).toBeNull();
    await act(() => dismiss());
    await act(() => jest.advanceTimersByTime(5000));
    await fireEvent.press(
      screen.getByRole('button', { name: /作業タイマーを開く、読む、残り 0:45/ }),
    );
    await fireEvent.press(screen.getByRole('button', { name: '終了' }));
    expect(screen.getByLabelText('残り 0:45')).toBeTruthy();
    await act(() =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((b) => b.text === '終了')
        ?.onPress?.(),
    );
    expect(screen.queryByText('作業タイマー')).toBeNull();
    await screen.unmount();
  } finally {
    alert.mockRestore();
  }
});
it('recalculates after background return and resets when the provider is destroyed', async () => {
  const events = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  events.mockClear();
  try {
    const screen = await render(
      <FocusTimerProvider>
        <Launcher />
      </FocusTimerProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: '行動のタイマー' }));
    await fireEvent.changeText(screen.getByLabelText('タイマーの作業時間'), '1');
    await fireEvent.press(screen.getByRole('button', { name: '開始' }));
    const onChange = events.mock.calls.find((c) => c[0] === 'change')?.[1];
    await act(() => onChange?.('background'));
    jest.setSystemTime(new Date('2026-11-28T00:02:00Z'));
    await act(() => onChange?.('active'));
    expect(screen.getByText('時間になりました。タスクは自動完了していません。')).toBeTruthy();
    expect(screen.getByLabelText('残り 0:00')).toBeTruthy();
    await screen.unmount();
    const fresh = await render(
      <FocusTimerProvider>
        <Launcher />
      </FocusTimerProvider>,
    );
    expect(fresh.queryByText('作業タイマー')).toBeNull();
    await fresh.unmount();
  } finally {
    events.mockRestore();
  }
});
it('protects edited duration on close and a running target on replacement', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(
      <FocusTimerProvider>
        <Launcher />
      </FocusTimerProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'タスクのタイマー' }));
    await fireEvent.changeText(screen.getByLabelText('タイマーの作業時間'), '0');
    await fireEvent.press(screen.getByRole('button', { name: '開始' }));
    expect(screen.getByText('1〜180分の整数で入力してください。')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('変更を破棄しますか？');
    await fireEvent.changeText(screen.getByLabelText('タイマーの作業時間'), '1');
    await fireEvent.press(screen.getByRole('button', { name: '開始' }));
    const dismiss = screen.getByTestId('focus-timer-modal-presentation').props.onDismiss;
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    await act(() => dismiss());
    await fireEvent.press(screen.getByRole('button', { name: '行動のタイマー' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('別の作業へ切り替えますか？');
    expect(screen.getByRole('button', { name: /作業タイマーを開く、読む/ })).toBeTruthy();
    await screen.unmount();
  } finally {
    alert.mockRestore();
  }
});

it.each(['android', 'web'] as const)(
  'keeps the timer accessible without onDismiss on %s',
  async (os) => {
    const original = Platform.OS;
    Platform.OS = os;
    try {
      const screen = await render(
        <FocusTimerProvider>
          <Launcher />
        </FocusTimerProvider>,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'タスクのタイマー' }));
      await fireEvent.press(screen.getByRole('button', { name: '開始' }));
      await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
      expect(screen.getByRole('button', { name: /作業タイマーを開く、読む/ })).toBeTruthy();
      await screen.unmount();
    } finally {
      Platform.OS = original;
    }
  },
);
