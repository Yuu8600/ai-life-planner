import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { clearLightPalette as c, clearLightTheme, ThemeProvider } from '@/shared/theme';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
}

describe('Clear accessibility and shared controls', () => {
  it.each([
    [c.textPrimary, c.background],
    [c.textPrimary, c.surface],
    [c.textSecondary, c.background],
    [c.textPlaceholder, c.surface],
    [c.onPrimary, c.primary],
    [c.onPrimary, c.primaryPressed],
    [c.primary, c.primarySoft],
    [c.success, c.successSoft],
    [c.warning, c.warningSoft],
    [c.error, c.errorSoft],
    [c.onError, c.error],
    [c.onError, c.errorPressed],
    [c.calendar, c.calendarSoft],
    [c.action, c.actionSoft],
    [c.available, c.availableSoft],
    [c.disabledText, c.disabledSurface],
  ])('keeps normal text contrast >= 4.5:1 (%s on %s)', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([c.borderControl, c.focusRing, c.availableBorder, c.nowIndicator])(
    'keeps controls/indicators distinguishable from the surface (%s)',
    (fg) => {
      expect(contrast(fg, c.surface)).toBeGreaterThanOrEqual(3);
    },
  );
  it('blocks repeat presses while loading and keeps the accessible action name', async () => {
    const onPress = jest.fn();
    const screen = await render(<ActionButton label="保存" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: '保存' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    await screen.rerender(<ActionButton label="保存" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: '保存' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('supports destructive/disabled controls and a theme override without changing behavior', async () => {
    const onPress = jest.fn();
    const theme = { ...clearLightTheme, colors: { ...c, error: '#990000' } };
    const screen = await render(
      <ThemeProvider theme={theme}>
        <ActionButton label="削除" variant="destructive" onPress={onPress} />
        <ActionButton label="無効" disabled onPress={onPress} />
      </ThemeProvider>,
    );
    expect(
      StyleSheet.flatten(screen.getByRole('button', { name: '削除' }).props.style).backgroundColor,
    ).toBe('#990000');
    await fireEvent.press(screen.getByRole('button', { name: '無効' }));
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '削除' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('connects input labels/errors and preserves focus and editing callbacks', async () => {
    const onChangeText = jest.fn(),
      onFocus = jest.fn(),
      onBlur = jest.fn();
    const screen = await render(
      <FormField label="所要時間" helper="分単位" error="整数で入力してください">
        <FormInput value="12.5" onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur} />
      </FormField>,
    );
    const input = screen.getByLabelText('所要時間');
    expect(input.props.accessibilityHint).toContain('整数で入力してください');
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(c.error);
    expect(screen.getByRole('alert').props.children).toBe('整数で入力してください');
    await fireEvent.changeText(input, '15');
    await fireEvent(input, 'focus', {});
    await fireEvent(input, 'blur', {});
    expect(onChangeText).toHaveBeenCalledWith('15');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(input.props.value).toBe('12.5');
  });
  it('announces errors and keeps a notice recovery action operable', async () => {
    const retry = jest.fn();
    const screen = await render(
      <Notice
        tone="error"
        title="保存できませんでした"
        message="もう一度お試しください"
        action={<ActionButton label="再試行" onPress={retry} />}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('もう一度お試しください')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '再試行' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('exposes selection state and prevents changes when disabled', async () => {
    const onChange = jest.fn();
    const props = {
      label: '優先度',
      selectedValue: 'high',
      onChange,
      options: [
        { label: '高', value: 'high' },
        { label: '低', value: 'low' },
      ],
    };
    const screen = await render(<OptionGroup {...props} disabled={false} />);
    expect(screen.getByRole('radio', { name: '優先度 高' }).props.accessibilityState.checked).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '優先度 低' }));
    expect(onChange).toHaveBeenLastCalledWith('low');
    await screen.rerender(<OptionGroup {...props} disabled />);
    await fireEvent.press(screen.getByRole('radio', { name: '優先度 高' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('guards modal close requests during submission and retains its body/footer', async () => {
    const onClose = jest.fn();
    const props = {
      testID: 'edit-modal',
      title: 'タスクを編集',
      onClose,
      closeLabel: '編集を閉じる',
      footer: <ActionButton label="保存" loading />,
      children: <Text>未保存の内容</Text>,
    };
    const screen = await render(<ModalFrame {...props} closeDisabled />);
    await fireEvent.press(screen.getByRole('button', { name: '編集を閉じる' }));
    await fireEvent(screen.getByTestId('edit-modal-presentation'), 'requestClose');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('未保存の内容')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState.busy).toBe(true);
    await screen.rerender(<ModalFrame {...props} closeDisabled={false} />);
    await fireEvent(screen.getByTestId('edit-modal-presentation'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
