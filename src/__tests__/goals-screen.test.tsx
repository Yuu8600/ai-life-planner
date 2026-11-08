import type { AlertButton } from 'react-native';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { GoalsScreen } from '@/features/goals/GoalsScreen';
import type {
  CreateGoalInput,
  Goal,
  GoalRepository,
  UpdateGoalInput,
} from '@/features/goals/repositories/GoalRepository';

const userId = '11111111-1111-4111-8111-111111111111';

const goal: Goal = {
  createdAt: '2026-09-12T00:00:00+00:00',
  currentValue: 530,
  deadline: '2026-10-25',
  description: '英語学習',
  id: '22222222-2222-4222-8222-222222222222',
  priority: 'high',
  status: 'active',
  targetValue: 730,
  title: 'TOEIC',
  unit: '点',
  updatedAt: '2026-09-12T00:00:00+00:00',
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

function createRepository(overrides: Partial<jest.Mocked<GoalRepository>> = {}) {
  return {
    create: jest.fn(async (input) => ({ ...goal, ...input })),
    findById: jest.fn(async () => goal),
    list: jest.fn(async () => [goal]),
    remove: jest.fn(async () => undefined),
    update: jest.fn(async (_id, input) => ({ ...goal, ...input })),
    ...overrides,
  } as jest.Mocked<GoalRepository>;
}

describe('GoalsScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a loading state until goals are fetched', async () => {
    const deferred = createDeferred<Goal[]>();
    const repository = createRepository({ list: jest.fn(() => deferred.promise) });
    const screen = await render(<GoalsScreen repository={repository} />);

    expect(screen.getByTestId('goals-loading-state')).toBeTruthy();

    deferred.resolve([goal]);
    expect(await screen.findByText('TOEIC')).toBeTruthy();
  });

  it('shows an empty state when the signed-in user has no goals', async () => {
    const repository = createRepository({ list: jest.fn(async () => []) });
    const screen = await render(<GoalsScreen repository={repository} />);

    expect(await screen.findByTestId('goals-empty-state')).toBeTruthy();
    expect(screen.getByText('まだ目標がありません')).toBeTruthy();
  });

  it('shows a safe Japanese error and retries a failed fetch', async () => {
    const list = jest
      .fn<ReturnType<GoalRepository['list']>, Parameters<GoalRepository['list']>>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce([goal]);
    const repository = createRepository({ list });
    const screen = await render(<GoalsScreen repository={repository} />);

    expect(
      await screen.findByText('目標データに接続できません。通信状況を確認して再度お試しください。'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));
    expect(await screen.findByText('TOEIC')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not create a repository operation or expose CRUD controls without authentication', async () => {
    const screen = await render(<GoalsScreen repository={null} />);

    expect(await screen.findByText('目標を表示するにはログインが必要です。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '新しい目標を作成する' })).toBeNull();
  });

  it('creates a goal and immediately adds it to the list', async () => {
    const createdGoal = { ...goal, id: 'new-goal-id', title: 'アプリ制作' };
    const repository = createRepository({
      create: jest.fn(async (_input: CreateGoalInput) => createdGoal),
      list: jest.fn(async () => []),
    });
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByTestId('goals-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しい目標を作成する' }));
    await fireEvent.changeText(screen.getByLabelText('目標タイトル'), 'アプリ制作');
    await fireEvent.press(screen.getByRole('button', { name: '目標を保存する' }));

    expect(await screen.findByText('アプリ制作')).toBeTruthy();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'medium', status: 'active', title: 'アプリ制作' }),
    );
  });

  it('updates a goal and immediately replaces the rendered values', async () => {
    const updatedGoal = { ...goal, title: 'TOEIC 800' };
    const repository = createRepository({
      update: jest.fn(async (_id: string, _input: UpdateGoalInput) => updatedGoal),
    });
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByText('TOEIC');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICを編集する' }));
    await fireEvent.changeText(screen.getByLabelText('目標タイトル'), 'TOEIC 800');
    await fireEvent.press(screen.getByRole('button', { name: '目標を保存する' }));

    expect(await screen.findByText('TOEIC 800')).toBeTruthy();
    expect(screen.queryByText('TOEIC')).toBeNull();
    expect(repository.update).toHaveBeenCalledWith(
      goal.id,
      expect.objectContaining({ title: 'TOEIC 800' }),
    );
  });

  it('deletes a confirmed goal and immediately removes it from the list', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = (buttons as AlertButton[] | undefined)?.find(
        (button) => button.style === 'destructive',
      );
      deleteButton?.onPress?.();
    });
    const repository = createRepository();
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByText('TOEIC');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICを削除する' }));

    await waitFor(() => {
      expect(screen.queryByText('TOEIC')).toBeNull();
    });
    expect(repository.remove).toHaveBeenCalledWith(goal.id);
    expect(screen.getByTestId('goals-empty-state')).toBeTruthy();
  });

  it('prevents duplicate create submissions while Supabase is pending', async () => {
    const deferred = createDeferred<Goal>();
    const create = jest.fn((_input: CreateGoalInput) => deferred.promise);
    const repository = createRepository({ create, list: jest.fn(async () => []) });
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByTestId('goals-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しい目標を作成する' }));
    await fireEvent.changeText(screen.getByLabelText('目標タイトル'), 'アプリ制作');
    const submitButton = screen.getByRole('button', { name: '目標を保存する' });
    await fireEvent.press(submitButton);
    await fireEvent.press(submitButton);

    expect(create).toHaveBeenCalledTimes(1);

    deferred.resolve({ ...goal, id: 'new-goal-id', title: 'アプリ制作' });
    expect(await screen.findByText('アプリ制作')).toBeTruthy();
  });

  it('keeps the form open and shows a safe Japanese message when creation fails', async () => {
    const permissionError = Object.assign(new Error('sensitive database detail'), {
      code: '42501',
    });
    const create = jest.fn(async (_input: CreateGoalInput) => {
      throw permissionError;
    });
    const repository = createRepository({ create, list: jest.fn(async () => []) });
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByTestId('goals-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しい目標を作成する' }));
    await fireEvent.changeText(screen.getByLabelText('目標タイトル'), 'アプリ制作');
    await fireEvent.press(screen.getByRole('button', { name: '目標を保存する' }));

    expect(
      await screen.findByText('この目標を操作する権限がありません。再度ログインしてください。'),
    ).toBeTruthy();
    expect(screen.getByTestId('goal-form-modal')).toBeTruthy();
    expect(screen.queryByText('sensitive database detail')).toBeNull();
  });

  it('shows validation without calling Supabase for a blank title', async () => {
    const repository = createRepository({ list: jest.fn(async () => []) });
    const screen = await render(<GoalsScreen repository={repository} />);

    await screen.findByTestId('goals-empty-state');
    await fireEvent.press(screen.getByRole('button', { name: '新しい目標を作成する' }));
    await fireEvent.press(screen.getByRole('button', { name: '目標を保存する' }));

    expect(await screen.findByText('タイトルを入力してください。')).toBeTruthy();
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
    const screen = await render(<GoalsScreen repository={repository} />);
    await screen.findByText('TOEIC');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICを削除する' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(repository.remove).not.toHaveBeenCalled();
    expect(screen.getByText('TOEIC')).toBeTruthy();
  });
  it('prevents duplicate delete and edit until the pending removal finishes', async () => {
    const pending = createDeferred<void>();
    const repository = createRepository({ remove: jest.fn((_id: string) => pending.promise) });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) =>
        buttons?.find((button) => button.style === 'destructive')?.onPress?.(),
      );
    const screen = await render(<GoalsScreen repository={repository} />);
    await screen.findByText('TOEIC');
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICのその他の操作' }));
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICを削除する' }));
    const deletion = screen.getByRole('button', { name: 'TOEICを削除する' });
    expect(deletion.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(deletion);
    await fireEvent.press(screen.getByRole('button', { name: 'TOEICを編集する' }));
    expect(repository.remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('goal-form-modal')).toBeNull();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    await waitFor(() => expect(screen.queryByText('TOEIC')).toBeNull());
  });
});
