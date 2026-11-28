import type { AlertButton } from 'react-native';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  CreateTaskInput,
  Task,
  TaskRepository,
  UpdateTaskInput,
} from '@/features/tasks/repositories/TaskRepository';
import { TasksScreen } from '@/features/tasks/TasksScreen';

const userId = '11111111-1111-4111-8111-111111111111';
const goalId = '22222222-2222-4222-8222-222222222222';

const task: Task = {
  createdAt: '2026-09-13T00:00:00+00:00',
  deadline: '2026-10-25T14:59:59.999Z',
  estimatedMinutes: 30,
  goalId,
  id: '33333333-3333-4333-8333-333333333333',
  priority: 'high',
  status: 'scheduled',
  title: 'TOEIC Listening',
  updatedAt: '2026-09-13T00:00:00+00:00',
  userId,
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

function createRepository(overrides: Partial<jest.Mocked<TaskRepository>> = {}) {
  return {
    create: jest.fn(async (input) => ({ ...task, ...input })),
    findById: jest.fn(async () => task),
    list: jest.fn(async () => [task]),
    listGoalOptions: jest.fn(async () => [{ id: goalId, title: 'TOEIC' }]),
    remove: jest.fn(async () => undefined),
    update: jest.fn(async (_id, input) => ({ ...task, ...input })),
    ...overrides,
  } as jest.Mocked<TaskRepository>;
}

describe('TasksScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the supplied Demo clock for the today filter instead of the real date', async () => {
    const now = new Date(2035, 4, 10, 8);
    const deadline = new Date(2035, 4, 10, 23, 59).toISOString();
    const repository = createRepository({ list: jest.fn(async () => [{ ...task, deadline }]) });
    const screen = await render(<TasksScreen now={now} repository={repository} />);
    expect(await screen.findByText('TOEIC Listening')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '今日が期限のタスクを表示' }));
    expect(screen.getByText('TOEIC Listening')).toBeTruthy();
    await screen.rerender(<TasksScreen now={new Date(2035, 4, 11, 8)} repository={repository} />);
    expect(screen.queryByText('TOEIC Listening')).toBeNull();
  });

  it('shows a loading state until tasks are fetched', async () => {
    const deferred = createDeferred<Task[]>();
    const repository = createRepository({ list: jest.fn(() => deferred.promise) });
    const screen = await render(<TasksScreen repository={repository} />);

    expect(screen.getByTestId('tasks-loading-state')).toBeTruthy();

    deferred.resolve([task]);
    expect(await screen.findByText('TOEIC Listening')).toBeTruthy();
  });

  it('shows an empty state when the signed-in user has no tasks', async () => {
    const repository = createRepository({ list: jest.fn(async () => []) });
    const screen = await render(<TasksScreen repository={repository} />);

    expect(await screen.findByTestId('tasks-empty-state')).toBeTruthy();
    expect(screen.getByText('まだタスクがありません')).toBeTruthy();
  });

  it('shows a safe Japanese error and retries a failed Task fetch', async () => {
    const list = jest
      .fn<ReturnType<TaskRepository['list']>, Parameters<TaskRepository['list']>>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce([task]);
    const repository = createRepository({ list });
    const screen = await render(<TasksScreen repository={repository} />);

    expect(
      await screen.findByText(
        'タスクデータに接続できません。通信状況を確認して再度お試しください。',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));
    expect(await screen.findByText('TOEIC Listening')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not expose CRUD controls or invoke a repository without authentication', async () => {
    const screen = await render(<TasksScreen repository={null} />);

    expect(await screen.findByText('タスクを表示するにはログインが必要です。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '新しいタスクを作成する' })).toBeNull();
  });

  it('creates a Goalなし task and immediately adds it to the list', async () => {
    const createdTask = { ...task, goalId: null, id: 'new-task-id', title: '金フレ' };
    const repository = createRepository({
      create: jest.fn(async (_input: CreateTaskInput) => createdTask),
      list: jest.fn(async () => []),
    });
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByTestId('tasks-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しいタスクを作成する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '金フレ');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));

    expect(await screen.findByText('金フレ')).toBeTruthy();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: null, status: 'pending', title: '金フレ' }),
    );
  });

  it('creates a task associated with one of the signed-in user Goals', async () => {
    const repository = createRepository({ list: jest.fn(async () => []) });
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByTestId('tasks-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しいタスクを作成する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), 'Part 5');
    await fireEvent.press(screen.getByLabelText('Goal TOEIC'));
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));

    await waitFor(() => {
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ goalId }));
    });
  });

  it('keeps Goalなし CRUD available when Goal options fail', async () => {
    const repository = createRepository({
      list: jest.fn(async () => []),
      listGoalOptions: jest.fn(async () => {
        throw new Error('Network request failed');
      }),
    });
    const screen = await render(<TasksScreen repository={repository} />);

    expect(
      await screen.findByText(
        'Goal候補に接続できません。「Goalなし」のタスクは引き続き操作できます。',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '新しいタスクを作成する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), 'Goal未設定タスク');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));

    await waitFor(() => {
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ goalId: null }));
    });
  });

  it('updates a Task and immediately replaces its rendered values', async () => {
    const updatedTask = { ...task, title: 'Part 5' };
    const repository = createRepository({
      update: jest.fn(async (_id: string, _input: UpdateTaskInput) => updatedTask),
    });
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByText('TOEIC Listening');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを編集する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), 'Part 5');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));

    expect(await screen.findByText('Part 5')).toBeTruthy();
    expect(screen.queryByText('TOEIC Listening')).toBeNull();
    expect(repository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ title: 'Part 5' }),
    );
  });

  it('deletes a confirmed Task and immediately removes it from the list', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = (buttons as AlertButton[] | undefined)?.find(
        (button) => button.style === 'destructive',
      );
      deleteButton?.onPress?.();
    });
    const repository = createRepository();
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByText('TOEIC Listening');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを削除する' }));

    await waitFor(() => expect(screen.queryByText('TOEIC Listening')).toBeNull());
    expect(repository.remove).toHaveBeenCalledWith(task.id);
    expect(screen.getByTestId('tasks-empty-state')).toBeTruthy();
  });

  it('prevents duplicate create submissions while Supabase is pending', async () => {
    const deferred = createDeferred<Task>();
    const create = jest.fn((_input: CreateTaskInput) => deferred.promise);
    const repository = createRepository({ create, list: jest.fn(async () => []) });
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByTestId('tasks-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しいタスクを作成する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '金フレ');
    const submitButton = screen.getByRole('button', { name: 'タスクを保存する' });
    await fireEvent.press(submitButton);
    await fireEvent.press(submitButton);

    expect(create).toHaveBeenCalledTimes(1);

    deferred.resolve({ ...task, id: 'new-task-id', title: '金フレ' });
    expect(await screen.findByText('金フレ')).toBeTruthy();
  });

  it('does not call Supabase when local validation fails', async () => {
    const repository = createRepository({ list: jest.fn(async () => []) });
    const screen = await render(<TasksScreen repository={repository} />);

    await screen.findByTestId('tasks-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しいタスクを作成する' }));
    await fireEvent.changeText(screen.getByLabelText('タスクの所要時間'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));

    expect(await screen.findByText('タイトルを入力してください。')).toBeTruthy();
    expect(screen.getByText('所要時間は1以上の整数で入力してください。')).toBeTruthy();
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe('Clear deletion controls', () => {
  afterEach(() => jest.restoreAllMocks());
  it('preserves confirmation cancellation without calling remove', async () => {
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) =>
        buttons?.find((button) => button.style === 'cancel')?.onPress?.(),
      );
    const repository = createRepository();
    const screen = await render(<TasksScreen repository={repository} />);
    await screen.findByText('TOEIC Listening');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを削除する' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(repository.remove).not.toHaveBeenCalled();
    expect(screen.getByText('TOEIC Listening')).toBeTruthy();
  });
  it('prevents duplicate delete and edit until the pending removal finishes', async () => {
    const pending = createDeferred<void>();
    const repository = createRepository({ remove: jest.fn((_id: string) => pending.promise) });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) =>
        buttons?.find((button) => button.style === 'destructive')?.onPress?.(),
      );
    const screen = await render(<TasksScreen repository={repository} />);
    await screen.findByText('TOEIC Listening');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを削除する' }));
    const deletion = screen.getByRole('button', { name: 'TOEIC Listeningを削除する' });
    expect(deletion.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(deletion);
    await fireEvent.press(screen.getByRole('button', { name: 'TOEIC Listeningを編集する' }));
    expect(repository.remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('task-form-modal')).toBeNull();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    await waitFor(() => expect(screen.queryByText('TOEIC Listening')).toBeNull());
  });
});

it('shows a recurring task inline with strikethrough after today completion without a row delete button and lets the user undo inline', async () => {
  const date = '2026-11-18';
  const dailyTask: Task = { ...task, recurrence: { kind: 'weekly', weekdays: [3] } };
  let completed = false;
  const recommendations = {
    listSteps: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    listResults: jest.fn(async () =>
      completed
        ? [
            {
              date,
              kind: 'task' as const,
              targetId: task.id,
              taskId: task.id,
              outcome: 'completed' as const,
              title: task.title,
              goalId,
            },
          ]
        : [],
    ),
    record: jest.fn(async () => {
      completed = true;
      return 'completed' as const;
    }),
    undo: jest.fn(async () => {
      completed = false;
    }),
  };
  const repository = createRepository({ list: jest.fn(async () => [dailyTask]) });
  const screen = await render(
    <TasksScreen
      repository={repository}
      recommendationMode
      recommendations={recommendations}
      planningTimezone="Asia/Tokyo"
      now={new Date(date + 'T04:00Z')}
    />,
  );
  expect(screen.queryByRole('button', { name: /作業タイマーを開く/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'TOEIC Listeningを削除' })).toBeNull();
  await fireEvent.press(
    await screen.findByRole('checkbox', { name: 'TOEIC Listeningの今日の実施を記録' }),
  );
  expect(recommendations.record).toHaveBeenCalledWith(date, 'task', task.id, 'completed');
  expect(await screen.findByRole('button', { name: '元に戻す' })).toBeTruthy();
  expect(screen.getByTestId('tasks-completed-section')).toBeTruthy();
  expect(screen.getByText('TOEIC Listening')).toHaveStyle({ textDecorationLine: 'line-through' });
  expect(await screen.findByText(/今日の実施済み/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'TOEIC Listeningを削除' })).toBeNull();
  const undo = screen.getByRole('checkbox', { name: 'TOEIC Listeningの今日の実施を取り消す' });
  expect(undo.props.accessibilityState.checked).toBe(true);
  await fireEvent.press(undo);
  expect(recommendations.undo).toHaveBeenCalledWith(date, 'task', task.id, 'completed');
  expect(screen.queryByTestId('tasks-completed-section')).toBeNull();
  expect(screen.getByText('TOEIC Listening')).not.toHaveStyle({
    textDecorationLine: 'line-through',
  });
  expect(repository.update).not.toHaveBeenCalled();

  await fireEvent.press(await screen.findByRole('button', { name: 'TOEIC Listeningを編集する' }));
  expect(screen.queryByText('状態')).toBeNull();
  expect(
    screen.getByRole('radio', { name: '繰り返し（任意） 曜日を選ぶ' }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(screen.getByRole('button', { name: 'タスクを削除' })).toBeTruthy();
});

it('limits inline row delete and bulk deletion to single-occurrence completed Tasks and confirms before writing', async () => {
  const date = '2026-11-18';
  const done: Task[] = [
    { ...task, title: '読み終えた本', status: 'completed' },
    { ...task, id: 'second', title: '送信したメール', status: 'completed' },
  ];
  const dailyTask: Task = {
    ...task,
    id: 'daily',
    title: '散歩',
    recurrence: { kind: 'daily', weekdays: [] },
  };
  const removeCompleted = jest.fn(async (_ids: string[]) => undefined);
  const repository = createRepository({
    list: jest.fn(async () => [...done, dailyTask]),
    removeCompleted,
  });
  const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const recommendations = {
    listSteps: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    listResults: jest.fn().mockResolvedValue([
      {
        date,
        kind: 'task',
        targetId: dailyTask.id,
        taskId: dailyTask.id,
        outcome: 'completed',
        title: dailyTask.title,
        goalId,
      },
    ]),
    record: jest.fn(),
    undo: jest.fn(),
    undoBatch: jest.fn(),
  };
  try {
    const screen = await render(
      <TasksScreen
        repository={repository}
        recommendationMode
        recommendations={recommendations}
        planningTimezone="Asia/Tokyo"
        now={new Date(date + 'T04:00Z')}
      />,
    );
    expect(await screen.findByText('読み終えた本')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
    expect(screen.getByText('散歩')).toHaveStyle({ textDecorationLine: 'line-through' });
    expect(screen.getByRole('button', { name: '読み終えた本を削除' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '送信したメールを削除' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '散歩を削除' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: '読み終えた本を削除' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toBe('タスクを削除しますか？');
    await act(async () =>
      confirm.mock.calls[0][2]?.find((button) => button.style === 'destructive')?.onPress?.(),
    );
    expect(repository.remove).toHaveBeenCalledWith(done[0].id);

    await fireEvent.press(screen.getByRole('button', { name: '完了済みをすべて削除' }));
    expect(removeCompleted).not.toHaveBeenCalled();
    const [title, message, actions] = confirm.mock.calls[1];
    expect(title).toBe('1件の完了済みタスクを削除しますか？');
    expect(message).toMatch(/実施記録や時間割の記録は残ります/);
    await act(async () => actions?.find((button) => button.style === 'destructive')?.onPress?.());
    expect(removeCompleted).toHaveBeenCalledWith([done[1].id]);
  } finally {
    confirm.mockRestore();
  }
});

it('defaults to all Tasks with a collapsible inline completed section, separates navigation from filters, and preserves overdue route entries', async () => {
  const date = '2026-11-27';
  const completed = { ...task, id: 'done', title: '完了した作業', status: 'completed' as const };
  const recurring = {
    ...task,
    id: 'repeat',
    title: '毎日の作業',
    recurrence: { kind: 'daily' as const, weekdays: [] },
    deadline: null,
  };
  const repository = createRepository({ list: jest.fn(async () => [task, completed, recurring]) });
  const recommendations = {
    listSteps: jest.fn(),
    addStep: jest.fn(),
    updateStep: jest.fn(),
    removeStep: jest.fn(),
    listResults: jest.fn(async () => []),
    record: jest.fn(),
    undo: jest.fn(),
  };
  const props = {
    repository,
    recommendations,
    recommendationMode: true,
    planningTimezone: 'Asia/Tokyo',
    now: new Date(date + 'T04:00Z'),
    onOpenGoals: jest.fn(),
  };
  const screen = await render(<TasksScreen {...props} />);
  expect(screen.getByRole('tab', { name: 'すべて（3）' }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(screen.getByText(completed.title)).toHaveStyle({ textDecorationLine: 'line-through' });
  expect(screen.getByRole('button', { name: '完了した作業を削除' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'TOEIC Listeningを削除' })).toBeNull();
  expect(screen.getByRole('button', { name: '目標' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '完了済み（1）' })).toBeNull();
  expect(screen.getByText('期限切れ 2026年10月25日')).toBeTruthy();
  expect(screen.getAllByText('優先度 高')).toHaveLength(2);

  await fireEvent.press(screen.getByRole('button', { name: '完了済み（1）を折りたたむ' }));
  expect(screen.queryByText(completed.title)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '完了済み（1）を表示' }));
  expect(screen.getByText(completed.title)).toBeTruthy();

  await fireEvent.press(screen.getByRole('tab', { name: '未完了（2）' }));
  expect(screen.queryByText(completed.title)).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '繰り返し（1）' }));
  expect(screen.queryByText(task.title)).toBeNull();
  expect(screen.getByText(recurring.title)).toBeTruthy();
  await screen.rerender(<TasksScreen {...props} initialFilter="overdue" filterEntry="entry1" />);
  expect(screen.getByRole('tab', { name: '期限切れ（1）' }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(screen.queryByText(recurring.title)).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'すべて（3）' }));
  await screen.rerender(<TasksScreen {...props} initialFilter="overdue" filterEntry="entry2" />);
  expect(screen.getByRole('tab', { name: '期限切れ（1）' }).props.accessibilityState.selected).toBe(
    true,
  );
});
