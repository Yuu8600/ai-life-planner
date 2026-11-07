import { selectTime, selectDuration } from '@/testUtils/timeSelection';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  ProfilePlanningSettings,
  SettingsRepository,
  UpdateProfilePlanningSettingsInput,
} from '@/features/settings/repositories/SettingsRepository';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

jest.mock('@/features/auth', () => ({
  AccountSection: () => null,
}));

const settings: ProfilePlanningSettings = {
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
  minimumFreeMinutes: 20,
  planningEnd: '23:00',
  planningEndDayOffset: 0 as const,
  planningStart: '08:00',
  timezone: 'Asia/Tokyo',
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createRepository(overrides: Partial<jest.Mocked<SettingsRepository>> = {}) {
  return {
    getProfilePlanningSettings: jest.fn(async () => settings),
    updateProfilePlanningSettings: jest.fn(async (input) => input),
    ...overrides,
  } as jest.Mocked<SettingsRepository>;
}

describe('SettingsScreen', () => {
  it('shows initial loading and then the current profile settings', async () => {
    const deferred = createDeferred<ProfilePlanningSettings>();
    const repository = createRepository({
      getProfilePlanningSettings: jest.fn(() => deferred.promise),
    });
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    expect(screen.getByTestId('settings-loading-state')).toBeTruthy();

    await act(async () => {
      deferred.resolve(settings);
      await deferred.promise;
    });
    expect(await screen.findByDisplayValue('Asia/Tokyo')).toBeTruthy();
    expect(screen.getByRole('button', { name: '活動開始時間、08:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '活動終了時間、23:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '最小空き時間、20分' })).toBeTruthy();
  });

  it('loads the saved profile values again when Settings is reopened', async () => {
    const savedSettings = {
      ...settings,
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      minimumFreeMinutes: 45,
      planningEnd: '21:30',
      planningEndDayOffset: 0 as const,
      planningStart: '09:00',
    };
    const getProfilePlanningSettings = jest
      .fn<
        ReturnType<SettingsRepository['getProfilePlanningSettings']>,
        Parameters<SettingsRepository['getProfilePlanningSettings']>
      >()
      .mockResolvedValueOnce(settings)
      .mockResolvedValueOnce(savedSettings);
    const repository = createRepository({ getProfilePlanningSettings });
    const firstScreen = await render(
      <SettingsScreen onPressBack={jest.fn()} repository={repository} />,
    );

    expect(await firstScreen.findByRole('button', { name: '活動開始時間、08:00' })).toBeTruthy();
    await firstScreen.unmount();

    const reopenedScreen = await render(
      <SettingsScreen onPressBack={jest.fn()} repository={repository} />,
    );
    expect(await reopenedScreen.findByRole('button', { name: '活動開始時間、09:00' })).toBeTruthy();
    expect(reopenedScreen.getByRole('button', { name: '活動終了時間、21:30' })).toBeTruthy();
    expect(reopenedScreen.getByRole('button', { name: '最小空き時間、45分' })).toBeTruthy();
    expect(getProfilePlanningSettings).toHaveBeenCalledTimes(2);
  });

  it('shows a safe load error and retries the profile request', async () => {
    const getProfilePlanningSettings = jest
      .fn<
        ReturnType<SettingsRepository['getProfilePlanningSettings']>,
        Parameters<SettingsRepository['getProfilePlanningSettings']>
      >()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(settings);
    const repository = createRepository({ getProfilePlanningSettings });
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    expect(
      await screen.findByText(
        'プロフィール設定に接続できません。通信状況を確認して再度お試しください。',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));
    expect(await screen.findByDisplayValue('Asia/Tokyo')).toBeTruthy();
    expect(getProfilePlanningSettings).toHaveBeenCalledTimes(2);
  });

  it('edits, saves, and synchronizes the form with the returned profile row', async () => {
    const returnedSettings = {
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      minimumFreeMinutes: 46,
      planningEnd: '21:30',
      planningEndDayOffset: 0 as const,
      planningStart: '09:00',
      timezone: 'America/New_York',
    };
    const updateProfilePlanningSettings = jest.fn(
      async (_input: UpdateProfilePlanningSettingsInput) => returnedSettings,
    );
    const repository = createRepository({ updateProfilePlanningSettings });
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    await screen.findByDisplayValue('Asia/Tokyo');
    await fireEvent.changeText(screen.getByLabelText('タイムゾーン'), 'America/New_York');
    await selectTime(screen, '活動開始時間', '09:00');
    await selectTime(screen, '活動終了時間', '21:30');
    await selectDuration(screen, '最小空き時間', '45');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));

    expect(updateProfilePlanningSettings).toHaveBeenCalledWith({
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      minimumFreeMinutes: 45,
      planningEnd: '21:30',
      planningEndDayOffset: 0 as const,
      planningStart: '09:00',
      timezone: 'America/New_York',
    });
    expect(await screen.findByText('設定を保存しました。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '最小空き時間、46分' })).toBeTruthy();
  });

  it('prevents duplicate saves while Supabase is pending', async () => {
    const deferred = createDeferred<ProfilePlanningSettings>();
    const updateProfilePlanningSettings = jest.fn(
      (_input: UpdateProfilePlanningSettingsInput) => deferred.promise,
    );
    const repository = createRepository({ updateProfilePlanningSettings });
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    await screen.findByDisplayValue('Asia/Tokyo');
    const saveButton = screen.getByRole('button', { name: 'プロフィール設定を保存する' });
    await fireEvent.press(saveButton);
    await fireEvent.press(saveButton);

    expect(updateProfilePlanningSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'プロフィール設定を保存中' })).toBeTruthy();

    await act(async () => {
      deferred.resolve(settings);
      await deferred.promise;
    });
  });

  it('rejects invalid values before calling Supabase', async () => {
    const repository = createRepository();
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    await screen.findByDisplayValue('Asia/Tokyo');
    await fireEvent.changeText(screen.getByLabelText('タイムゾーン'), 'Mars/Olympus');
    await selectTime(screen, '活動開始時間', '22:00');
    await selectTime(screen, '活動終了時間', '08:00');
    await selectDuration(screen, '最小空き時間', '0');
    expect(screen.getByText('1以上の整数で入力してください。')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));

    expect(
      await screen.findByText('有効なIANAタイムゾーンを入力してください（例: Asia/Tokyo）。'),
    ).toBeTruthy();
    expect(screen.getByText('終了時刻は開始時刻より後にしてください。')).toBeTruthy();
    expect(repository.updateProfilePlanningSettings).not.toHaveBeenCalled();
  });

  it('keeps edited values and shows a safe error when saving fails', async () => {
    const updateProfilePlanningSettings = jest.fn(
      async (_input: UpdateProfilePlanningSettingsInput) => {
        throw new Error('Network request failed');
      },
    );
    const repository = createRepository({ updateProfilePlanningSettings });
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    await screen.findByDisplayValue('Asia/Tokyo');
    await selectDuration(screen, '最小空き時間', '45');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));

    expect(
      await screen.findByText(
        'プロフィール設定に接続できません。通信状況を確認して再度お試しください。',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '最小空き時間、45分' })).toBeTruthy();
  });

  it('does not expose the form without an authenticated repository', async () => {
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={null} />);

    expect(
      await screen.findByText('プロフィール設定を表示するにはログインが必要です。'),
    ).toBeTruthy();
    expect(screen.queryByTestId('planning-settings-form')).toBeNull();
  });

  it('keeps save success visible until the next edit', async () => {
    const repository = createRepository();
    const screen = await render(<SettingsScreen onPressBack={jest.fn()} repository={repository} />);

    await screen.findByDisplayValue('Asia/Tokyo');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
    expect(await screen.findByText('設定を保存しました。')).toBeTruthy();

    await selectDuration(screen, '最小空き時間', '21');
    await waitFor(() => expect(screen.queryByText('設定を保存しました。')).toBeNull());
  });
});

it('saves selected buffer durations and restores them on reopen', async () => {
  let current = settings;
  const repository = createRepository({
    getProfilePlanningSettings: jest.fn(async () => current),
    updateProfilePlanningSettings: jest.fn(async (input) => {
      current = input;
      return input;
    }),
  });
  const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  await selectDuration(screen, '予定前の余白時間', '90');
  await selectDuration(screen, '予定後の余白時間', '15');
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  await screen.findByText('設定を保存しました。');
  expect(current.calendarBufferBeforeMinutes).toBe(90);
  expect(current.calendarBufferAfterMinutes).toBe(15);
  await screen.unmount();
  const reopened = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  expect(await reopened.findByRole('button', { name: '予定前の余白時間、90分' })).toBeTruthy();
  expect(reopened.getByRole('button', { name: '予定後の余白時間、15分' })).toBeTruthy();
});

it('saves and reloads next-day end without rounding HH:mm values', async () => {
  let current = settings;
  const repository = createRepository({
    getProfilePlanningSettings: jest.fn(async () => current),
    updateProfilePlanningSettings: jest.fn(async (input) => {
      current = input;
      return input;
    }),
  });
  const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  await screen.findByRole('button', { name: /^活動終了時間、/ });
  await selectTime(screen, '活動開始時間', '09:17');
  await selectTime(screen, '活動終了時間', '02:00', '1');
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  await screen.findByText('設定を保存しました。');
  expect(current.planningEndDayOffset).toBe(1);
  expect(current.planningStart).toBe('09:17');
  expect(current.planningEnd).toBe('02:00');
  await screen.unmount();
  const reopened = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  expect(await reopened.findByRole('button', { name: '活動終了時間、翌日 02:00' })).toBeTruthy();
});
