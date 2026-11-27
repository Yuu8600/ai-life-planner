import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { Task, TaskRepository } from '@/features/tasks';
import { EventEditor } from '@/features/planner/v2/EventEditor';
import { ActionStepsScreen } from '@/features/recommendations/ActionStepsScreen';
import {
  DEFAULT_CONDITIONS,
  type RecommendationRepository,
} from '@/features/recommendations/repository';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';

jest.mock('@/shared/components/DeadlineCalendar', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DeadlineCalendar: ({ onChange }: { onChange: (value: string) => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="カレンダーで明日を選ぶ"
        onPress={() => onChange('2026-11-28')}
      >
        <Text>明日</Text>
      </Pressable>
    ),
  };
});

const task: Task = {
  id: 'parent',
  title: '元のタスク',
  userId: 'user',
  goalId: null,
  estimatedMinutes: 15,
  deadline: null,
  localDeadline: null,
  priority: 'medium',
  status: 'pending',
  createdAt: '',
  updatedAt: '',
};
function tasks(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    list: jest.fn(async () => [task]),
    findById: jest.fn(async () => task),
    listGoalOptions: jest.fn(async () => []),
    update: jest.fn(async (_id, input) => ({ ...task, ...input })),
    create: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}
function recommendations(): RecommendationRepository {
  return {
    listSteps: jest.fn(async () => []),
    listResults: jest.fn(async () => []),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    record: jest.fn(),
    undo: jest.fn(),
  };
}
beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

async function showToday(repository: TaskRepository) {
  return render(
    <TodayRecommendationsScreen
      date="2026-11-27"
      timezone="Asia/Tokyo"
      revision={0}
      initialConditions={DEFAULT_CONDITIONS}
      saveConditions={jest.fn()}
      openSettings={jest.fn()}
      openTasks={jest.fn()}
      openStep={jest.fn()}
      taskRepository={repository}
      repository={recommendations()}
    />,
  );
}
async function openEditor(screen: Awaited<ReturnType<typeof showToday>>) {
  await fireEvent.press(screen.getByRole('button', { name: '元のタスクの詳細を開く' }));
  const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを編集' }));
  // The form cannot be presented until UIKit reports the preceding dismissal.
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  await act(() => dismiss());
}

it('keeps task edits on save failure and requires discard before closing without saving', async () => {
  const repository = tasks({
    update: jest.fn().mockRejectedValue(new Error('Network request failed')),
  });
  const screen = await showToday(repository);
  await openEditor(screen);
  await fireEvent.press(screen.getByRole('button', { name: 'タスクフォームを閉じる' }));
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  expect(Alert.alert).not.toHaveBeenCalled();
  await openEditor(screen);
  await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '未保存');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByLabelText('タスクタイトル').props.value).toBe('未保存');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクフォームを閉じる' }));
  expect(screen.getByTestId('task-form-modal')).toBeTruthy();
  const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(() => actions?.find((action) => action.style === 'cancel')?.onPress?.());
  expect(screen.getByLabelText('タスクタイトル').props.value).toBe('未保存');
  await act(() => actions?.find((action) => action.style === 'destructive')?.onPress?.());
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  expect(repository.update).toHaveBeenCalledTimes(1);
});

it('blocks duplicate saves and dismissal while saving, preserving the original deadline instant', async () => {
  let finish!: (task: Task) => void;
  const original = { ...task, deadline: '2026-11-28T14:59:59.123Z', localDeadline: '2026-11-28' };
  const repository = tasks({
    findById: jest.fn(async () => original),
    update: jest.fn(
      () =>
        new Promise<Task>((resolve) => {
          finish = resolve;
        }),
    ),
  });
  const screen = await showToday(repository);
  await openEditor(screen);
  await fireEvent.changeText(screen.getByLabelText('タスクの所要時間'), '25');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存中' }));
  await fireEvent.press(screen.getByRole('button', { name: 'タスクフォームを閉じる' }));
  expect(repository.update).toHaveBeenCalledTimes(1);
  expect(repository.update).toHaveBeenCalledWith(
    task.id,
    expect.objectContaining({ deadline: original.deadline, estimatedMinutes: 25 }),
  );
  expect(screen.getByTestId('task-form-modal')).toBeTruthy();
  await act(() => finish({ ...original, estimatedMinutes: 25 }));
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
});

it('handles missing Tasks and retries without permitting a write to the wrong target', async () => {
  const repository = tasks({
    findById: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(task),
  });
  const screen = await showToday(repository);
  await fireEvent.press(screen.getByRole('button', { name: '元のタスクの詳細を開く' }));
  const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを編集' }));
  expect(screen.getByText('対象のタスクが見つかりません。画面を更新してください。')).toBeTruthy();
  expect(screen.queryByLabelText('タスクタイトル')).toBeNull();
  expect(repository.update).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを編集' }));
  await act(() => dismiss());
  expect(screen.getByLabelText('タスクタイトル').props.value).toBe(task.title);
});

it('cancels a Today edit without changing the recommendation or writing', async () => {
  const repository = tasks();
  const screen = await showToday(repository);
  await openEditor(screen);
  await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '破棄するタスク');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクフォームを閉じる' }));
  const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(() => actions?.find((action) => action.style === 'destructive')?.onPress?.());
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  expect(screen.getByRole('button', { name: '元のタスクの詳細を開く' })).toBeTruthy();
  expect(repository.update).not.toHaveBeenCalled();
});

it('ignores a Task load that completes after candidate details are closed', async () => {
  let finish!: (task: Task) => void;
  const repository = tasks({
    findById: jest.fn(
      () =>
        new Promise<Task>((resolve) => {
          finish = resolve;
        }),
    ),
  });
  const screen = await showToday(repository);
  await fireEvent.press(screen.getByRole('button', { name: '元のタスクの詳細を開く' }));
  const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを編集' }));
  await fireEvent.press(screen.getByRole('button', { name: '詳細を閉じる' }));
  await act(() => dismiss());
  await act(() => finish(task));
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  expect(repository.update).not.toHaveBeenCalled();
});

it('guards new events only after changes, and preserves failed saves', async () => {
  const close = jest.fn(),
    save = jest.fn().mockRejectedValue(new Error('保存失敗'));
  const screen = await render(
    <EventEditor date="2026-11-27" timezone="Asia/Tokyo" close={close} save={save} fixedOnly />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(close).toHaveBeenCalledTimes(1);
  close.mockClear();
  await fireEvent.changeText(screen.getByLabelText('予定名'), '打ち合わせ');
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '予定を保存' }));
  expect(screen.getByText('保存失敗')).toBeTruthy();
  expect(screen.getByLabelText('予定名').props.value).toBe('打ち合わせ');
  await fireEvent.changeText(screen.getByLabelText('予定名'), '');
  jest.mocked(Alert.alert).mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
});

it('guards step drafts, supports reverting to the initial values, and saves explicitly', async () => {
  const repository = recommendations();
  jest.mocked(repository.addStep).mockImplementation(async (taskId, input) => ({
    ...input,
    id: 'step',
    createdAt: '2026-11-27',
    taskId,
    completed: false,
  }));
  const screen = await render(
    <ActionStepsScreen
      taskId={task.id}
      revision={0}
      dayError=""
      refreshDay={jest.fn()}
      tasks={tasks()}
      repository={repository}
      close={jest.fn()}
      openAI={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '詳細を指定して小さな行動を追加' }));
  await fireEvent.changeText(screen.getByLabelText('小さな行動の名前'), '最初の一歩');
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(repository.addStep).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(screen.getByLabelText('小さな行動の名前'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('小さな行動の名前')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '詳細を指定して小さな行動を追加' }));
  await fireEvent.changeText(screen.getByLabelText('小さな行動の名前'), '最初の一歩');
  await fireEvent.press(screen.getByRole('button', { name: '保存' }));
  expect(repository.addStep).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByLabelText('小さな行動の名前')).toBeNull());
  expect(screen.getByText('最初の一歩')).toBeTruthy();
});

it('saves a changed deadline from Today in the profile timezone and refreshes the candidate', async () => {
  let currentTask = task;
  const repository = tasks({
    list: jest.fn(async () => [currentTask]),
    update: jest.fn(async (_id, input) => {
      currentTask = { ...currentTask, ...input };
      return currentTask;
    }),
  });
  const screen = await showToday(repository);
  await openEditor(screen);
  await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、期限なし' }));
  await fireEvent.press(screen.getByRole('button', { name: 'カレンダーで明日を選ぶ' }));
  expect(repository.update).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '日付を決定' }));
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
  expect(repository.update).toHaveBeenCalledWith(
    task.id,
    expect.objectContaining({ localDeadline: '2026-11-28', deadline: '2026-11-28T14:59:59.999Z' }),
  );
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  expect(await screen.findByText('明日が期限')).toBeTruthy();
});
