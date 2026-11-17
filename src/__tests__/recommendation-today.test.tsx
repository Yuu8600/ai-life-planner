import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
  await fireEvent.press(screen.getByRole('button', { name: '今から何する？' }));
  await fireEvent.press(screen.getAllByRole('button', { name: '手帳を見直すを完了' }).at(-1)!);
  await waitFor(() => expect(repository.record).toHaveBeenCalledTimes(1));
  await screen.unmount();
  const restarted = await render(<TodayRecommendationsScreen {...props} />);
  expect(restarted.getByText('今日の完了 1件')).toBeTruthy();
  expect(restarted.queryByRole('button', { name: '手帳を見直すを完了' })).toBeNull();
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
