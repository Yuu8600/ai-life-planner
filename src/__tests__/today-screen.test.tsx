import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { TodayScreen } from '@/features/today/TodayScreen';
import type {
  TodayProjection,
  TodayRepository,
} from '@/features/today/repositories/TodayRepository';

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

const emptyToday: TodayProjection = {
  actions: [],
  greeting: 'おはようございます',
  localDate: '2026-09-11',
  summary: null,
  timezone: 'Asia/Tokyo',
};

const populatedToday: TodayProjection = {
  actions: [
    {
      endAt: '2026-09-10T23:50:00.000Z',
      goalTitle: 'TOEIC 730',
      id: 'action-words',
      startAt: '2026-09-10T23:30:00.000Z',
      status: 'completed',
      taskId: 'task-words',
      taskTitle: '英単語を20分学習',
      title: '金フレ',
    },
    {
      endAt: '2026-09-11T08:30:00.000Z',
      goalTitle: null,
      id: 'action-listening',
      startAt: '2026-09-11T08:00:00.000Z',
      status: 'scheduled',
      taskId: 'task-listening',
      taskTitle: 'Listening',
      title: 'TOEIC Listening',
    },
    {
      endAt: '2026-09-11T10:30:00.000Z',
      goalTitle: null,
      id: 'action-skipped',
      startAt: '2026-09-11T10:00:00.000Z',
      status: 'skipped',
      taskId: null,
      taskTitle: null,
      title: '振り返り',
    },
  ],
  greeting: 'おはようございます',
  localDate: '2026-09-11',
  summary: '朝と夕方に英語学習を進めます。',
  timezone: 'Asia/Tokyo',
};

function createRepository(
  overrides: Partial<jest.Mocked<TodayRepository>> = {},
): jest.Mocked<TodayRepository> {
  return {
    getToday: jest.fn(async () => populatedToday),
    ...overrides,
  };
}

describe('TodayScreen', () => {
  it('shows a loading state until today data is fetched', async () => {
    const deferred = createDeferred<TodayProjection>();
    const repository = createRepository({ getToday: jest.fn(() => deferred.promise) });
    const screen = await render(
      <TodayScreen onPressAi={jest.fn()} onPressSettings={jest.fn()} repository={repository} />,
    );

    expect(screen.getByTestId('today-loading-state')).toBeTruthy();

    await act(async () => {
      deferred.resolve(populatedToday);
      await deferred.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await screen.findByText('金フレ')).toBeTruthy();
  });

  it('shows repository date and greeting with an empty state when there are no actions', async () => {
    const repository = createRepository({ getToday: jest.fn(async () => emptyToday) });
    const screen = await render(
      <TodayScreen onPressAi={jest.fn()} onPressSettings={jest.fn()} repository={repository} />,
    );

    expect(await screen.findByTestId('today-empty-state')).toBeTruthy();
    expect(screen.getByText('2026年9月11日 金曜日')).toBeTruthy();
    expect(screen.getByText('おはようございます')).toBeTruthy();
    expect(screen.queryByText('大学')).toBeNull();
  });

  it('shows a safe Japanese error and retries a failed fetch', async () => {
    const getToday = jest
      .fn<ReturnType<TodayRepository['getToday']>, Parameters<TodayRepository['getToday']>>()
      .mockRejectedValueOnce(new Error('Network request failed with private detail'))
      .mockResolvedValueOnce(populatedToday);
    const repository = createRepository({ getToday });
    const screen = await render(
      <TodayScreen onPressAi={jest.fn()} onPressSettings={jest.fn()} repository={repository} />,
    );

    expect(
      await screen.findByText('今日の予定に接続できません。通信状況を確認して再度お試しください。'),
    ).toBeTruthy();
    expect(screen.queryByText(/private detail/i)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));

    expect(await screen.findByText('金フレ')).toBeTruthy();
    expect(getToday).toHaveBeenCalledTimes(2);
  });

  it('renders actions, timezone-adjusted times, statuses, task and optional Goal labels', async () => {
    const onPressAi = jest.fn();
    const onPressSettings = jest.fn();
    const screen = await render(
      <TodayScreen
        onPressAi={onPressAi}
        onPressSettings={onPressSettings}
        repository={createRepository()}
      />,
    );

    expect(await screen.findByText('金フレ')).toBeTruthy();
    expect(screen.getByText('08:30')).toBeTruthy();
    expect(screen.getByText('Task: 英単語を20分学習')).toBeTruthy();
    expect(screen.getByText('Goal: TOEIC 730')).toBeTruthy();
    expect(screen.getAllByText('予定アクション')).toHaveLength(3);
    expect(screen.queryByText('Calendar Event')).toBeNull();
    expect(screen.getByText('予定')).toBeTruthy();
    expect(screen.getByText('スキップ')).toBeTruthy();
    expect(screen.getByLabelText('今日の完了数 1件、全3件')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'AIに今日の計画を相談する' }));
    await fireEvent.press(screen.getByRole('button', { name: '設定を開く' }));
    expect(onPressAi).toHaveBeenCalledTimes(1);
    expect(onPressSettings).toHaveBeenCalledTimes(1);
  });

  it('reloads profile timezone and Today data when the screen is focused again', async () => {
    const changedTimezoneToday = {
      ...emptyToday,
      localDate: '2026-09-10',
      timezone: 'America/New_York',
    };
    const getToday = jest
      .fn<ReturnType<TodayRepository['getToday']>, Parameters<TodayRepository['getToday']>>()
      .mockResolvedValueOnce(emptyToday)
      .mockResolvedValueOnce(changedTimezoneToday);
    const repository = createRepository({ getToday });
    const screen = await render(
      <TodayScreen
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
        refreshToken={0}
        repository={repository}
      />,
    );

    expect(await screen.findByText('2026年9月11日 金曜日')).toBeTruthy();

    await act(async () => {
      screen.rerender(
        <TodayScreen
          onPressAi={jest.fn()}
          onPressSettings={jest.fn()}
          refreshToken={1}
          repository={repository}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(getToday).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('2026年9月10日 木曜日')).toBeTruthy();
  });
});
