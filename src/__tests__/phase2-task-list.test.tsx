import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';
import { DEFAULT_CONDITIONS } from '@/features/recommendations/repository';
import { selectTaskList } from '@/features/tasks/selectTaskList';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import type { Task, TaskRepository } from '@/features/tasks';
import { DeadlineField } from '@/shared/components/DeadlineField';

const base: Task = {
  id: 'a',
  title: 'ＡＩを学ぶ',
  userId: 'u',
  goalId: 'goal',
  priority: 'low',
  status: 'pending',
  estimatedMinutes: null,
  deadline: null,
  createdAt: '',
  updatedAt: '',
};
const tasks: Task[] = [
  base,
  { ...base, id: 'b', title: 'AI実践', priority: 'high', localDeadline: '2026-12-01' },
  { ...base, id: 'c', title: '買い物', goalId: null },
];
const options = { query: '', goal: 'all', sort: 'recent' as const };
it('combines normalized search and goal filters without mutating the input, sorting missing deadlines last', () => {
  expect(
    selectTaskList(tasks, { query: 'ai', goal: 'goal', sort: 'priority' }).map((task) => task.id),
  ).toEqual(['b', 'a']);
  expect(selectTaskList(tasks, { ...options, sort: 'deadline' }).map((task) => task.id)).toEqual([
    'b',
    'a',
    'c',
  ]);
  expect(selectTaskList(tasks, { ...options, goal: 'none' }).map((task) => task.id)).toEqual(['c']);
  expect(selectTaskList(tasks, { ...options, query: 'ありません' })).toEqual([]);
  expect(tasks.map((task) => task.id)).toEqual(['a', 'b', 'c']);
});
it('combines native incomplete state with search and goal, retaining clear and completed navigation', async () => {
  const source: TaskRepository = {
    list: jest.fn(async () => [
      ...tasks,
      { ...base, id: 'done', title: '完了AI', status: 'completed' as const },
    ]),
    listGoalOptions: jest.fn(async () => [{ id: 'goal', title: '学習' }]),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const screen = await render(
    <TasksScreen repository={source} recommendationMode planningTimezone="Asia/Tokyo" />,
  );
  expect(await screen.findByText('ＡＩを学ぶ')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('タスクを検索'), 'ai');
  expect(screen.queryByText('買い物')).toBeNull();
  expect(screen.queryByText('完了AI')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '並び替え・目標' }));
  await fireEvent.press(screen.getByRole('radio', { name: '目標で絞り込み 目標なし' }));
  expect(screen.getByText('該当するタスクはありません')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '検索・目標をクリア' }));
  expect(screen.getByText('買い物')).toBeTruthy();
  expect(screen.getByRole('button', { name: '完了済み（1）' })).toBeTruthy();
});
it('uses the profile date for one-tap deadlines across device timezone and month boundaries', async () => {
  jest.useFakeTimers({ now: new Date('2026-11-30T16:00:00Z') });
  try {
    const change = jest.fn();
    const screen = await render(
      <DeadlineField
        accessibilityLabel="タスクの期限"
        timezone="Asia/Tokyo"
        disabled={false}
        value=""
        onChange={change}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、期限なし' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'タスクの期限を来週（7日後）にする' }),
    );
    expect(change).toHaveBeenCalledWith('2026-12-08');
  } finally {
    jest.useRealTimers();
  }
});

it('keeps quick-add text on failure and discards only after common confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const source: TaskRepository = {
      list: jest.fn(async () => []),
      listGoalOptions: jest.fn(async () => []),
      create: jest.fn().mockRejectedValue(new Error('Network request failed')),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const screen = await render(
      <TodayRecommendationsScreen
        taskRepository={source}
        repository={{
          listSteps: jest.fn(async () => []),
          listResults: jest.fn(async () => []),
          addStep: jest.fn(),
          updateStep: jest.fn(),
          removeStep: jest.fn(),
          record: jest.fn(),
          undo: jest.fn(),
        }}
        date="2026-11-27"
        timezone="Asia/Tokyo"
        revision={0}
        initialConditions={DEFAULT_CONDITIONS}
        saveConditions={jest.fn()}
        openSettings={jest.fn()}
        openTasks={jest.fn()}
        openStep={jest.fn()}
      />,
    );
    expect(screen.queryByText('いまの候補')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'タスクをクイック追加する' }));
    await fireEvent.changeText(screen.getByLabelText('クイック追加するタスク名'), '未保存のタスク');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを追加' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('クイック追加するタスク名').props.value).toBe('未保存のタスク');
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    const actions = alert.mock.calls.at(-1)?.[2];
    await act(() => actions?.find((item) => item.style === 'cancel')?.onPress?.());
    expect(screen.getByLabelText('クイック追加するタスク名')).toBeTruthy();
    await act(() => actions?.find((item) => item.style === 'destructive')?.onPress?.());
    await fireEvent.press(screen.getByRole('button', { name: 'タスクをクイック追加する' }));
    expect(screen.getByLabelText('クイック追加するタスク名').props.value).toBe('');
  } finally {
    alert.mockRestore();
  }
});
