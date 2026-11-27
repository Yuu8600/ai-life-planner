import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';
import { FormInput } from '@/shared/components/FormField';

it('dismisses a numeric keyboard without submitting or changing input', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const submit = jest.fn(),
    change = jest.fn();
  const original = Platform.OS;
  Platform.OS = 'ios';
  try {
    const screen = await render(
      <FormInput
        keyboardType="number-pad"
        value="15"
        onChangeText={change}
        onSubmitEditing={submit}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '完了、キーボードを閉じる' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  } finally {
    Platform.OS = original;
    dismiss.mockRestore();
  }
});
it('retains multiline newlines and allows existing custom keyboard controls', async () => {
  const original = Platform.OS;
  Platform.OS = 'ios';
  try {
    const screen = await render(
      <FormInput multiline value={'一行目\n二行目'} accessibilityLabel="本文" />,
    );
    expect(screen.getByLabelText('本文').props.value).toBe('一行目\n二行目');
    expect(screen.getByRole('button', { name: '完了、キーボードを閉じる' })).toBeTruthy();
    await screen.rerender(<FormInput multiline keyboardDismissAccessory={false} />);
    expect(screen.queryByRole('button', { name: '完了、キーボードを閉じる' })).toBeNull();
  } finally {
    Platform.OS = original;
  }
});
