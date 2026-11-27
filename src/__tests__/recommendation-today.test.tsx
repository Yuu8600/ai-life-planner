import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { DayAgenda, type CalendarRepository, type FixedEventRepository } from '@/features/calendar';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';
import {
  DEFAULT_CONDITIONS,
  type RecommendationRepository,
  type RecommendationResult,
} from '@/features/recommendations/repository';
import type {
  CreateTaskInput,
  Task,
  TaskRepository,
} from '@/features/tasks/repositories/TaskRepository';

const date = '2026-11-18';
const timezone = 'Asia/Tokyo';
const existing: Task = {
  title: '手帳を見直す',
  id: 'task',
  userId: 'user',
  goalId: null,
  deadline: null,
  estimatedMinutes: 15,
  createdAt: date,
  updatedAt: date,
  priority: 'medium',
  status: 'pending',
  recurrence: { kind: 'daily', weekdays: [] },
};

it('recommends and saves completion with a failed calendar and loads the result on a new mount', async () => {
  let results: RecommendationResult[] = [];
  const calendar: CalendarRepository = {
    getPermission: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
    listEvents: jest.fn().mockRejectedValue(new Error('device calendar unavailable')),
    requestPermission: jest.fn(),
  };
  const fixed: FixedEventRepository = {
    list: jest.fn().mockResolvedValue([]),
    add: jest.fn(),
    remove: jest.fn(),
  };
  const taskRepository: TaskRepository = {
    list: jest.fn().mockResolvedValue([existing]),
    listGoalOptions: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findById: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };
  const repository: RecommendationRepository = {
    listSteps: jest.fn().mockResolvedValue([]),
    listResults: jest.fn(async () => [...results]),
    addStep: jest.fn(),
    removeStep: jest.fn(),
    updateStep: jest.fn(),
    undo: jest.fn(async () => {
      results = [];
    }),
    record: jest.fn(async (date, kind, targetId, outcome) => {
      results = [
        { date, kind, targetId, outcome, taskId: existing.id, title: existing.title, goalId: null },
      ];
      return outcome;
    }),
  };
  const props = {
    date,
    timezone,
    taskRepository,
    repository,
    revision: 0,
    initialConditions: DEFAULT_CONDITIONS,
    agenda: (
      <DayAgenda
        date={date}
        timezone={timezone}
        calendar={calendar}
        fixed={fixed}
        revision={0}
        summary
      />
    ),
    openSettings: jest.fn(),
    saveConditions: jest.fn(),
    openTasks: jest.fn(),
    openStep: jest.fn(),
  };
  const screen = await render(<TodayRecommendationsScreen {...props} />);
  expect(screen.getByText('端末の予定を読み込めませんでした。')).toBeTruthy();
  expect(screen.getByText('今から何する？')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: '手帳を見直すの今日の実施を記録' }));
  await waitFor(() => expect(repository.record).toHaveBeenCalledTimes(1));
  await screen.unmount();
  const restarted = await render(<TodayRecommendationsScreen {...props} />);
  expect(restarted.queryByText('手帳を見直す')).toBeNull();
  await fireEvent.press(restarted.getByRole('button', { name: 'これまでの記録' }));
  await fireEvent.press(
    restarted.getByRole('checkbox', { name: '手帳を見直すの今日の実施を取り消す' }),
  );
  expect(repository.undo).toHaveBeenCalledWith(date, 'task', 'task', 'completed');
  await fireEvent.press(restarted.getByRole('button', { name: 'これまでの記録を閉じる' }));
  await waitFor(() =>
    expect(
      restarted.getByRole('checkbox', { name: '手帳を見直すの今日の実施を記録' }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    restarted.getByRole('button', { name: '手帳を見直すを今日だけあとでにする' }),
  );
  await fireEvent.press(restarted.getByRole('button', { name: '元に戻す' }));
  expect(repository.undo).toHaveBeenCalledWith(date, 'task', 'task', 'skipped');
});

it('quick-adds a title without manufacturing an estimate', async () => {
  const create = jest.fn(async (input: CreateTaskInput) => ({ ...existing, ...input, id: 'new' }));
  const screen = await render(
    <TodayRecommendationsScreen
      taskRepository={{
        list: jest.fn().mockResolvedValue([]),
        listGoalOptions: jest.fn().mockResolvedValue([]),
        create,
        findById: jest.fn(),
        remove: jest.fn(),
        update: jest.fn(),
      }}
      repository={{
        listSteps: jest.fn().mockResolvedValue([]),
        listResults: jest.fn().mockResolvedValue([]),
        addStep: jest.fn(),
        removeStep: jest.fn(),
        updateStep: jest.fn(),
        record: jest.fn(),
        undo: jest.fn(),
      }}
      date={date}
      timezone={timezone}
      revision={0}
      initialConditions={DEFAULT_CONDITIONS}
      saveConditions={jest.fn()}
      openSettings={jest.fn()}
      openTasks={jest.fn()}
      openStep={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'タスクをクイック追加する' }));
  await fireEvent.changeText(screen.getByLabelText('クイック追加するタスク名'), ' ざっくり読む ');
  await fireEvent.press(screen.getByRole('button', { name: 'タスクを追加' }));
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'ざっくり読む',
      estimatedMinutes: null,
      deadline: null,
      goalId: null,
    }),
  );
});

it('uses fixed events during denied calendar access and displays urgent tasks in a separate card', async () => {
  const onSchedule = jest.fn();
  const fixedEvent = {
    id: 'app',
    title: '固定予定',
    startAt: date + 'T04:20:00Z',
    endAt: date + 'T05:00:00Z',
  };
  const calendar = {
    getPermission: jest.fn().mockResolvedValue({ status: 'denied', canAskAgain: true }),
    requestPermission: jest.fn(),
    listEvents: jest.fn(),
  };
  const props = {
    date,
    timezone,
    revision: 0,
    initialConditions: DEFAULT_CONDITIONS,
    saveConditions: jest.fn(),
    openSettings: jest.fn(),
    openTasks: jest.fn(),
    openStep: jest.fn(),
    taskRepository: {
      list: jest.fn().mockResolvedValue([
        { ...existing, title: '短い作業' },
        { ...existing, id: 'urgent', title: 'レポート', estimatedMinutes: 60, localDeadline: date },
        { ...existing, id: 'unknown', title: '時間のない作業', estimatedMinutes: null },
      ]),
      listGoalOptions: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    },
    repository: {
      listSteps: jest.fn().mockResolvedValue([]),
      listResults: jest.fn().mockResolvedValue([]),
      addStep: jest.fn(),
      removeStep: jest.fn(),
      updateStep: jest.fn(),
      record: jest.fn(),
      undo: jest.fn(),
    },
  };
  const screen = await render(
    <TodayRecommendationsScreen
      {...props}
      calendarWindow={{ minutes: 20, until: Date.parse(fixedEvent.startAt) }}
      agenda={
        <DayAgenda
          date={date}
          timezone={timezone}
          revision={0}
          calendar={calendar}
          fixed={{
            list: jest.fn().mockResolvedValue([fixedEvent]),
            add: jest.fn(),
            remove: jest.fn(),
          }}
          onSchedule={onSchedule}
          summary
        />
      }
    />,
  );
  expect(calendar.listEvents).not.toHaveBeenCalled();
  expect(onSchedule).toHaveBeenLastCalledWith(
    expect.objectContaining({
      availability: 'partial',
      loading: false,
      intervals: [fixedEvent],
    }),
  );
  expect(screen.queryByText('今できそうなこと')).toBeNull();
  expect(
    screen.getByRole('radio', { name: '使える時間 指定なし' }).props.accessibilityState.checked,
  ).toBe(true);
  const recommendations = within(screen.getByTestId('today-recommendations'));
  const deadlines = within(screen.getByTestId('today-upcoming-deadlines'));
  expect(recommendations.getByText('短い作業')).toBeTruthy();
  expect(recommendations.getByText('時間のない作業')).toBeTruthy();
  expect(recommendations.queryByTestId('today-upcoming-deadlines')).toBeNull();
  expect(deadlines.getByText('期限が近いタスク')).toBeTruthy();
  expect(deadlines.getByText('レポート')).toBeTruthy();
  expect(screen.getAllByText('レポート')).toHaveLength(1);
  expect(screen.getByText(/所要時間未設定/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '使える時間 30分' }));
  expect(deadlines.queryByText(/を超える見込み/)).toBeNull();
  expect(deadlines.getByText('今日が期限')).toBeTruthy();
  expect(deadlines.getByText('目安 60分')).toBeTruthy();
  expect(deadlines.getByText(/予定の間には収まらない見込み/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '使える時間 2時間' }));
  expect(props.saveConditions).toHaveBeenLastCalledWith({ minutes: 120, effort: 'normal' });
  await fireEvent.press(screen.getByRole('radio', { name: '使える時間 指定なし' }));
  expect(props.saveConditions).toHaveBeenLastCalledWith(DEFAULT_CONDITIONS);
});

it('opens deferred tasks without writing and restores the visible day in one operation', async () => {
  const second = { ...existing, id: 'second', title: '読書' };
  let entries: RecommendationResult[] = [existing, second].map((task) => ({
    date,
    kind: 'task',
    targetId: task.id,
    taskId: task.id,
    title: task.title,
    goalId: null,
    outcome: 'skipped',
  }));
  const undoBatch = jest.fn(async () => {
    entries = [];
  });
  const repository: RecommendationRepository = {
    listSteps: jest.fn().mockResolvedValue([]),
    listResults: jest.fn(async () => entries),
    addStep: jest.fn(),
    removeStep: jest.fn(),
    updateStep: jest.fn(),
    record: jest.fn(),
    undo: jest.fn(),
    undoBatch,
  };
  const screen = await render(
    <TodayRecommendationsScreen
      taskRepository={{
        list: jest.fn().mockResolvedValue([existing, second]),
        listGoalOptions: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findById: jest.fn(),
        remove: jest.fn(),
        update: jest.fn(),
      }}
      repository={repository}
      date={date}
      timezone={timezone}
      revision={0}
      initialConditions={DEFAULT_CONDITIONS}
      saveConditions={jest.fn()}
      openSettings={jest.fn()}
      openTasks={jest.fn()}
      openStep={jest.fn()}
    />,
  );
  expect(screen.getByText('いま表示するおすすめはありません。')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'あとでにしたタスクを表示（2件）' }));
  expect(undoBatch).not.toHaveBeenCalled();
  expect(repository.undo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'すべて戻す' }));
  expect(undoBatch).toHaveBeenCalledWith(date, [
    { kind: 'task', id: existing.id, expected: 'skipped' },
    { kind: 'task', id: second.id, expected: 'skipped' },
  ]);
  expect(await screen.findByText(second.title)).toBeTruthy();
});

it('shows more recommendations in batches and collapses to the original count', async () => {
  const tasks = Array.from({ length: 14 }, (_, index) => ({
    ...existing,
    id: `task-${index}`,
    title: `おすすめ ${index + 1}`,
  }));
  const screen = await render(
    <TodayRecommendationsScreen
      taskRepository={{
        list: jest.fn().mockResolvedValue(tasks),
        listGoalOptions: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findById: jest.fn(),
        remove: jest.fn(),
        update: jest.fn(),
      }}
      repository={{
        listSteps: jest.fn().mockResolvedValue([]),
        listResults: jest.fn().mockResolvedValue([]),
        addStep: jest.fn(),
        removeStep: jest.fn(),
        updateStep: jest.fn(),
        record: jest.fn(),
        undo: jest.fn(),
      }}
      date={date}
      timezone={timezone}
      revision={0}
      initialConditions={DEFAULT_CONDITIONS}
      saveConditions={jest.fn()}
      openSettings={jest.fn()}
      openTasks={jest.fn()}
      openStep={jest.fn()}
    />,
  );
  const card = within(screen.getByTestId('today-recommendations'));
  expect(card.getAllByRole('checkbox')).toHaveLength(4);
  await fireEvent.press(card.getByRole('button', { name: 'もっと見る' }));
  expect(card.getAllByRole('checkbox')).toHaveLength(12);
  expect(card.getByRole('button', { name: '折りたたむ' })).toBeTruthy();

  await fireEvent.press(card.getByRole('button', { name: 'もっと見る' }));
  expect(card.getAllByRole('checkbox')).toHaveLength(14);
  expect(card.queryByRole('button', { name: 'もっと見る' })).toBeNull();
  await fireEvent.press(card.getByRole('button', { name: '折りたたむ' }));
  expect(card.getAllByRole('checkbox')).toHaveLength(4);
  expect(card.queryByRole('button', { name: '折りたたむ' })).toBeNull();
  expect(card.getByRole('button', { name: 'もっと見る' })).toBeTruthy();
});

it.each(['task', 'step'] as const)(
  'edits the latest parent Task from a %s candidate and refreshes the recommendation',
  async (kind) => {
    let task = { ...existing, recurrence: { kind: 'once' as const, weekdays: [] } };
    const update = jest.fn(async (_id, input) => {
      task = { ...task, ...input };
      return task;
    });
    const findById = jest.fn(async () => ({ ...task, title: '最新のタスク名' }));
    const screen = await render(
      <TodayRecommendationsScreen
        date={date}
        timezone={timezone}
        revision={0}
        initialConditions={DEFAULT_CONDITIONS}
        saveConditions={jest.fn()}
        openSettings={jest.fn()}
        openTasks={jest.fn()}
        openStep={jest.fn()}
        taskRepository={{
          list: jest.fn(async () => [task]),
          listGoalOptions: jest.fn(async () => []),
          create: jest.fn(),
          findById,
          remove: jest.fn(),
          update,
        }}
        repository={{
          listSteps: jest.fn(async () =>
            kind === 'step'
              ? [
                  {
                    id: 'child',
                    createdAt: '2026-11-27',
                    taskId: task.id,
                    title: '子の行動',
                    minutes: 5,
                    effort: null,
                    repeatable: false,
                    completed: false,
                  },
                ]
              : [],
          ),
          listResults: jest.fn(async () => []),
          addStep: jest.fn(),
          removeStep: jest.fn(),
          updateStep: jest.fn(),
          record: jest.fn(),
          undo: jest.fn(),
        }}
      />,
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: `${kind === 'step' ? '子の行動' : task.title}の詳細を開く`,
      }),
    );
    const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
    await fireEvent.press(
      screen.getByRole('button', { name: kind === 'step' ? '親タスクを編集' : 'タスクを編集' }),
    );
    await act(() => dismiss());
    expect(findById).toHaveBeenCalledWith(task.id);
    expect(screen.getByLabelText('タスクタイトル').props.value).toBe('最新のタスク名');
    await fireEvent.changeText(screen.getByLabelText('タスクタイトル'), '更新したタスク');
    await fireEvent.changeText(screen.getByLabelText('タスクの所要時間'), '25');
    await fireEvent.press(screen.getByRole('button', { name: 'タスクを保存する' }));
    expect(update).toHaveBeenCalledWith(
      'task',
      expect.objectContaining({ title: '更新したタスク', estimatedMinutes: 25 }),
    );
    expect(screen.queryByTestId('task-form-modal')).toBeNull();
    if (kind === 'task') expect(await screen.findByText('更新したタスク')).toBeTruthy();
    else {
      await fireEvent.press(screen.getByRole('button', { name: '子の行動の詳細を開く' }));
      expect(screen.getByText('親タスク：更新したタスク')).toBeTruthy();
    }
  },
);

it('passes the parent Task to AI consultation from candidate details without writing', async () => {
  const askTaskAI = jest.fn();
  const update = jest.fn();
  const screen = await render(
    <TodayRecommendationsScreen
      date={date}
      timezone={timezone}
      revision={0}
      initialConditions={DEFAULT_CONDITIONS}
      saveConditions={jest.fn()}
      openSettings={jest.fn()}
      openTasks={jest.fn()}
      openStep={jest.fn()}
      askTaskAI={askTaskAI}
      taskRepository={{
        list: jest.fn(async () => [existing]),
        listGoalOptions: jest.fn(async () => []),
        create: jest.fn(),
        findById: jest.fn(),
        remove: jest.fn(),
        update,
      }}
      repository={{
        listSteps: jest.fn(async () => []),
        listResults: jest.fn(async () => []),
        addStep: jest.fn(),
        removeStep: jest.fn(),
        updateStep: jest.fn(),
        record: jest.fn(),
        undo: jest.fn(),
      }}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: `${existing.title}の詳細を開く` }));
  const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
  await fireEvent.press(screen.getByRole('button', { name: 'このタスクをAIに相談' }));
  expect(askTaskAI).not.toHaveBeenCalled();
  await act(() => dismiss());
  expect(askTaskAI).toHaveBeenCalledWith(existing);
  expect(update).not.toHaveBeenCalled();
});
