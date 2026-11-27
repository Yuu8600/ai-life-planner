import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { GoalsScreen } from '@/features/goals/GoalsScreen';
import type { Goal, GoalRepository } from '@/features/goals/repositories/GoalRepository';
import type { Task, TaskRepository } from '@/features/tasks';

const goal: Goal = {
  id: 'goal',
  title: '読書習慣',
  userId: 'user',
  description: null,
  deadline: null,
  status: 'active',
  priority: 'medium',
  currentValue: null,
  targetValue: null,
  unit: null,
  createdAt: '',
  updatedAt: '',
};
const task: Task = {
  id: 'first',
  title: '1冊読む',
  userId: 'user',
  goalId: goal.id,
  status: 'completed',
  priority: 'medium',
  deadline: null,
  estimatedMinutes: 10,
  createdAt: '',
  updatedAt: '',
};
function sources() {
  let values = [
    task,
    {
      ...task,
      id: 'second',
      title: '毎日の読書',
      status: 'pending' as const,
      recurrence: { kind: 'daily' as const, weekdays: [] },
    },
    { ...task, id: 'other', title: '別の目標', goalId: 'another' },
  ];
  const goals: GoalRepository = {
    list: jest.fn(async () => [goal]),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(async () => goal),
  };
  const tasks: TaskRepository = {
    list: jest.fn(async () => [...values]),
    listGoalOptions: jest.fn(async () => [{ id: goal.id, title: goal.title }]),
    create: jest.fn(async (input) => {
      const created = { ...task, ...input, id: String(values.length) };
      values = [...values, created];
      return created;
    }),
    findById: jest.fn(async (id) => values.find((value) => value.id === id) ?? null),
    update: jest.fn(async (id, input) => {
      const saved = { ...task, ...input, id };
      values = values.map((value) => (value.id === id ? saved : value));
      return saved;
    }),
    remove: jest.fn(),
  };
  return { goals, tasks };
}
it('shows only the associated task progress and edits existing tasks without changing completion', async () => {
  const { goals, tasks } = sources();
  const screen = await render(
    <GoalsScreen repository={goals} taskRepository={tasks} planningTimezone="Asia/Tokyo" />,
  );
  expect(await screen.findByText('関連タスク 1 / 2 件完了')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '読書習慣の関連タスクを見る' }));
  expect(screen.queryByText('別の目標')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '1冊読むを編集する' }));
  await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '2冊読む');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
  expect(tasks.update).toHaveBeenCalledWith('first', expect.objectContaining({ title: '2冊読む' }));
  expect(jest.mocked(tasks.update).mock.calls[0][1]).not.toHaveProperty('status');
});
it('preselects the goal and keeps the same clean sheet for continuous creation', async () => {
  const { goals, tasks } = sources();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(
      <GoalsScreen repository={goals} taskRepository={tasks} planningTimezone="Asia/Tokyo" />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '読書習慣のタスクを追加' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: '続けてタスクを追加' }));
    for (const title of ['次の1冊', 'さらに1冊']) {
      await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), title);
      await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
      await waitFor(() => expect(screen.getByLabelText('タスクタイトル').props.value).toBe(''));
      expect(screen.getByTestId('task-form-modal-presentation').props.presentationStyle).toBe(
        'pageSheet',
      );
    }
    expect(tasks.create).toHaveBeenCalledTimes(2);
    expect(tasks.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: '次の1冊', goalId: goal.id }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'タスクフォームを閉じる' }));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByText('関連タスク 1 / 4 件完了')).toBeTruthy();
  } finally {
    alert.mockRestore();
  }
});
it('waits for the native goal sheet dismissal before opening the preselected task sheet', async () => {
  const { goals, tasks } = sources();
  const screen = await render(
    <GoalsScreen
      compactActions
      repository={goals}
      taskRepository={tasks}
      planningTimezone="Asia/Tokyo"
    />,
  );
  await fireEvent.press(await screen.findByRole('button', { name: '読書習慣を編集する' }));
  const dismiss = screen.getByTestId('goal-form-modal-presentation').props.onDismiss;
  await fireEvent.press(screen.getByRole('button', { name: 'この目標のタスクを追加' }));
  expect(screen.queryByTestId('task-form-modal')).toBeNull();
  await act(() => dismiss());
  expect(screen.getByTestId('task-form-modal')).toBeTruthy();
});
it('keeps input on create failure and reports unavailable progress instead of zero', async () => {
  const { goals, tasks } = sources();
  jest.mocked(tasks.list).mockRejectedValue(new Error('Network request failed'));
  jest.mocked(tasks.create).mockRejectedValue(new Error('Network request failed'));
  const screen = await render(
    <GoalsScreen repository={goals} taskRepository={tasks} planningTimezone="Asia/Tokyo" />,
  );
  expect(await screen.findByText(/進捗は確認できません/)).toBeTruthy();
  expect(screen.queryByText(/件完了/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '読書習慣のタスクを追加' }));
  await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '失敗しても残る');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
  expect(screen.getByLabelText('タスクタイトル').props.value).toBe('失敗しても残る');
  expect(screen.getByRole('alert')).toBeTruthy();
});
