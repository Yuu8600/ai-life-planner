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
  deadlineTasks: [],
  greeting: 'おはようございます',
  localDate: '2026-09-11',
  plan: null,
  profileTimezone: 'Asia/Tokyo',
};

const populatedToday: TodayProjection = {
  deadlineTasks: [
    {
      deadlineAt: '2026-09-11T14:59:59.999Z',
      goalTitle: 'TOEIC 730',
      id: 'task-words',
      status: 'pending',
      title: '英単語を20分学習',
    },
  ],
  greeting: 'おはようございます',
  localDate: '2026-09-11',
  plan: {
    actions: [
      {
        endAt: '2026-09-10T23:50:00.000Z',
        goalTitle: 'TOEIC 730',
        id: 'action-words',
        reason: '朝の集中しやすい時間だからです。',
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
        reason: null,
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
        reason: '振り返りの時間です。',
        startAt: '2026-09-11T10:00:00.000Z',
        status: 'skipped',
        taskId: null,
        taskTitle: null,
        title: '振り返り',
      },
    ],
    date: '2026-09-11',
    id: 'plan-today',
    summary: '朝と夕方に英語学習を進めます。',
    timezone: 'Asia/Tokyo',
  },
  profileTimezone: 'America/New_York',
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
  it('shows a loading state until Today data is fetched', async () => {
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

  it('distinguishes no saved Plan from an error or a zero-action Plan', async () => {
    const repository = createRepository({ getToday: jest.fn(async () => emptyToday) });
    const screen = await render(
      <TodayScreen onPressAi={jest.fn()} onPressSettings={jest.fn()} repository={repository} />,
    );

    expect(await screen.findByTestId('today-plan-empty-state')).toBeTruthy();
    expect(screen.getByText('今日の計画はまだありません')).toBeTruthy();
    expect(screen.getByText('AIタブで今日の計画を作成できます。')).toBeTruthy();
    expect(screen.getByTestId('today-deadline-tasks-empty')).toBeTruthy();
    expect(screen.getByText('2026年9月11日 金曜日')).toBeTruthy();
    expect(screen.getByText('おはようございます')).toBeTruthy();
  });

  it('shows a saved Plan summary and a separate zero-action state', async () => {
    const today: TodayProjection = {
      ...emptyToday,
      plan: {
        actions: [],
        date: '2026-09-11',
        id: 'plan-empty',
        summary: '今日は固定予定を優先します。',
        timezone: 'Asia/Tokyo',
      },
    };
    const screen = await render(
      <TodayScreen
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
        repository={createRepository({ getToday: jest.fn(async () => today) })}
      />,
    );

    expect(await screen.findByText('今日は固定予定を優先します。')).toBeTruthy();
    expect(screen.getByTestId('today-plan-actions-empty')).toBeTruthy();
    expect(screen.queryByTestId('today-plan-empty-state')).toBeNull();
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

  it('renders summary, plan-timezone times, reasons, all statuses, and deadline Tasks separately', async () => {
    const onPressAi = jest.fn();
    const onPressSettings = jest.fn();
    const screen = await render(
      <TodayScreen
        onPressAi={onPressAi}
        onPressSettings={onPressSettings}
        repository={createRepository()}
      />,
    );

    expect(await screen.findByText('朝と夕方に英語学習を進めます。')).toBeTruthy();
    expect(screen.getByText('金フレ')).toBeTruthy();
    expect(screen.getByText('08:30')).toBeTruthy();
    expect(screen.getByText('08:50')).toBeTruthy();
    expect(screen.getByText('朝の集中しやすい時間だからです。')).toBeTruthy();
    expect(screen.getByText('Task: 英単語を20分学習')).toBeTruthy();
    expect(screen.getAllByText('Goal: TOEIC 730')).toHaveLength(2);
    expect(screen.getAllByText('予定アクション')).toHaveLength(3);
    expect(screen.getByText('予定')).toBeTruthy();
    expect(screen.getAllByText('完了').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('スキップ')).toBeTruthy();
    expect(screen.getByText('今日が期限のTask')).toBeTruthy();
    expect(screen.getByTestId('today-deadline-tasks')).toBeTruthy();
    expect(screen.getByText('未予定')).toBeTruthy();
    expect(screen.getByLabelText('今日の完了数 1件、全3件')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'AIに今日の計画を相談する' }));
    await fireEvent.press(screen.getByRole('button', { name: '設定を開く' }));
    expect(onPressAi).toHaveBeenCalledTimes(1);
    expect(onPressSettings).toHaveBeenCalledTimes(1);
  });

  it('refetches and displays the latest saved Plan when focus refresh changes', async () => {
    const replacementToday: TodayProjection = {
      ...populatedToday,
      plan: {
        ...populatedToday.plan!,
        actions: [populatedToday.plan!.actions[1]],
        summary: '再保存した最新プランです。',
      },
    };
    const getToday = jest
      .fn<ReturnType<TodayRepository['getToday']>, Parameters<TodayRepository['getToday']>>()
      .mockResolvedValueOnce(populatedToday)
      .mockResolvedValueOnce(replacementToday);
    const repository = createRepository({ getToday });
    const screen = await render(
      <TodayScreen
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
        refreshToken={0}
        repository={repository}
      />,
    );

    expect(await screen.findByText('朝と夕方に英語学習を進めます。')).toBeTruthy();

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
    expect(await screen.findByText('再保存した最新プランです。')).toBeTruthy();
    expect(screen.queryByText('金フレ')).toBeNull();
  });
});
