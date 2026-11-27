import { fireEvent, render } from '@testing-library/react-native';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import type { UpdateProfilePlanningSettingsInput } from '@/features/settings/repositories/SettingsRepository';
import { DEMO_SETTINGS } from '@/services/demo/sampleData';

it('keeps non-preset IANA values and saves a city choice only through the unified save', async () => {
  const repository = {
    getProfilePlanningSettings: jest.fn(async () => ({
      ...DEMO_SETTINGS,
      timezone: 'Pacific/Chatham',
      taskGapMinutes: 30,
    })),
    updateProfilePlanningSettings: jest.fn(
      async (input: UpdateProfilePlanningSettingsInput) => input,
    ),
  };
  const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  await screen.findByDisplayValue('Pacific/Chatham');
  expect(screen.getByRole('button', { name: '都市から選ぶ、Pacific/Chatham' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '都市から選ぶ、Pacific/Chatham' }));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByDisplayValue('Pacific/Chatham')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'プロフィール設定を保存する' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '都市から選ぶ、Pacific/Chatham' }));
  await fireEvent.press(screen.getByRole('button', { name: 'ロンドン（Europe/London）' }));
  expect(repository.updateProfilePlanningSettings).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  expect(repository.updateProfilePlanningSettings).toHaveBeenCalledWith(
    expect.objectContaining({ timezone: 'Europe/London', taskGapMinutes: 30 }),
  );
});
