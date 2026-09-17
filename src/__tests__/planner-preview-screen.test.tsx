import { fireEvent, render } from '@testing-library/react-native';

import type { CalendarPermission, CalendarRepository } from '@/features/calendar';
import { PlannerPreviewScreen } from '@/features/planner/PlannerPreviewScreen';
import { RuleBasedPlannerProvider, type PlannerProvider } from '@/features/planner';
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

async function renderScreen(
  provider: PlannerProvider = new RuleBasedPlannerProvider(),
  calendarRepository = createCalendarRepository(),
  taskRepository = createTaskRepository(),
) {
  return render(
    <PlannerPreviewScreen
      calendarRepository={calendarRepository}
      goalRepository={createGoalRepository()}
      now={now}
      onOpenSettings={jest.fn()}
      provider={provider}
      settingsRepository={createSettingsRepository()}
      taskRepository={taskRepository}
    />,
  );
}

describe('PlannerPreviewScreen', () => {
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
    expect(screen.queryByRole('button', { name: /保存|適用/ })).toBeNull();

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
  });
});
