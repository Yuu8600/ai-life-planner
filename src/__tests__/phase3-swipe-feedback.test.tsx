import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  PanResponder,
  Text,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { SwipeActions, shouldCaptureSwipe } from '@/shared/components/SwipeActions';
import { successFeedback } from '@/services/haptics/successFeedback';
import { successFeedback as webFeedback } from '@/services/haptics/successFeedback.web';
import * as Haptics from 'expo-haptics';
import { SuccessFeedbackProvider } from '@/shared/feedback/SuccessFeedback';
import { usePlanningSettings } from '@/features/settings/usePlanningSettings';
import { ActionButton } from '@/shared/components/ActionButton';
import { DEMO_SETTINGS } from '@/services/demo/sampleData';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));

it.each([
  [80, 5, 100, true],
  [4, 90, 100, false],
  [80, 5, 10, false],
  [80, 5, 385, false],
])('captures only interior horizontal swipes (%s,%s,%s)', (dx, dy, x, expected) => {
  expect(shouldCaptureSwipe(dx, dy, x, 390)).toBe(expected);
});
it('reveals a destructive action without executing it and respects disabled rows', async () => {
  const spy = jest.spyOn(PanResponder, 'create');
  const remove = jest.fn();
  try {
    const screen = await render(
      <SwipeActions label="対象" onDelete={remove}>
        <Text>行</Text>
      </SwipeActions>,
    );
    await waitFor(() =>
      expect(
        spy.mock.calls
          .at(-1)?.[0]
          .onMoveShouldSetPanResponderCapture?.(
            { nativeEvent: { pageX: 100 } } as GestureResponderEvent,
            { dx: -100, dy: 1, x0: 0 } as PanResponderGestureState,
          ),
      ).toBe(true),
    );
    await act(() =>
      spy.mock.calls
        .at(-1)?.[0]
        .onPanResponderRelease?.(
          {} as GestureResponderEvent,
          { dx: -90 } as PanResponderGestureState,
        ),
    );
    expect(remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '対象をスワイプ操作で削除する' }));
    expect(remove).toHaveBeenCalledTimes(1);
    await screen.rerender(
      <SwipeActions label="対象" disabled onDelete={remove}>
        <Text>行</Text>
      </SwipeActions>,
    );
    await act(() =>
      spy.mock.calls
        .at(-1)?.[0]
        .onPanResponderRelease?.(
          {} as GestureResponderEvent,
          { dx: -90 } as PanResponderGestureState,
        ),
    );
    expect(screen.queryByRole('button', { name: '対象をスワイプ操作で削除する' })).toBeNull();
  } finally {
    spy.mockRestore();
  }
});
it('contains unsupported haptics failures and never vibrates on web', async () => {
  const notification = jest.mocked(Haptics.notificationAsync);
  notification.mockClear();
  notification.mockRejectedValueOnce(new Error('unavailable'));
  expect(() => successFeedback()).not.toThrow();
  await Promise.resolve();
  expect(notification).toHaveBeenCalledTimes(1);
  notification.mockImplementationOnce(() => {
    throw new Error('no native module');
  });
  expect(() => successFeedback()).not.toThrow();
  notification.mockClear();
  webFeedback();
  expect(notification).not.toHaveBeenCalled();
});
it('emits feedback once after a successful save and never after a failed save', async () => {
  const success = jest.fn();
  const update = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(DEMO_SETTINGS);
  const repository = {
    getProfilePlanningSettings: jest.fn(async () => DEMO_SETTINGS),
    updateProfilePlanningSettings: update,
  };
  function Probe() {
    const state = usePlanningSettings(repository);
    return (
      <>
        <Text>{state.settings ? 'ready' : 'loading'}</Text>
        <ActionButton label="保存" onPress={() => void state.save(DEMO_SETTINGS)} />
      </>
    );
  }
  const screen = await render(
    <SuccessFeedbackProvider onSuccess={success}>
      <Probe />
    </SuccessFeedbackProvider>,
  );
  await screen.findByText('ready');
  await fireEvent.press(screen.getByRole('button', { name: '保存' }));
  expect(success).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '保存' }));
  expect(success).toHaveBeenCalledTimes(1);
});
