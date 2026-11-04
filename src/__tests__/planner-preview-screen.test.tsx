import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { CalendarPermission, CalendarRepository } from '@/features/calendar';
import { PlannerPreviewScreen } from '@/features/planner/PlannerPreviewScreen';
import {
  RuleBasedPlannerProvider,
  type PlannerInput,
  type PlannerPersistenceRepository,
  type PlannerProvider,
  PlannerReplanConflictError,
  type PlannerReplanRepository,
} from '@/features/planner';
import type {
  PlannerPreviewGoalRepository,
  PlannerPreviewTaskRepository,
} from '@/features/planner/plannerPreview';
import type { SettingsRepository } from '@/features/settings';

const oversizedTaskId = '11111111-1111-4111-8111-111111111111';
const shortTaskId = '22222222-2222-4222-8222-222222222222';
const now = () => new Date('2026-09-16T15:30:00.000Z');
const settings = {
  minimumFreeMinutes: 20,
  planningEnd: '10:00',
  planningStart: '08:00',
  timezone: 'Asia/Tokyo',
};
const dailyPlanId = '33333333-3333-4333-8333-333333333333';

function createCalendarRepository(
  overrides: Partial<CalendarRepository> = {},
): jest.Mocked<CalendarRepository> {
  return {
    getPermission: jest.fn(async () => ({ canAskAgain: true, status: 'granted' })),
    listEvents: jest.fn(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: [],
    })),
    requestPermission: jest.fn(async () => ({ canAskAgain: true, status: 'granted' })),
    ...overrides,
  } as jest.Mocked<CalendarRepository>;
}

function createSettingsRepository(): jest.Mocked<SettingsRepository> {
  return {
    getProfilePlanningSettings: jest.fn(async () => settings),
    updateProfilePlanningSettings: jest.fn(async (input) => input),
  };
}

function createGoalRepository(): jest.Mocked<PlannerPreviewGoalRepository> {
  return { list: jest.fn(async () => []) };
}

function createTaskRepository(
  tasks: Awaited<ReturnType<PlannerPreviewTaskRepository['list']>> = [
    {
      deadline: null,
      estimatedMinutes: 180,
      goalId: null,
      id: oversizedTaskId,
      priority: 'high',
      status: 'pending',
      title: '長時間Task',
    },
    {
      deadline: null,
      estimatedMinutes: 30,
      goalId: null,
      id: shortTaskId,
      priority: 'medium',
      status: 'pending',
      title: '朝の復習',
    },
  ],
): jest.Mocked<PlannerPreviewTaskRepository> {
  return { list: jest.fn(async () => tasks) };
}

function createPersistenceRepository(
  savePlan: PlannerPersistenceRepository['savePlan'] = jest.fn(async (input) => ({
    actionCount: input.actions.length,
    id: dailyPlanId,
    planDate: input.planDate,
  })),
): jest.Mocked<PlannerPersistenceRepository> {
  return { savePlan: jest.fn(savePlan) };
}

async function renderScreen(
  provider: PlannerProvider = new RuleBasedPlannerProvider(),
  calendarRepository = createCalendarRepository(),
  taskRepository = createTaskRepository(),
  persistenceRepository = createPersistenceRepository(),
  selection?: {
    onSelectProvider: (id: 'openai' | 'rule-based') => void;
    openAiAvailability: 'available' | 'checking' | 'unavailable';
  },
  clock: () => Date = now,
) {
  return render(
    <PlannerPreviewScreen
      calendarRepository={calendarRepository}
      goalRepository={createGoalRepository()}
      now={clock}
      onOpenSettings={jest.fn()}
      onSelectProvider={selection?.onSelectProvider}
      openAiAvailability={selection?.openAiAvailability}
      persistenceRepository={persistenceRepository}
      provider={provider}
      settingsRepository={createSettingsRepository()}
      taskRepository={taskRepository}
    />,
  );
}

function confirmLatestAlert(alert: jest.SpyInstance): Promise<void> | undefined {
  const buttons = alert.mock.calls.at(-1)?.[2];
  const confirm = buttons?.find((button: { text?: string }) => button.text === '採用する');
  return confirm?.onPress?.() as unknown as Promise<void> | undefined;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Replanning Preview', () => {
  function setup(tasks = createTaskRepository()) {
    const provider: PlannerProvider = {
      id: 'rule-based',
      generate: jest.fn(async (input) => new RuleBasedPlannerProvider().generate(input)),
    };
    const persistence = createPersistenceRepository();
    const replan: jest.Mocked<PlannerReplanRepository> = {
      getSnapshot: jest.fn<
        ReturnType<PlannerReplanRepository['getSnapshot']>,
        Parameters<PlannerReplanRepository['getSnapshot']>
      >(async () => ({
        id: dailyPlanId,
        planDate: '2026-09-17',
        summary: 'Old Plan',
        timezone: 'Asia/Tokyo',
        updatedAt: '2026-09-16T15:00:00.123456Z',
        actions: [],
      })),
      replaceIfCurrent: jest.fn<
        ReturnType<PlannerReplanRepository['replaceIfCurrent']>,
        Parameters<PlannerReplanRepository['replaceIfCurrent']>
      >(async (input) => ({
        id: dailyPlanId,
        planDate: input.planDate,
        actionCount: input.actions.length,
      })),
    };
    const onSaved = jest.fn();
    const onCancel = jest.fn();
    const props = {
      calendarRepository: createCalendarRepository(),
      goalRepository: createGoalRepository(),
      now,
      persistenceRepository: persistence,
      provider,
      settingsRepository: createSettingsRepository(),
      taskRepository: tasks,
      replanRepository: replan,
      mode: 'replan' as const,
      onReplanSaved: onSaved,
      onCancelReplan: onCancel,
    };
    return { props, provider, persistence, replan, onSaved, onCancel };
  }
  it('waits for explicit Generate, preserves the old Plan through generation/regeneration/Cancel', async () => {
    const test = setup();
    const screen = await render(<PlannerPreviewScreen {...test.props} />);
    expect(await screen.findByText('今日の計画を再計画')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('残り時間の計画を作成')).not.toBeDisabled());
    expect(test.provider.generate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('残り時間の計画を作成'));
    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    expect(test.replan.replaceIfCurrent).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('再生成'));
    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    await fireEvent.press(screen.getByText('再計画をキャンセル'));
    expect(test.onCancel).toHaveBeenCalledTimes(1);
    expect(test.replan.replaceIfCurrent).not.toHaveBeenCalled();
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
    expect(test.provider.generate).toHaveBeenCalledTimes(2);
  });
  it('keeps a DB-stale Preview, never auto-calls the Provider, and allows explicit regeneration and guarded saving', async () => {
    const test = setup();
    test.replan.replaceIfCurrent.mockRejectedValueOnce(new PlannerReplanConflictError());
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await render(<PlannerPreviewScreen {...test.props} />);
    await waitFor(() => expect(screen.getByText('残り時間の計画を作成')).not.toBeDisabled());
    await fireEvent.press(screen.getByText('残り時間の計画を作成'));
    await fireEvent.press(await screen.findByText('この計画を採用'));
    expect(alert.mock.calls.at(-1)?.[1]).toContain('途中の予定も組み直されます');
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    expect(await screen.findByTestId('planner-preview-stale')).toBeTruthy();
    expect(screen.getByTestId('planner-preview')).toBeTruthy();
    expect(test.provider.generate).toHaveBeenCalledTimes(1);
    expect(test.onSaved).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('再生成'));
    await fireEvent.press(await screen.findByText('この計画を採用'));
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
    expect(test.onSaved).toHaveBeenCalledTimes(1);
    expect(test.replan.getSnapshot).toHaveBeenCalledTimes(2);
    expect(test.provider.generate).toHaveBeenCalledTimes(2);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
  });
  it('warns that a zero-Action Proposal removes old scheduled Actions, and confirmation Cancel never saves', async () => {
    const test = setup(createTaskRepository([]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await render(<PlannerPreviewScreen {...test.props} />);
    await waitFor(() => expect(screen.getByText('残り時間の計画を作成')).not.toBeDisabled());
    await fireEvent.press(screen.getByText('残り時間の計画を作成'));
    await fireEvent.press(await screen.findByText('この計画を採用'));
    expect(alert.mock.calls.at(-1)?.[1]).toContain('旧計画の予定もすべて削除されます');
    expect(test.replan.replaceIfCurrent).not.toHaveBeenCalled();
    expect(screen.getByTestId('planner-preview')).toBeTruthy();
  });
});

describe('PlannerPreviewScreen', () => {
  it.each(['rule-based', 'openai'])(
    'retains a stale %s Preview, blocks approval, and permits explicit regeneration',
    async (id) => {
      let currentInstant = now();
      const provider: PlannerProvider = {
        id,
        generate: jest.fn(async (input: PlannerInput) =>
          new RuleBasedPlannerProvider().generate(input),
        ),
      };
      const persistence = createPersistenceRepository();
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const screen = await renderScreen(
        provider,
        createCalendarRepository(),
        createTaskRepository(),
        persistence,
        undefined,
        () => currentInstant,
      );

      await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
      expect(await screen.findByText('08:00–08:30')).toBeTruthy();
      currentInstant = new Date('2026-09-17T00:01:00.000Z');
      await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
      await act(async () => {
        await confirmLatestAlert(alert);
      });

      expect(await screen.findByTestId('planner-preview-stale')).toBeTruthy();
      expect(screen.getByText('状況が変わったため、計画を再生成してください。')).toBeTruthy();
      expect(screen.getByTestId('planner-preview')).toBeTruthy();
      expect(screen.getByText('08:00–08:30')).toBeTruthy();
      expect(screen.queryByTestId('planner-save-error')).toBeNull();
      expect(screen.queryByRole('button', { name: 'この計画を採用する' })).toBeNull();
      expect(persistence.savePlan).not.toHaveBeenCalled();
      expect(provider.generate).toHaveBeenCalledTimes(1);

      await fireEvent.press(
        screen.getByRole('button', { name: '最新データで今日の計画を再生成する' }),
      );
      expect(await screen.findByText('09:01–09:31')).toBeTruthy();
      expect(screen.queryByTestId('planner-preview-stale')).toBeNull();
      expect(provider.generate).toHaveBeenCalledTimes(2);
      await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
      await act(async () => {
        await confirmLatestAlert(alert);
      });
      expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
      expect(persistence.savePlan).toHaveBeenCalledTimes(1);
      expect(provider.generate).toHaveBeenCalledTimes(2);
      expect(persistence.savePlan.mock.calls[0][0].actions[0].startAt).toBe(
        '2026-09-17T00:01:00.000Z',
      );
    },
  );

  it('retains the stale Preview and regeneration controls across an app refresh', async () => {
    let currentInstant = now();
    const shared = {
      calendarRepository: createCalendarRepository(),
      goalRepository: createGoalRepository(),
      now: () => currentInstant,
      persistenceRepository: createPersistenceRepository(),
      provider: new RuleBasedPlannerProvider(),
      settingsRepository: createSettingsRepository(),
      taskRepository: createTaskRepository(),
    };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await render(<PlannerPreviewScreen {...shared} />);
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await screen.findByTestId('planner-preview');
    currentInstant = new Date('2026-09-17T00:01:00.000Z');
    await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    await screen.findByTestId('planner-preview-stale');

    await screen.rerender(<PlannerPreviewScreen {...shared} refreshToken={1} />);
    expect(await screen.findByTestId('planner-preview-stale')).toBeTruthy();
    expect(screen.getByText('08:00–08:30')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '最新データで今日の計画を再生成する' }),
    ).not.toBeDisabled();
    expect(shared.persistenceRepository.savePlan).not.toHaveBeenCalled();
  });

  it('shows a check error with the Preview retained when fresh data cannot be read', async () => {
    const tasks = createTaskRepository();
    const provider = new RuleBasedPlannerProvider();
    const generate = jest.spyOn(provider, 'generate');
    const persistence = createPersistenceRepository();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(provider, createCalendarRepository(), tasks, persistence);
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await screen.findByTestId('planner-preview');
    tasks.list.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });

    expect(await screen.findByTestId('planner-approval-check-error')).toBeTruthy();
    expect(screen.getByTestId('planner-preview')).toBeTruthy();
    expect(screen.queryByTestId('planner-save-error')).toBeNull();
    expect(screen.queryByTestId('planner-preview-stale')).toBeNull();
    expect(persistence.savePlan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: '計画の承認を再試行する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('ignores a confirmation belonging to a Preview that has since been regenerated', async () => {
    const persistence = createPersistenceRepository();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      createTaskRepository(),
      persistence,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'この計画を採用する' }));
    await fireEvent.press(
      screen.getByRole('button', { name: '最新データで今日の計画を再生成する' }),
    );
    await screen.findByTestId('planner-preview');
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    expect(persistence.savePlan).not.toHaveBeenCalled();
  });

  it('does not save if the screen unmounts during the approval check', async () => {
    const tasks = createTaskRepository();
    const taskData = await tasks.list();
    let resolveTasks: ((tasks: typeof taskData) => void) | undefined;
    const persistence = createPersistenceRepository();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      tasks,
      persistence,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await screen.findByTestId('planner-preview');
    tasks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTasks = resolve;
        }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
    let approval: Promise<void> | undefined;
    await act(async () => {
      approval = confirmLatestAlert(alert);
      await Promise.resolve();
    });
    await waitFor(() => expect(resolveTasks).toBeDefined());
    expect(screen.getByRole('button', { name: 'この計画を採用する' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '最新データで今日の計画を再生成する' }),
    ).toBeDisabled();
    await screen.unmount();
    await act(async () => {
      resolveTasks!(taskData);
      await approval;
    });
    expect(persistence.savePlan).not.toHaveBeenCalled();
  });

  it('shows unavailable OpenAI but only permits selection when available', async () => {
    const onSelectProvider = jest.fn();
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      createTaskRepository(),
      createPersistenceRepository(),
      { onSelectProvider, openAiAvailability: 'unavailable' },
    );
    expect(screen.getByText('現在利用できません')).toBeTruthy();
    expect(screen.getByTestId('planner-provider-openai')).toBeDisabled();
    fireEvent.press(screen.getByTestId('planner-provider-openai'));
    expect(onSelectProvider).not.toHaveBeenCalled();

    await screen.rerender(
      <PlannerPreviewScreen
        calendarRepository={createCalendarRepository()}
        goalRepository={createGoalRepository()}
        now={now}
        onSelectProvider={onSelectProvider}
        openAiAvailability="available"
        persistenceRepository={createPersistenceRepository()}
        provider={new RuleBasedPlannerProvider()}
        settingsRepository={createSettingsRepository()}
        taskRepository={createTaskRepository()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('planner-provider-openai')).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId('planner-provider-openai'));
    expect(onSelectProvider).toHaveBeenCalledWith('openai');
  });

  it('discards an old Preview when the selected provider changes', async () => {
    const calendarRepository = createCalendarRepository();
    const goalRepository = createGoalRepository();
    const taskRepository = createTaskRepository();
    const settingsRepository = createSettingsRepository();
    const persistenceRepository = createPersistenceRepository();
    const ruleBased = new RuleBasedPlannerProvider();
    const openAi: PlannerProvider = {
      id: 'openai',
      generate: jest.fn(async () => {
        throw new Error('upstream');
      }),
    };
    const shared = {
      calendarRepository,
      goalRepository,
      now,
      persistenceRepository,
      settingsRepository,
      taskRepository,
    };
    const screen = await render(<PlannerPreviewScreen {...shared} provider={ruleBased} />);
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    expect(screen.getByText('生成方法: RuleBased')).toBeTruthy();

    await screen.rerender(<PlannerPreviewScreen {...shared} provider={openAi} />);
    await waitFor(() => expect(screen.queryByTestId('planner-preview')).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: '今日の計画を作成する' }));
    expect(await screen.findByTestId('planner-provider-error')).toBeTruthy();
    expect(openAi.generate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('planner-preview')).toBeNull();
  });

  it('uses the same approval and persistence flow for a validated OpenAI proposal', async () => {
    const provider: PlannerProvider = {
      id: 'openai',
      generate: jest.fn(async () => ({
        actions: [
          {
            endAt: '2026-09-16T23:30:00.000Z',
            reason: '朝の学習に適しています。',
            startAt: '2026-09-16T23:00:00.000Z',
            taskId: shortTaskId,
            title: '朝の復習',
          },
        ],
        date: '2026-09-17',
        summary: '1件を配置しました。',
        unscheduled: [{ taskId: oversizedTaskId, reason: '連続した空き時間が足りません。' }],
      })),
    };
    const persistenceRepository = createPersistenceRepository();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      provider,
      createCalendarRepository(),
      createTaskRepository(),
      persistenceRepository,
    );

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    expect(await screen.findByText('生成方法: OpenAI')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });
    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
    expect(persistenceRepository.savePlan).toHaveBeenCalledTimes(1);
  });

  it('generates and displays a validated temporary Preview from repository data', async () => {
    const taskRepository = createTaskRepository();
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      taskRepository,
    );

    expect(await screen.findByText('2026年9月17日（木）')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '今日の計画を作成する' }));

    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    expect(screen.getByText('1件を予定に配置し、1件を未配置としました。')).toBeTruthy();
    expect(screen.getByText('08:00–08:30')).toBeTruthy();
    expect(screen.getByText('朝の復習')).toBeTruthy();
    expect(screen.getByText('長時間Task')).toBeTruthy();
    expect(screen.getByText(/推定所要時間を連続して確保/)).toBeTruthy();
    expect(screen.getByText('この計画はまだ保存されていません。')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'この計画を採用する' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'プレビューを閉じる' }));
    expect(screen.getByTestId('planner-idle-state')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '今日の計画を作成する' }));
    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    expect(taskRepository.list).toHaveBeenCalledTimes(2);
  });

  it('uses the existing Calendar permission policy before enabling generation', async () => {
    const repository = createCalendarRepository({
      getPermission: jest.fn(
        async () => ({ canAskAgain: true, status: 'undetermined' }) satisfies CalendarPermission,
      ),
    });
    const screen = await renderScreen(new RuleBasedPlannerProvider(), repository);

    expect(await screen.findByTestId('planner-permission-prompt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '今日の計画を作成する' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'アクセスを許可する' }));

    expect(await screen.findByRole('button', { name: '今日の計画を作成する' })).toBeTruthy();
    expect(repository.requestPermission).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'provider',
      {
        generate: jest.fn(async () => Promise.reject(new Error('provider failed'))),
        id: 'throwing-provider',
      } satisfies PlannerProvider,
      'planner-provider-error',
    ],
    [
      'validation',
      {
        generate: jest.fn(async () => 'invalid proposal'),
        id: 'invalid-provider',
      } satisfies PlannerProvider,
      'planner-validation-error',
    ],
  ])('shows a distinct %s error state', async (_label, provider, testID) => {
    const screen = await renderScreen(provider);

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));

    expect(await screen.findByTestId(testID)).toBeTruthy();
  });

  it('shows warnings without hiding a valid Preview', async () => {
    const warningProvider: PlannerProvider = {
      generate: jest.fn(async () => ({
        actions: [
          {
            endAt: '2026-09-16T23:20:00.000Z',
            reason: '警告確認用の配置です。',
            startAt: '2026-09-16T23:00:00.000Z',
            taskId: shortTaskId,
            title: '朝の復習',
          },
        ],
        date: '2026-09-17',
        summary: '1件を配置しました。',
        unscheduled: [],
      })),
      id: 'warning-provider',
    };
    const screen = await renderScreen(
      warningProvider,
      createCalendarRepository(),
      createTaskRepository([
        {
          deadline: null,
          estimatedMinutes: 30,
          goalId: null,
          id: shortTaskId,
          priority: 'medium',
          status: 'pending',
          title: '朝の復習',
        },
      ]),
    );

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));

    expect(await screen.findByTestId('planner-preview')).toBeTruthy();
    expect(screen.getByTestId('planner-warnings')).toBeTruthy();
    expect(screen.getByText(/does not match estimatedMinutes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'この計画を採用する' })).toBeTruthy();
  });

  it('does not show Approval for idle or invalid Preview states', async () => {
    const provider: PlannerProvider = {
      generate: jest.fn(async () => 'invalid proposal'),
      id: 'invalid-provider',
    };
    const screen = await renderScreen(provider);

    expect(screen.queryByRole('button', { name: 'この計画を採用する' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    expect(await screen.findByTestId('planner-validation-error')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'この計画を採用する' })).toBeNull();
  });

  it('confirms, disables competing actions while saving, and shows save success', async () => {
    let resolveSave:
      ((value: Awaited<ReturnType<PlannerPersistenceRepository['savePlan']>>) => void) | undefined;
    const persistenceRepository = createPersistenceRepository(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      createTaskRepository(),
      persistenceRepository,
    );

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await screen.findByTestId('planner-preview');
    await fireEvent.press(screen.getByRole('button', { name: 'この計画を採用する' }));

    expect(alert).toHaveBeenCalledWith(
      'この計画を採用しますか？',
      expect.stringContaining('既存の計画'),
      expect.any(Array),
    );
    let saveRequest: Promise<void> | undefined;
    await act(async () => {
      saveRequest = confirmLatestAlert(alert);
      await Promise.resolve();
    });

    await waitFor(() => expect(persistenceRepository.savePlan).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'この計画を採用する' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '最新データで今日の計画を再生成する' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'プレビューを閉じる' })).toBeDisabled();
    expect(resolveSave).toBeDefined();

    await act(async () => {
      resolveSave!({ actionCount: 1, id: dailyPlanId, planDate: '2026-09-17' });
      await saveRequest;
    });

    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
    expect(screen.getByText('今日の計画を保存しました')).toBeTruthy();
    expect(screen.getByText('この計画は保存済みです。')).toBeTruthy();
  });

  it('keeps the Preview after save failure and retries the same validated Proposal', async () => {
    const persistenceRepository = createPersistenceRepository(
      jest
        .fn<
          ReturnType<PlannerPersistenceRepository['savePlan']>,
          Parameters<PlannerPersistenceRepository['savePlan']>
        >()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ actionCount: 1, id: dailyPlanId, planDate: '2026-09-17' }),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      createTaskRepository(),
      persistenceRepository,
    );

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'この計画を採用する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });

    expect(await screen.findByTestId('planner-save-error')).toBeTruthy();
    expect(screen.getByTestId('planner-preview')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '計画の保存を再試行する' }));
    await act(async () => {
      await confirmLatestAlert(alert);
    });

    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
    expect(persistenceRepository.savePlan).toHaveBeenCalledTimes(2);
    expect(persistenceRepository.savePlan.mock.calls[1][0]).toEqual(
      persistenceRepository.savePlan.mock.calls[0][0],
    );
  });

  it('does not save after confirmation cancel and ignores duplicate confirmations', async () => {
    let resolveSave:
      ((value: Awaited<ReturnType<PlannerPersistenceRepository['savePlan']>>) => void) | undefined;
    const persistenceRepository = createPersistenceRepository(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await renderScreen(
      new RuleBasedPlannerProvider(),
      createCalendarRepository(),
      createTaskRepository(),
      persistenceRepository,
    );

    await fireEvent.press(await screen.findByRole('button', { name: '今日の計画を作成する' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'この計画を採用する' }));
    expect(persistenceRepository.savePlan).not.toHaveBeenCalled();

    let firstSaveRequest: Promise<void> | undefined;
    await act(async () => {
      firstSaveRequest = confirmLatestAlert(alert);
      await confirmLatestAlert(alert);
      await Promise.resolve();
    });
    await waitFor(() => expect(persistenceRepository.savePlan).toHaveBeenCalledTimes(1));
    expect(resolveSave).toBeDefined();

    await act(async () => {
      resolveSave!({ actionCount: 1, id: dailyPlanId, planDate: '2026-09-17' });
      await firstSaveRequest;
    });
    expect(await screen.findByTestId('planner-save-success')).toBeTruthy();
  });
});
