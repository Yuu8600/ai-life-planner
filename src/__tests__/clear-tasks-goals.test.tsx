import { render, fireEvent } from '@testing-library/react-native';
import { GoalListItem } from '@/features/goals/components/GoalListItem';
import { toGoalListItemModel } from '@/features/goals/presentation';
import { TaskListItem } from '@/features/tasks/components/TaskListItem';
import type { Goal } from '@/features/goals/repositories/GoalRepository';
import type { TaskSummary } from '@/features/tasks/types';
import { ItemActions } from '@/shared/components/ItemActions';

const goal: Goal = {
  id: 'goal',
  userId: 'user',
  title: '長い目標名と説明を途中で省略せず確認する',
  description: '長い説明'.repeat(50),
  priority: 'high',
  status: 'active',
  currentValue: 530,
  targetValue: 730,
  unit: '点',
  deadline: '2026-12-31',
  createdAt: '2026-11-08T00:00:00Z',
  updatedAt: '2026-11-08T00:00:00Z',
};
const noop = () => {};
it('makes deletion a separate accessible disclosure and keeps edit available', async () => {
  const edit = jest.fn(),
    remove = jest.fn();
  const screen = await render(<ItemActions title="項目" onEdit={edit} onDelete={remove} />);
  expect(screen.queryByRole('button', { name: '項目を削除する' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '項目を編集する' }));
  expect(edit).toHaveBeenCalledTimes(1);
  const more = screen.getByRole('button', { name: '項目のその他の操作' });
  expect(more.props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(more);
  expect(
    screen.getByRole('button', { name: '項目のその他の操作' }).props.accessibilityState.expanded,
  ).toBe(true);
  expect(remove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '項目を削除する' }));
  expect(remove).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: '項目のその他の操作' }));
  expect(screen.queryByRole('button', { name: '項目を削除する' })).toBeNull();
});
it('blocks editing, disclosure and duplicate deletion while deletion is pending', async () => {
  const edit = jest.fn(),
    remove = jest.fn();
  const screen = await render(<ItemActions title="項目" onEdit={edit} onDelete={remove} />);
  await fireEvent.press(screen.getByRole('button', { name: '項目のその他の操作' }));
  await screen.rerender(<ItemActions title="項目" isDeleting onEdit={edit} onDelete={remove} />);
  for (const name of ['項目を編集する', '項目のその他の操作', '項目を削除する']) {
    const button = screen.getByRole('button', { name });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
  }
  expect(screen.getByRole('button', { name: '項目を削除する' }).props.accessibilityState.busy).toBe(
    true,
  );
  expect(edit).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it('announces existing progress and values without changing the calculation', async () => {
  const screen = await render(
    <GoalListItem goal={toGoalListItemModel(goal)} onEdit={noop} onDelete={noop} />,
  );
  const progress = screen.getByRole('progressbar');
  expect(progress.props.accessibilityValue).toMatchObject({
    min: 0,
    max: 100,
    now: 73,
    text: '現在 530点、目標 730点、73%',
  });
  expect(screen.getByText(goal.title)).toBeTruthy();
  expect(screen.getByText(goal.description!)).toBeTruthy();
  expect(screen.getByText('530点')).toBeTruthy();
  expect(screen.getByText('730点')).toBeTruthy();
});
it.each([
  { currentValue: null, targetValue: 730 },
  { currentValue: 530, targetValue: null },
  { currentValue: 530, targetValue: 0 },
])('does not show a false percentage for unset progress %j', async (values) => {
  const screen = await render(
    <GoalListItem
      goal={toGoalListItemModel({ ...goal, ...values })}
      onEdit={noop}
      onDelete={noop}
    />,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByText('進捗 未設定')).toBeTruthy();
  expect(screen.queryByText('0%')).toBeNull();
});
it.each([
  ['completed', '完了'],
  ['active', '進行中'],
  ['archived', 'アーカイブ'],
] as const)('retains goal status %s and completed progress', async (status, label) => {
  const screen = await render(
    <GoalListItem
      goal={toGoalListItemModel({ ...goal, status, currentValue: 730 })}
      onEdit={noop}
      onDelete={noop}
    />,
  );
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(100);
});
it.each([
  ['completed', '完了'],
  ['scheduled', '予定済み'],
  ['pending', '未予定'],
  ['skipped', 'スキップ'],
] as const)('retains distinct Task status %s and metadata', async (status, statusLabel) => {
  const task: TaskSummary = {
    id: 'task',
    title: '長いタスク'.repeat(20),
    goalId: 'goal',
    goalTitle: '関連Goal',
    estimatedMinutes: 30,
    deadlineLabel: '期限なし',
    status,
    statusLabel,
    priority: 'low',
    priorityLabel: '優先度 低',
  };
  const screen = await render(<TaskListItem task={task} onEdit={noop} onDelete={noop} />);
  for (const text of [task.title, '所要時間 30分', task.deadlineLabel, statusLabel, task.goalTitle])
    expect(screen.getByText(text)).toBeTruthy();
});

it('keeps a long description readable on demand without truncating the expanded content', async () => {
  const screen = await render(
    <GoalListItem goal={toGoalListItemModel(goal)} onEdit={noop} onDelete={noop} />,
  );
  expect(screen.getByText(goal.description!).props.numberOfLines).toBe(2);
  await fireEvent.press(screen.getByRole('button', { name: `${goal.title}の説明を切り替える` }));
  expect(screen.getByText(goal.description!).props.numberOfLines).toBeUndefined();
  expect(
    screen.getByRole('button', { name: `${goal.title}の説明を切り替える` }).props.accessibilityState
      .expanded,
  ).toBe(true);
});
