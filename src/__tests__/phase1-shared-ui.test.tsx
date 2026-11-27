import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, Keyboard, Text, type KeyboardEvent } from 'react-native';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { DeadlineField } from '@/shared/components/DeadlineField';

jest.mock('@/shared/components/DeadlineCalendar', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DeadlineCalendar: ({ onChange }: { onChange: (value: string) => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="カレンダーで翌日を選ぶ"
        onPress={() => onChange('2026-11-28')}
      >
        <Text>翌日</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

it('keeps the header and footer outside the scrolling body during keyboard changes', async () => {
  const back = jest.fn();
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  const event: KeyboardEvent = {
    duration: 250,
    easing: 'keyboard',
    endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 300 },
  };
  const addListener = Keyboard.addListener.bind(Keyboard);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    listeners.set(event, listener);
    return addListener(event, listener);
  });
  const screen = await render(
    <AppScreen
      header={<ScreenHeader title="相談" backAction={{ label: '会話一覧', onPress: back }} />}
      footer={<Text>送信欄</Text>}
    >
      <Text>長い会話</Text>
    </AppScreen>,
  );
  const tree = screen.toJSON();
  const body = tree?.children.find(
    (child) => typeof child !== 'string' && child.type === 'RCTScrollView',
  );
  expect(body).toBeDefined();
  expect(JSON.stringify(body)).not.toContain('相談');
  expect(JSON.stringify(body)).not.toContain('送信欄');
  expect(JSON.stringify(body)).toContain('長い会話');
  await act(() => listeners.get('keyboardWillShow')?.(event));
  await fireEvent.press(screen.getByRole('button', { name: '会話一覧' }));
  expect(back).toHaveBeenCalledTimes(1);
  expect(screen.getByText('送信欄')).toBeTruthy();
  await act(() => listeners.get('keyboardWillHide')?.(event));
});

it('keeps presentation stable and guards close buttons, system requests and accessibility escape', async () => {
  const close = jest.fn();
  const props = { title: '編集', onClose: close, testID: 'editor', closeLabel: '閉じる' };
  const screen = await render(
    <ModalFrame {...props}>
      <Text>フォーム</Text>
    </ModalFrame>,
  );
  const presentation = screen.getByTestId('editor-presentation').props.presentationStyle;
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
  close.mockClear();
  await screen.rerender(
    <ModalFrame {...props} dirty>
      <Text>フォーム</Text>
    </ModalFrame>,
  );
  expect(screen.getByTestId('editor-presentation').props.presentationStyle).toBe(presentation);
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(close).not.toHaveBeenCalled();
  const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(() => actions?.find((action) => action.style === 'cancel')?.onPress?.());
  expect(close).not.toHaveBeenCalled();
  await act(() => screen.getByTestId('editor-presentation').props.onRequestClose());
  await fireEvent(screen.getByTestId('editor'), 'accessibilityEscape');
  expect(Alert.alert).toHaveBeenCalledTimes(3);
  await act(() => actions?.find((action) => action.style === 'destructive')?.onPress?.());
  expect(close).toHaveBeenCalledTimes(1);
  await screen.rerender(
    <ModalFrame {...props} dirty closeDisabled>
      <Text>フォーム</Text>
    </ModalFrame>,
  );
  await act(() => screen.getByTestId('editor-presentation').props.onRequestClose());
  expect(Alert.alert).toHaveBeenCalledTimes(3);
});

it('separates required dates from optional deadlines and commits only after confirmation', async () => {
  const change = jest.fn();
  const props = {
    accessibilityLabel: '対象日',
    label: '対象日',
    value: '2026-11-27',
    disabled: false,
    onChange: change,
  };
  const screen = await render(<DeadlineField {...props} allowClear={false} />);
  await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、2026年11月27日' }));
  expect(screen.queryByRole('button', { name: '期限なし' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'カレンダーで翌日を選ぶ' }));
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(change).not.toHaveBeenCalled();
  await screen.rerender(<DeadlineField {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、2026年11月27日' }));
  await fireEvent.press(screen.getByRole('button', { name: '期限なし' }));
  expect(change).toHaveBeenCalledWith('');
});
