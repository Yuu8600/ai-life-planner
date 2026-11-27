import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ActionStepsExitGuard } from '@/navigation/ActionStepsExitGuard';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DEMO_SETTINGS } from '@/services/demo/sampleData';
import type { SettingsRepository } from '@/features/settings';
import { ActionStepsScreen } from '@/features/recommendations/ActionStepsScreen';
import type { ActionStep, RecommendationRepository } from '@/features/recommendations/repository';
import type { Task, TaskRepository } from '@/features/tasks';

const mockDispatch = jest.fn();
const mockPreventRemove = jest.fn();
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));

async function gap(screen: Awaited<ReturnType<typeof render>>, value: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^異なるタスク間の余裕、/ }));
  if (!screen.queryByLabelText('異なるタスク間の余裕の詳細（分）'))
    await fireEvent.press(screen.getByRole('button', { name: 'その他' }));
  await fireEvent.changeText(screen.getByLabelText('異なるタスク間の余裕の詳細（分）'), value);
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
}
function settingsRepository(fail = false): SettingsRepository {
  return {
    getProfilePlanningSettings: jest.fn(async () => ({ ...DEMO_SETTINGS, taskGapMinutes: 30 })),
    updateProfilePlanningSettings: jest.fn(async (input) => {
      if (fail) throw new Error('Network request failed');
      return input;
    }),
  };
}
it('has one dirty save for timezone and gap together, and hides unchanged save controls', async () => {
  const repository = settingsRepository();
  const screen = await render(<SettingsScreen repository={repository} onPressBack={jest.fn()} />);
  await screen.findByTestId('planning-settings-form');
  expect(screen.queryByTestId('settings-save-area')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '時間割専用の設定を表示' }));
  await gap(screen, '45');
  await fireEvent.changeText(screen.getByLabelText('タイムゾーン'), 'America/New_York');
  expect(screen.queryByText('作業枠の間隔を保存')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'プロフィール設定を保存する' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
  expect(repository.updateProfilePlanningSettings).toHaveBeenCalledTimes(1);
  expect(repository.updateProfilePlanningSettings).toHaveBeenCalledWith(
    expect.objectContaining({
      timezone: 'America/New_York',
      taskGapMinutes: 45,
      planningStart: DEMO_SETTINGS.planningStart,
    }),
  );
  expect(await screen.findByText('設定を保存しました。')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'プロフィール設定を保存する' })).toBeNull();
});
it('guards gap-only edits, preserves them on save failure, and becomes clean when reverted', async () => {
  const repository = settingsRepository(true),
    close = jest.fn();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(<SettingsScreen repository={repository} onPressBack={close} />);
    await fireEvent.press(await screen.findByRole('button', { name: '時間割専用の設定を表示' }));
    await gap(screen, '45');
    await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定を保存する' }));
    expect(screen.getByRole('button', { name: '異なるタスク間の余裕、45分' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(alert).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    await act(() =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((button) => button.style === 'cancel')
        ?.onPress?.(),
    );
    await gap(screen, '30');
    await fireEvent.press(screen.getByRole('button', { name: '設定を閉じる' }));
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});

const task: Task = {
  id: 'task',
  title: '親タスク',
  userId: 'user',
  goalId: null,
  deadline: null,
  priority: 'medium',
  status: 'pending',
  estimatedMinutes: 30,
  createdAt: '',
  updatedAt: '',
};
function stepSources() {
  let steps: ActionStep[] = [];
  const tasks: TaskRepository = {
    findById: jest.fn(async () => task),
    list: jest.fn(),
    listGoalOptions: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const repository: RecommendationRepository = {
    listSteps: jest.fn(async () => [...steps]),
    listResults: jest.fn(async () => []),
    addStep: jest.fn(async (taskId, input) => {
      const saved = { ...input, id: String(steps.length), taskId, createdAt: '', completed: false };
      steps = [...steps, saved];
      return saved;
    }),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    record: jest.fn(),
    undo: jest.fn(),
  };
  return { tasks, repository };
}
async function showSteps(sources = stepSources(), close = jest.fn()) {
  const screen = await render(
    <ActionStepsScreen
      {...sources}
      taskId="task"
      date="2026-11-27"
      revision={0}
      dayError=""
      refreshDay={jest.fn()}
      close={close}
      openAI={jest.fn()}
    />,
  );
  await screen.findByLabelText('追加する小さな行動の名前');
  return { screen, ...sources, close };
}
it('adds consecutive steps from keyboard completion without presenting a modal', async () => {
  const { screen, repository } = await showSteps();
  for (const title of ['一歩目', '二歩目']) {
    await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の名前'), title);
    await fireEvent(screen.getByLabelText('追加する小さな行動の名前'), 'submitEditing');
    await waitFor(() =>
      expect(screen.getByLabelText('追加する小さな行動の名前').props.value).toBe(''),
    );
    expect(screen.getByText(title)).toBeTruthy();
  }
  expect(repository.addStep).toHaveBeenCalledTimes(2);
  expect(repository.addStep).toHaveBeenCalledWith(
    'task',
    expect.objectContaining({ minutes: null, repeatable: false }),
  );
  expect(screen.queryByLabelText('小さな行動の名前')).toBeNull();
});
it('keeps failed inline input, validates minutes, and protects unsaved navigation', async () => {
  const sources = stepSources();
  jest.mocked(sources.repository.addStep).mockRejectedValue(new Error('network'));
  const { screen, close } = await showSteps(sources);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の名前'), '残す入力');
    await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の所要時間'), '0');
    await fireEvent.press(screen.getByRole('button', { name: '小さな行動をクイック追加' }));
    expect(sources.repository.addStep).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の所要時間'), '10');
    await fireEvent.press(screen.getByRole('button', { name: '小さな行動をクイック追加' }));
    expect(screen.getByLabelText('追加する小さな行動の名前').props.value).toBe('残す入力');
    expect(screen.getByText('小さな行動を保存できませんでした。再試行してください。')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
    expect(close).not.toHaveBeenCalled();
    await act(() =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((button) => button.style === 'destructive')
        ?.onPress?.(),
    );
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});
it('shares the inline draft with detailed creation, saving it only once', async () => {
  const { screen, repository } = await showSteps();
  await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の名前'), '引き継ぐ名前');
  await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の所要時間'), '12');
  await fireEvent.press(screen.getByRole('button', { name: '詳細を指定して小さな行動を追加' }));
  expect(screen.getByLabelText('小さな行動の名前').props.value).toBe('引き継ぐ名前');
  expect(screen.getByLabelText('小さな行動の所要時間').props.value).toBe('12');
  await fireEvent.press(screen.getByRole('button', { name: '保存' }));
  expect(repository.addStep).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('追加する小さな行動の名前').props.value).toBe('');
});

it('resumes the exact native back action only after discard and blocks removal while saving', async () => {
  mockDispatch.mockClear();
  mockPreventRemove.mockClear();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(<ActionStepsExitGuard dirty pending={false} />);
    const action = { type: 'POP', source: 'steps' };
    await act(() => mockPreventRemove.mock.calls.at(-1)?.[1]({ data: { action } }));
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(() =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((button) => button.style === 'destructive')
        ?.onPress?.(),
    );
    expect(mockDispatch).toHaveBeenCalledWith(action);
    await screen.rerender(<ActionStepsExitGuard dirty pending />);
    await act(() => mockPreventRemove.mock.calls.at(-1)?.[1]({ data: { action } }));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});
it('blocks repeated inline submission and return while a write is pending', async () => {
  const sources = stepSources();
  let finish!: (value: ActionStep) => void;
  jest.mocked(sources.repository.addStep).mockImplementation(
    () =>
      new Promise<ActionStep>((resolve) => {
        finish = resolve;
      }),
  );
  const { screen, close } = await showSteps(sources);
  await fireEvent.changeText(screen.getByLabelText('追加する小さな行動の名前'), '一歩');
  await fireEvent(screen.getByLabelText('追加する小さな行動の名前'), 'submitEditing');
  await fireEvent(screen.getByLabelText('追加する小さな行動の名前'), 'submitEditing');
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(sources.repository.addStep).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  await act(() =>
    finish({
      id: 'created',
      taskId: 'task',
      title: '一歩',
      minutes: null,
      effort: null,
      repeatable: false,
      createdAt: '',
      completed: false,
    }),
  );
  expect(screen.getByLabelText('追加する小さな行動の名前').props.value).toBe('');
});
