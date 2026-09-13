import type { AlertButton } from 'react-native';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
