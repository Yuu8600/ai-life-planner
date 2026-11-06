import type { CalendarRepository, CalendarEvent } from '@/features/calendar';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { TodayScreen } from '@/features/today/TodayScreen';
import type {
  TodayProjection,
  TodayRepository,
} from '@/features/today/repositories/TodayRepository';
import type { ActionExecutionStatus, PlannedActionExecutionRepository } from '@/features/today';

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
  it.each(['none', 'empty', 'populated'])(
    'shows Replan only for an existing %s Plan',
    async (kind) => {
      const today =
        kind === 'none'
          ? emptyToday
          : kind === 'populated'
            ? populatedToday
            : { ...populatedToday, plan: { ...populatedToday.plan!, actions: [] } };
      const onReplan = jest.fn();
      const screen = await render(
        <TodayScreen
          onPressAi={jest.fn()}
          onPressSettings={jest.fn()}
          onPressReplan={onReplan}
          repository={createRepository({ getToday: jest.fn(async () => today) })}
        />,
      );
      await screen.findByText('今日の計画');
      if (kind === 'none') expect(screen.queryByText('再計画する')).toBeNull();
      else {
        await fireEvent.press(screen.getByText('再計画する'));
        expect(onReplan).toHaveBeenCalledTimes(1);
      }
    },
  );
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
    expect(
      screen.getByText(
        'Tasksに行動を登録し、Calendarで空き時間を確認したら、Plannerで今日の計画を作りましょう。',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('today-deadline-tasks-empty')).toBeTruthy();
    expect(screen.getByText('2026年9月11日 金曜日')).toBeTruthy();
    expect(screen.getByText('今日の予定')).toBeTruthy();
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
    expect(screen.getByLabelText(/朝の集中しやすい時間だからです。/)).toBeTruthy();
    expect(screen.getByText('Task: 英単語を20分学習')).toBeTruthy();
    expect(screen.getAllByText('Goal: TOEIC 730')).toHaveLength(2);
    expect(screen.getAllByLabelText(/予定アクション/)).toHaveLength(3);
    expect(screen.getByText('予定')).toBeTruthy();
    expect(screen.getAllByText('完了').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('スキップ')).toBeTruthy();
    expect(screen.getByText('今日が期限のタスク')).toBeTruthy();
    expect(screen.getByTestId('today-deadline-tasks')).toBeTruthy();
    expect(screen.getByText('未予定')).toBeTruthy();
    expect(screen.getByLabelText('この計画の完了数 1件、全3件')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Plannerで今日の計画を作成する' }));
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

describe('Today Action execution', () => {
  const initial: TodayProjection = {
    ...populatedToday,
    plan: {
      ...populatedToday.plan!,
      actions: populatedToday.plan!.actions.map((action, index) =>
        index === 0 ? { ...action, status: 'scheduled' as const } : action,
      ),
    },
  };
  function afterExecution(id: string, targetStatus: ActionExecutionStatus): TodayProjection {
    const action = initial.plan!.actions.find((item) => item.id === id)!;
    return {
      ...initial,
      deadlineTasks: initial.deadlineTasks.map((task) =>
        targetStatus === 'completed' && task.id === action.taskId
          ? { ...task, status: 'completed' }
          : task,
      ),
      plan: {
        ...initial.plan!,
        actions: initial.plan!.actions.map((item) =>
          item.id === id ? { ...item, status: targetStatus } : item,
        ),
      },
    };
  }
  const renderExecution = (
    repository: TodayRepository,
    executionRepository: PlannedActionExecutionRepository,
  ) =>
    render(
      <TodayScreen
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
        repository={repository}
        calendarRepository={calendarReader()}
        executionRepository={executionRepository}
      />,
    );

  it('shows operations only for scheduled Actions, never completed/skipped', async () => {
    const screen = await renderExecution(createRepository(), {
      transition: jest.fn(async () => {}),
    });
    expect(await screen.findByRole('button', { name: 'TOEIC Listeningを完了する' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'TOEIC Listeningをスキップする' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '金フレを完了する' })).toBeNull();
    expect(screen.queryByRole('button', { name: '金フレをスキップする' })).toBeNull();
    expect(screen.queryByRole('button', { name: '振り返りを完了する' })).toBeNull();
    expect(screen.queryByRole('button', { name: '振り返りをスキップする' })).toBeNull();
  });

  it('completes with one tap and uses a fresh DB projection for Action and deadline Task status', async () => {
    const getToday = jest
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(afterExecution('action-words', 'completed'));
    const transition = jest.fn(async () => {});
    const screen = await renderExecution({ getToday }, { transition });
    await screen.findByRole('button', { name: '金フレを完了する' });
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    await waitFor(() => expect(getToday).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '金フレを完了する' })).toBeNull(),
    );
    expect(transition).toHaveBeenCalledWith({
      actionId: 'action-words',
      targetStatus: 'completed',
    });
    expect(screen.queryByText('未予定')).toBeNull();
    expect(screen.getAllByText('完了').length).toBeGreaterThanOrEqual(2);
  });

  it('confirms Skip, allows cancellation, then refreshes without completing the deadline Task', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const getToday = jest
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(afterExecution('action-words', 'skipped'));
      const transition = jest.fn(async () => {});
      const screen = await renderExecution({ getToday }, { transition });
      await screen.findByRole('button', { name: '金フレをスキップする' });
      await fireEvent.press(screen.getByRole('button', { name: '金フレをスキップする' }));
      expect(alert).toHaveBeenCalledWith(
        'この予定をスキップしますか？',
        expect.any(String),
        expect.any(Array),
      );
      expect(transition).not.toHaveBeenCalled();
      await act(async () => {
        alert.mock.calls
          .at(-1)?.[2]
          ?.find((button) => button.text === 'キャンセル')
          ?.onPress?.();
      });
      expect(transition).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: '金フレをスキップする' }));
      await act(async () => {
        alert.mock.calls
          .at(-1)?.[2]
          ?.find((button) => button.text === 'スキップ')
          ?.onPress?.();
      });
      await waitFor(() => expect(getToday).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: '金フレをスキップする' })).toBeNull(),
      );
      expect(transition).toHaveBeenCalledWith({
        actionId: 'action-words',
        targetStatus: 'skipped',
      });
      expect(screen.getByText('未予定')).toBeTruthy();
    } finally {
      alert.mockRestore();
    }
  });

  it('locks both buttons on one Action through the RPC and refresh, without locking another Action', async () => {
    const mutation = createDeferred<void>();
    const reload = createDeferred<TodayProjection>();
    const getToday = jest
      .fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => reload.promise);
    const transition = jest.fn(() => mutation.promise);
    const screen = await renderExecution({ getToday }, { transition });
    await screen.findByRole('button', { name: '金フレを完了する' });
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    expect(
      screen.getByRole('button', { name: '金フレを完了する' }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: '金フレをスキップする' }).props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'TOEIC Listeningを完了する' }).props.accessibilityState
        .disabled,
    ).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    expect(transition).toHaveBeenCalledTimes(1);
    expect(getToday).toHaveBeenCalledTimes(1);
    await act(async () => {
      mutation.resolve();
      await mutation.promise;
    });
    expect(getToday).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('button', { name: '金フレを完了する' }).props.accessibilityState.disabled,
    ).toBe(true);
    // No optimistic completion while the read is pending.
    await act(async () => {
      reload.resolve(afterExecution('action-words', 'completed'));
      await reload.promise;
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '金フレを完了する' })).toBeNull(),
    );
  });

  it.each(['completed', 'skipped'] as const)(
    'keeps the original Action on %s failure and allows retry',
    async (targetStatus) => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      try {
        const getToday = jest
          .fn()
          .mockResolvedValueOnce(initial)
          .mockResolvedValueOnce(afterExecution('action-words', targetStatus));
        const transition = jest
          .fn()
          .mockRejectedValueOnce(new Error('private write error'))
          .mockResolvedValueOnce(undefined);
        const screen = await renderExecution({ getToday }, { transition });
        const label = targetStatus === 'completed' ? '金フレを完了する' : '金フレをスキップする';
        await screen.findByRole('button', { name: label });
        const press = async () => {
          await fireEvent.press(screen.getByRole('button', { name: label }));
          if (targetStatus === 'skipped')
            await act(async () => {
              alert.mock.calls
                .at(-1)?.[2]
                ?.find((button) => button.text === 'スキップ')
                ?.onPress?.();
            });
        };
        await press();
        expect(
          await screen.findByText(
            targetStatus === 'completed'
              ? '完了処理に失敗しました。もう一度お試しください。'
              : 'スキップ処理に失敗しました。もう一度お試しください。',
          ),
        ).toBeTruthy();
        expect(screen.queryByText(/private write error/)).toBeNull();
        expect(screen.getByRole('button', { name: label }).props.accessibilityState.disabled).toBe(
          false,
        );
        expect(screen.getByText('金フレ')).toBeTruthy();
        expect(getToday).toHaveBeenCalledTimes(1);
        await press();
        await waitFor(() => expect(screen.queryByRole('button', { name: label })).toBeNull());
        expect(transition).toHaveBeenCalledTimes(2);
        expect(getToday).toHaveBeenCalledTimes(2);
      } finally {
        alert.mockRestore();
      }
    },
  );

  it('keeps the old projection if post-write refresh fails and retries the read without another mutation', async () => {
    const getToday = jest
      .fn()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(afterExecution('action-words', 'completed'));
    const transition = jest.fn(async () => {});
    const screen = await renderExecution({ getToday }, { transition });
    await screen.findByRole('button', { name: '金フレを完了する' });
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    expect(await screen.findByTestId('today-refresh-error')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '金フレを完了する' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '金フレを完了する' })).toBeNull(),
    );
    expect(getToday).toHaveBeenCalledTimes(3);
    expect(transition).toHaveBeenCalledTimes(1);
  });

  it('supports independent writes and ignores an older refresh that finishes after the newest read', async () => {
    const firstWrite = createDeferred<void>();
    const secondWrite = createDeferred<void>();
    const olderRead = createDeferred<TodayProjection>();
    const newerRead = createDeferred<TodayProjection>();
    const getToday = jest
      .fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => olderRead.promise)
      .mockImplementationOnce(() => newerRead.promise);
    const transition = jest.fn(({ actionId }: { actionId: string }) =>
      actionId === 'action-words' ? firstWrite.promise : secondWrite.promise,
    );
    const screen = await renderExecution({ getToday }, { transition });
    await screen.findByRole('button', { name: '金フレを完了する' });
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを完了する' }));
    expect(transition).toHaveBeenCalledTimes(2);
    await act(async () => {
      firstWrite.resolve();
      await firstWrite.promise;
    });
    await act(async () => {
      secondWrite.resolve();
      await secondWrite.promise;
    });
    expect(getToday).toHaveBeenCalledTimes(3);
    const latest = {
      ...afterExecution('action-words', 'completed'),
      plan: {
        ...initial.plan!,
        actions: initial.plan!.actions.map((action) =>
          action.status === 'scheduled' ? { ...action, status: 'completed' as const } : action,
        ),
      },
    };
    await act(async () => {
      newerRead.resolve(latest);
      await newerRead.promise;
    });
    await act(async () => {
      olderRead.resolve(afterExecution('action-words', 'completed'));
      await olderRead.promise;
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'TOEIC Listeningを完了する' })).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: '金フレを完了する' })).toBeNull();
  });

  it('does not refresh a retired screen after its pending write completes', async () => {
    const write = createDeferred<void>();
    const getToday = jest.fn(async () => initial);
    const screen = await renderExecution(
      { getToday },
      { transition: jest.fn(() => write.promise) },
    );
    await screen.findByRole('button', { name: '金フレを完了する' });
    await fireEvent.press(screen.getByRole('button', { name: '金フレを完了する' }));
    await screen.unmount();
    await act(async () => {
      write.resolve();
      await write.promise;
    });
    expect(getToday).toHaveBeenCalledTimes(1);
  });
});

const calendarEvent: CalendarEvent = {
  allDay: false,
  allDayEndDate: null,
  allDayStartDate: null,
  availability: 'busy',
  calendarId: 'cal',
  calendarTitle: null,
  startAt: '2026-09-11T04:00:00Z',
  endAt: '2026-09-11T05:00:00Z',
  id: 'event',
  instanceId: null,
  location: null,
  status: 'confirmed',
  timeZone: null,
  title: 'Calendar meeting',
};
function calendarReader(): jest.Mocked<CalendarRepository> {
  return {
    getPermission: jest.fn(async () => ({ status: 'granted' as const, canAskAgain: true })),
    requestPermission: jest.fn(),
    listEvents: jest.fn<
      ReturnType<CalendarRepository['listEvents']>,
      Parameters<CalendarRepository['listEvents']>
    >(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [calendarEvent],
    })),
  };
}
describe('Today calendar integration', () => {
  it('queries the profile day while displaying Calendar and Actions in the saved Plan timezone', async () => {
    const calendar = calendarReader();
    const screen = await render(
      <TodayScreen
        calendarRepository={calendar}
        repository={createRepository()}
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
      />,
    );
    expect(await screen.findByText('Calendar meeting')).toBeTruthy();
    expect(screen.getByText('13:00–14:00')).toBeTruthy();
    expect(screen.getByText('時刻表示: Asia/Tokyo')).toBeTruthy();
    expect(calendar.listEvents).toHaveBeenCalledWith(
      { startAt: '2026-09-11T04:00:00.000Z', endAt: '2026-09-12T04:00:00.000Z' },
      '2026-09-11',
    );
    const titles = screen.toJSON();
    const json = JSON.stringify(titles);
    expect(json.indexOf('金フレ')).toBeLessThan(json.indexOf('Calendar meeting'));
    expect(json.indexOf('Calendar meeting')).toBeLessThan(json.indexOf('TOEIC Listening'));
    expect(calendar.requestPermission).not.toHaveBeenCalled();
  });
  it('shows Calendar with no saved Plan and preserves the create-plan guidance', async () => {
    const screen = await render(
      <TodayScreen
        calendarRepository={calendarReader()}
        repository={createRepository({ getToday: jest.fn(async () => emptyToday) })}
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
      />,
    );
    expect(await screen.findByText('Calendar meeting')).toBeTruthy();
    expect(screen.getByText('今日の計画はまだありません')).toBeTruthy();
  });
  it.each(['denied', 'failure', 'pending', 'no-calendars'])(
    'does not gate Action execution when Calendar is %s',
    async (kind) => {
      const calendar = calendarReader();
      if (kind === 'denied')
        calendar.getPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
      if (kind === 'failure') calendar.listEvents.mockRejectedValue(new Error('private failure'));
      if (kind === 'pending') calendar.listEvents.mockReturnValue(new Promise(() => {}));
      if (kind === 'no-calendars')
        calendar.listEvents.mockResolvedValue({
          calendarCount: 0,
          discardedEventCount: 0,
          events: [],
        });
      const transition = jest.fn(async () => {});
      const screen = await render(
        <TodayScreen
          calendarRepository={calendar}
          repository={createRepository()}
          executionRepository={{ transition }}
          onPressAi={jest.fn()}
          onPressSettings={jest.fn()}
        />,
      );
      await fireEvent.press(
        await screen.findByRole('button', { name: 'TOEIC Listeningを完了する' }),
      );
      await waitFor(() =>
        expect(transition).toHaveBeenCalledWith({
          actionId: 'action-listening',
          targetStatus: 'completed',
        }),
      );
      expect(calendar.requestPermission).not.toHaveBeenCalled();
    },
  );
  it('ignores late Calendar results after the displayed day changes', async () => {
    const calendar = calendarReader();
    const old = createDeferred<Awaited<ReturnType<CalendarRepository['listEvents']>>>();
    calendar.listEvents.mockReturnValueOnce(old.promise);
    const repository = createRepository({ getToday: jest.fn(async () => emptyToday) });
    const props = {
      calendarRepository: calendar,
      repository,
      onPressAi: jest.fn(),
      onPressSettings: jest.fn(),
    };
    const screen = await render(<TodayScreen {...props} />);
    await waitFor(() => expect(calendar.listEvents).toHaveBeenCalledTimes(1));
    repository.getToday.mockResolvedValue({ ...emptyToday, localDate: '2026-09-12' });
    calendar.listEvents.mockResolvedValue({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [{ ...calendarEvent, title: 'new day' }],
    });
    await screen.rerender(<TodayScreen {...props} refreshToken={1} />);
    expect(await screen.findByText('new day')).toBeTruthy();
    await act(async () =>
      old.resolve({ calendarCount: 1, discardedEventCount: 0, events: [calendarEvent] }),
    );
    expect(screen.queryByText('Calendar meeting')).toBeNull();
    expect(screen.getByText('new day')).toBeTruthy();
  });
});
