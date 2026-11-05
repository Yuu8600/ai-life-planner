import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { ActivityLog, ActivityLogRepository } from '@/features/activity';
import { TodayScreen } from '@/features/today/TodayScreen';
import type {
  TodayProjection,
  TodayRepository,
  ActionExecutionStatus,
  PlannedActionExecutionRepository,
} from '@/features/today';

const date = '2026-10-09' as const;
const log: ActivityLog = {
  id: '11111111-1111-4111-8111-111111111111',
  eventType: 'planned_action_completed',
  actionTitle: 'Snapshot completed',
  occurredAt: '2026-10-09T01:32:00Z',
  planDate: date,
  plannedActionId: null,
  taskId: null,
  scheduledStartAt: '2026-10-09T00:00:00Z',
  scheduledEndAt: '2026-10-09T00:30:00Z',
  timezone: 'Asia/Tokyo',
};
const today: TodayProjection = {
  greeting: 'おはようございます',
  localDate: date,
  profileTimezone: 'America/New_York',
  deadlineTasks: [
    {
      deadlineAt: '2026-10-09T14:00:00Z',
      goalTitle: null,
      id: 'task',
      status: 'pending',
      title: 'Deadline task',
    },
  ],
  plan: {
    id: 'plan',
    date,
    timezone: 'Asia/Tokyo',
    summary: 'Saved plan',
    actions: [
      {
        id: 'action',
        title: 'Scheduled task',
        taskId: 'task',
        taskTitle: 'Task',
        goalTitle: null,
        startAt: '2026-10-09T00:00:00Z',
        endAt: '2026-10-09T00:30:00Z',
        reason: null,
        status: 'scheduled',
      },
    ],
  },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function mount(
  history: ActivityLogRepository,
  base: TodayRepository = { getToday: jest.fn(async () => today) },
  execution?: PlannedActionExecutionRepository,
) {
  return render(
    <TodayScreen
      repository={base}
      activityLogRepository={history}
      executionRepository={execution}
      onPressAi={jest.fn()}
      onPressSettings={jest.fn()}
    />,
  );
}

describe('Today Activity Log', () => {
  it('shows a read-only empty state without treating the saved Plan as an error', async () => {
    const listForPlanDate = jest.fn(async () => []);
    const screen = await mount({ listForPlanDate });
    expect(
      await screen.findByText(
        'まだ実行履歴はありません。予定を完了・スキップすると、ここに記録されます。',
      ),
    ).toBeTruthy();
    await waitFor(() => expect(listForPlanDate).toHaveBeenCalledWith(date));
    expect(screen.getByText('Saved plan')).toBeTruthy();
    expect(screen.getByText('Deadline task')).toBeTruthy();
    expect(screen.queryByTestId('today-error-state')).toBeNull();
  });

  it('renders newest first with both statuses and each snapshot timezone, never UUIDs or Undo', async () => {
    const newest = {
      ...log,
      id: '22222222-2222-4222-8222-222222222222',
      eventType: 'planned_action_skipped' as const,
      actionTitle: 'Snapshot skipped',
      occurredAt: '2026-10-09T05:18:00Z',
    };
    const screen = await mount({ listForPlanDate: jest.fn(async () => [newest, log]) });
    expect(await screen.findByText('Snapshot skipped')).toBeTruthy();
    expect(
      screen.getAllByTestId('activity-log-row').map((row) => row.props.accessibilityLabel),
    ).toEqual(['14:18、Snapshot skipped、スキップ', '10:32、Snapshot completed、完了']);
    expect(screen.getByText('10:32')).toBeTruthy();
    expect(screen.queryByText(log.id)).toBeNull();
    expect(screen.queryByText('元に戻す')).toBeNull();
  });

  it('preserves a late execution under its Plan date and uses its snapshot timezone', async () => {
    const listForPlanDate = jest.fn(async () => [{ ...log, occurredAt: '2026-10-09T15:05:00Z' }]);
    const screen = await mount({ listForPlanDate });
    expect(await screen.findByText('00:05')).toBeTruthy();
    expect(listForPlanDate).toHaveBeenCalledWith(date);
  });

  it('isolates history errors and retries only history without exposing raw errors', async () => {
    const listForPlanDate = jest
      .fn()
      .mockRejectedValueOnce(new Error('private history error'))
      .mockResolvedValueOnce([log]);
    const base = { getToday: jest.fn(async () => today) };
    const screen = await mount({ listForPlanDate }, base);
    expect(
      await screen.findByText('実行履歴を読み込めませんでした。予定とTaskは引き続き確認できます。'),
    ).toBeTruthy();
    expect(screen.getByText('Saved plan')).toBeTruthy();
    expect(screen.getByText('Deadline task')).toBeTruthy();
    expect(screen.queryByText(/private history error/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '履歴を再読み込み' }));
    expect(await screen.findByText('Snapshot completed')).toBeTruthy();
    expect(listForPlanDate).toHaveBeenCalledTimes(2);
    expect(base.getToday).toHaveBeenCalledTimes(1);
  });

  it.each(['completed', 'skipped'] as const)(
    'loads a fresh Log from DB only after Action %s succeeds',
    async (targetStatus: ActionExecutionStatus) => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      try {
        const write = deferred<void>();
        const read = deferred<ActivityLog[]>();
        const listForPlanDate = jest
          .fn()
          .mockResolvedValueOnce([])
          .mockImplementationOnce(() => read.promise);
        const updated = {
          ...today,
          plan: {
            ...today.plan!,
            actions: today.plan!.actions.map((action) => ({ ...action, status: targetStatus })),
          },
        };
        const getToday = jest.fn().mockResolvedValueOnce(today).mockResolvedValueOnce(updated);
        const transition = jest.fn(() => write.promise);
        const screen = await mount({ listForPlanDate }, { getToday }, { transition });
        await waitFor(() => expect(listForPlanDate).toHaveBeenCalledTimes(1));
        await fireEvent.press(
          screen.getByRole('button', {
            name:
              targetStatus === 'completed'
                ? 'Scheduled taskを完了する'
                : 'Scheduled taskをスキップする',
          }),
        );
        if (targetStatus === 'skipped')
          await act(async () => {
            alert.mock.calls
              .at(-1)?.[2]
              ?.find((b) => b.text === 'スキップ')
              ?.onPress?.();
          });
        expect(listForPlanDate).toHaveBeenCalledTimes(1);
        expect(getToday).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Snapshot completed')).toBeNull();
        await act(async () => {
          write.resolve();
          await write.promise;
        });
        await waitFor(() => expect(listForPlanDate).toHaveBeenCalledTimes(2));
        expect(screen.getByText('Saved plan')).toBeTruthy();
        expect(screen.queryByText('Snapshot completed')).toBeNull();
        const eventType =
          targetStatus === 'completed' ? 'planned_action_completed' : 'planned_action_skipped';
        await act(async () => {
          read.resolve([{ ...log, eventType }]);
          await read.promise;
        });
        expect(await screen.findByText('Snapshot completed')).toBeTruthy();
        expect(
          screen.getByLabelText(
            `10:32、Snapshot completed、${targetStatus === 'completed' ? '完了' : 'スキップ'}`,
          ),
        ).toBeTruthy();
        expect(transition).toHaveBeenCalledTimes(1);
      } finally {
        alert.mockRestore();
      }
    },
  );

  it('keeps Action success separate from a failed post-execution history read', async () => {
    const listForPlanDate = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('history down'));
    const updated = {
      ...today,
      plan: {
        ...today.plan!,
        actions: today.plan!.actions.map((action) => ({ ...action, status: 'completed' as const })),
      },
    };
    const getToday = jest.fn().mockResolvedValueOnce(today).mockResolvedValueOnce(updated);
    const screen = await mount(
      { listForPlanDate },
      { getToday },
      { transition: jest.fn(async () => {}) },
    );
    await waitFor(() => expect(listForPlanDate).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole('button', { name: 'Scheduled taskを完了する' }));
    expect(await screen.findByRole('button', { name: '履歴を再読み込み' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scheduled taskを完了する' })).toBeNull();
    expect(screen.queryByText(/完了処理に失敗/)).toBeNull();
    expect(screen.getByText('Saved plan')).toBeTruthy();
  });

  it('refreshes history on focus even when the Plan has been deleted', async () => {
    const listForPlanDate = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([log]);
    const history = { listForPlanDate };
    const base = { getToday: jest.fn(async () => ({ ...today, plan: null })) };
    const screen = await mount(history, base);
    await waitFor(() => expect(listForPlanDate).toHaveBeenCalledTimes(1));
    await screen.rerender(
      <TodayScreen
        repository={base}
        activityLogRepository={history}
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
        refreshToken={1}
      />,
    );
    expect(await screen.findByText('Snapshot completed')).toBeTruthy();
    expect(screen.getByTestId('today-plan-empty-state')).toBeTruthy();
  });

  it('discards old account/date reads when the repository changes', async () => {
    const pending = deferred<ActivityLog[]>();
    const first = { listForPlanDate: jest.fn(() => pending.promise) };
    const base = { getToday: jest.fn(async () => today) };
    const screen = await mount(first, base);
    await waitFor(() => expect(first.listForPlanDate).toHaveBeenCalledTimes(1));
    const next = { listForPlanDate: jest.fn(async () => []) };
    await screen.rerender(
      <TodayScreen
        repository={base}
        activityLogRepository={next}
        onPressAi={jest.fn()}
        onPressSettings={jest.fn()}
      />,
    );
    await waitFor(() => expect(next.listForPlanDate).toHaveBeenCalledTimes(1));
    await act(async () => {
      pending.resolve([log]);
      await pending.promise;
    });
    expect(screen.queryByText('Snapshot completed')).toBeNull();
  });
});
