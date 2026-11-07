import { fireEvent, render } from '@testing-library/react-native';
import { TimeSelectionRow } from '@/shared/components/timeSelection/TimeSelectionRow';
import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DEMO_SETTINGS } from '@/services/demo/sampleData';

it('keeps an exact non-quarter minute when changing hours and commits only on confirmation', async () => {
  const change = jest.fn();
  const screen = await render(
    <TimeSelectionRow label="活動終了時間" value="23:59" dayOffset="0" onChange={change} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '活動終了時間、23:59' }));
  expect(screen.getByRole('button', { name: '分 59' }).props.accessibilityState.selected).toBe(
    true,
  );
  await fireEvent.press(screen.getByRole('button', { name: '時 02' }));
  await fireEvent.press(screen.getByRole('button', { name: '翌日' }));
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(change).toHaveBeenCalledWith('02:59', '1');
});
it('cancels time changes and supports selecting exact minutes without typing', async () => {
  const change = jest.fn();
  const screen = await render(<TimeSelectionRow label="時刻" value="08:10" onChange={change} />);
  await fireEvent.press(screen.getByRole('button', { name: '時刻、08:10' }));
  await fireEvent.press(screen.getByRole('button', { name: '時 09' }));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '時刻、08:10' }));
  expect(screen.getByRole('button', { name: '時 08' }).props.accessibilityState.selected).toBe(
    true,
  );
  await fireEvent.press(screen.getByRole('button', { name: '1分単位で選ぶ' }));
  await fireEvent.press(screen.getByRole('button', { name: '分 11' }));
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(change).toHaveBeenCalledWith('08:11', undefined);
});
it.each(['0', '240'])('accepts buffer boundary %s via Other', async (value) => {
  const change = jest.fn();
  const screen = await render(
    <DurationSelectionRow label="余白" value="17" buffer onChange={change} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '余白、17分' }));
  expect(screen.getByLabelText('余白の詳細（分）').props.value).toBe('17');
  await fireEvent.changeText(screen.getByLabelText('余白の詳細（分）'), value);
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(change).toHaveBeenCalledWith(value);
});
it.each(['-1', '241', '1.5', 'abc', ''])('rejects invalid custom buffers %s', async (value) => {
  const change = jest.fn();
  const screen = await render(
    <DurationSelectionRow label="余白" value="17" buffer onChange={change} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '余白、17分' }));
  await fireEvent.changeText(screen.getByLabelText('余白の詳細（分）'), value);
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});
it('supports presets, cancels duration drafts, and respects disabled rows', async () => {
  const change = jest.fn();
  const screen = await render(<DurationSelectionRow label="最小" value="7" onChange={change} />);
  await fireEvent.press(screen.getByRole('button', { name: '最小、7分' }));
  await fireEvent.press(screen.getByRole('button', { name: '30分' }));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(change).not.toHaveBeenCalled();
  await screen.rerender(<DurationSelectionRow label="最小" value="7" disabled onChange={change} />);
  await fireEvent.press(screen.getByRole('button', { name: '最小、7分' }));
  expect(screen.queryByText('決定')).toBeNull();
});
it('resaves legacy exact clock, minimum and buffers unchanged without opening a keyboard', async () => {
  const original = {
    ...DEMO_SETTINGS,
    planningStart: '08:10',
    planningEnd: '23:59',
    minimumFreeMinutes: 7,
    calendarBufferBeforeMinutes: 17,
    calendarBufferAfterMinutes: 29,
  };
  const save = jest.fn(async () => original);
  const screen = await render(
    <SettingsScreen
      onPressBack={() => {}}
      repository={{
        getProfilePlanningSettings: async () => original,
        updateProfilePlanningSettings: save,
      }}
    />,
  );
  expect(await screen.findByRole('button', { name: '活動開始時間、08:10' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '活動終了時間、23:59' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '最小空き時間、7分' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '予定前の余白時間、17分' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  expect(save).toHaveBeenCalledWith(original);
});
