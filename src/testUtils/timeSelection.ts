import { fireEvent, type RenderResult } from '@testing-library/react-native';
export async function selectTime(
  screen: RenderResult,
  label: string,
  value: string,
  offset?: string,
) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${label}、`) }));
  const [h, m] = value.split(':');
  await fireEvent.press(screen.getByRole('button', { name: `時 ${h}` }));
  if (!['00', '15', '30', '45'].includes(m))
    await fireEvent.press(screen.getByRole('button', { name: '1分単位で選ぶ' }));
  await fireEvent.press(screen.getByRole('button', { name: `分 ${m}` }));
  if (offset !== undefined)
    await fireEvent.press(
      screen.getByRole('button', { name: offset === '1' ? /^(✓ )?翌日$/ : /^(✓ )?当日$/ }),
    );
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
}
export async function selectDuration(
  screen: RenderResult,
  label: string,
  value: string,
  confirm = true,
) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${label}、`) }));
  await fireEvent.press(screen.getByRole('button', { name: /^(✓ )?その他$/ }));
  await fireEvent.changeText(screen.getByLabelText(`${label}の詳細（分）`), value);
  if (confirm) await fireEvent.press(screen.getByRole('button', { name: '決定' }));
}
