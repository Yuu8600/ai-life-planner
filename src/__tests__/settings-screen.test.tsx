import { useEffect } from 'react';
import { Text } from 'react-native';
import { Alert, type AlertButton } from 'react-native';
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

describe('Clear Settings save and close controls', () => {
  afterEach(() => jest.restoreAllMocks());
  it('groups existing settings by purpose and keeps one save action', async () => {
    const repository = createRepository();
    const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
    await screen.findByTestId('settings-save-area');
    for (const title of ['活動時間', '空き時間・予定の余白', '地域・時間帯'])
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'プロフィール設定を保存する' })).toHaveLength(1);
    expect(repository.updateProfilePlanningSettings).not.toHaveBeenCalled();
  });
  it('asks before discarding a draft, supports cancellation and discards only on explicit confirmation', async () => {
    const close = jest.fn(),
      repository = createRepository();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = await render(<SettingsScreen repository={repository} onPressBack={close} />);
    await screen.findByTestId('settings-save-area');
    await selectTime(screen, '活動開始時間', '08:10');
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.style === 'cancel')?.onPress?.();
    expect(screen.getByRole('button', { name: '活動開始時間、08:10' })).toBeTruthy();
    expect(repository.updateProfilePlanningSettings).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(alert).toHaveBeenCalledTimes(2);
    const retryButtons = alert.mock.calls[1][2] as AlertButton[];
    const discard = retryButtons.find((button) => button.style === 'destructive')?.onPress;
    discard?.();
    discard?.();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('closes without a warning after reverting the draft or successfully saving unchanged normalized values', async () => {
    const close = jest.fn(),
      alert = jest.spyOn(Alert, 'alert'),
      repository = createRepository();
    const screen = await render(<SettingsScreen repository={repository} onPressBack={close} />);
    await screen.findByDisplayValue('Asia/Tokyo');
    await selectTime(screen, '活動開始時間', '08:10');
    await selectTime(screen, '活動開始時間', '08:00');
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('タイムゾーン'), ' Asia/Tokyo ');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
    await screen.findByText('設定を保存しました。');
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(close).toHaveBeenCalledTimes(2);
    expect(alert).not.toHaveBeenCalled();
  });
  it('blocks close while saving and completes the save before showing success', async () => {
    const pending = createDeferred<ProfilePlanningSettings>();
    const close = jest.fn();
    const repository = createRepository({
      updateProfilePlanningSettings: jest.fn(
        (_input: UpdateProfilePlanningSettingsInput) => pending.promise,
      ),
    });
    const screen = await render(<SettingsScreen repository={repository} onPressBack={close} />);
    await screen.findByDisplayValue('Asia/Tokyo');
    await selectTime(screen, '活動開始時間', '08:10');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
    const back = screen.getByRole('button', { name: '設定を閉じる' });
    expect(back.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(back);
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve({ ...settings, planningStart: '08:10' });
      await pending.promise;
    });
    await screen.findByText('設定を保存しました。');
  });
  it('keeps precise pre-existing values and a draft when saving fails', async () => {
    const exact = {
      ...settings,
      planningStart: '08:10',
      planningEnd: '23:59',
      calendarBufferBeforeMinutes: 17,
    };
    const repository = createRepository({
      getProfilePlanningSettings: jest.fn(async () => exact),
      updateProfilePlanningSettings: jest.fn(async (_input: UpdateProfilePlanningSettingsInput) => {
        throw new Error('Network request failed');
      }),
    });
    const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
    await screen.findByRole('button', { name: '活動終了時間、23:59' });
    await selectDuration(screen, '予定後の余白時間', '33');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
    await screen.findByText(
      'プロフィール設定に接続できません。通信状況を確認して再度お試しください。',
    );
    for (const name of [
      '活動開始時間、08:10',
      '活動終了時間、23:59',
      '予定前の余白時間、17分',
      '予定後の余白時間、33分',
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(repository.updateProfilePlanningSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        planningStart: '08:10',
        planningEnd: '23:59',
        calendarBufferBeforeMinutes: 17,
        calendarBufferAfterMinutes: 33,
      }),
    );
  });
});

it('shows validation feedback beside save without writing an invalid planning window', async () => {
  const repository = createRepository();
  const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  await screen.findByTestId('settings-save-area');
  await selectTime(screen, '活動終了時間', '09:00', '1');
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  expect(await screen.findByText('入力内容を確認してください。')).toBeTruthy();
  expect(repository.updateProfilePlanningSettings).not.toHaveBeenCalled();
});

it('synchronizes the returned profile without remounting account operations', async () => {
  const mounted = jest.fn();
  function AccountProbe() {
    useEffect(() => {
      mounted();
    }, []);
    return <Text>Account state</Text>;
  }
  const repository = createRepository({
    updateProfilePlanningSettings: jest.fn(async (input: UpdateProfilePlanningSettingsInput) => ({
      ...input,
      minimumFreeMinutes: 46,
    })),
  });
  const screen = await render(
    <SettingsScreen
      repository={repository}
      onPressBack={jest.fn()}
      accountSection={<AccountProbe />}
    />,
  );
  await screen.findByTestId('settings-save-area');
  const before = mounted.mock.calls.length;
  await selectTime(screen, '活動開始時間', '09:17');
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  await screen.findByText('設定を保存しました。');
  expect(screen.getByRole('button', { name: '最小空き時間、46分' })).toBeTruthy();
  expect(mounted).toHaveBeenCalledTimes(before);
  expect(screen.queryByText('未保存の変更があります')).toBeNull();
});
