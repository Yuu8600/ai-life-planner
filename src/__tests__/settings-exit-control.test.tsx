import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { NavigationAction } from 'expo-router/react-navigation';

import { SettingsExitControl } from '@/navigation/SettingsExitControl';

const mockDispatch = jest.fn();
const mockPreventRemove = jest.fn(
  (_prevent: boolean, _callback: (event: { data: { action: NavigationAction } }) => void) => {},
);

jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (...args: Parameters<typeof mockPreventRemove>) => mockPreventRemove(...args),
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('cancels repeated removal attempts and resumes only the action the user approved', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const back = jest.fn();
  await render(<SettingsExitControl dirty isSaving={false} onPressBack={back} />);
  const [prevent, request] = mockPreventRemove.mock.lastCall!;
  expect(prevent).toBe(true);
  const action = { type: 'POP', target: 'settings-stack' };
  await act(async () => {
    request({ data: { action } });
    request({ data: { action: { type: 'GO_BACK' } } });
  });
  expect(alert).toHaveBeenCalledTimes(1);
  alert.mock.calls[0][2]?.[0].onPress?.();
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(async () => request({ data: { action } }));
  const approve = alert.mock.calls[1][2]?.[1].onPress;
  approve?.();
  approve?.();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(action);
  expect(back).not.toHaveBeenCalled();
});

it('blocks system removal and the close button while saving, then allows a clean close', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const back = jest.fn();
  const screen = await render(<SettingsExitControl dirty={false} isSaving onPressBack={back} />);
  const [prevent, request] = mockPreventRemove.mock.lastCall!;
  expect(prevent).toBe(true);
  await act(async () => request({ data: { action: { type: 'GO_BACK' } } }));
  await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(back).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();

  await screen.rerender(<SettingsExitControl dirty={false} isSaving={false} onPressBack={back} />);
  expect(mockPreventRemove.mock.lastCall?.[0]).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
  expect(back).toHaveBeenCalledTimes(1);
});
