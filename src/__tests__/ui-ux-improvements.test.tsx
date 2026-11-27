import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import type { ChatRepository } from '@/features/ai-chat/v2/repository';
import { DayAgenda } from '@/features/calendar/DayAgenda';
import type { FixedEventRepository } from '@/features/calendar/FixedEventRepository';
import type { CalendarRepository } from '@/features/calendar/repositories/CalendarRepository';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';
import {
  DEFAULT_CONDITIONS,
  type RecommendationRepository,
} from '@/features/recommendations/repository';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';

const date = '2026-11-27';
const timezone = 'Asia/Tokyo';

const sampleTask: Task = {
  id: 'task-1',
  userId: 'user-1',
  goalId: 'goal-1',
  title: '英語リスニング',
  estimatedMinutes: 30,
  deadline: null,
  localDeadline: null,
  priority: 'high',
  status: 'pending',
  recurrence: { kind: 'daily', weekdays: [] },
  createdAt: date,
  updatedAt: date,
};

const overdueTask: Task = {
  ...sampleTask,
  id: 'task-2',
  title: 'レポート提出',
  estimatedMinutes: 60,
  localDeadline: '2026-11-20',
  priority: 'medium',
  recurrence: { kind: 'once', weekdays: [] },
};

describe('UI/UX improvements regression coverage', () => {
  it('opens candidate detail sheet from Today row and links to action steps', async () => {
    const openStep = jest.fn();
    const openCalendar = jest.fn();
    const taskRepository: TaskRepository = {
      list: jest.fn().mockResolvedValue([sampleTask]),
      listGoalOptions: jest.fn().mockResolvedValue([{ id: 'goal-1', title: 'TOEIC 800' }]),
      create: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };
    const repository: RecommendationRepository = {
      listSteps: jest.fn().mockResolvedValue([]),
      listResults: jest.fn().mockResolvedValue([]),
      addStep: jest.fn(),
      removeStep: jest.fn(),
      updateStep: jest.fn(),
      record: jest.fn(),
      undo: jest.fn(),
    };

    const screen = await render(
      <TodayRecommendationsScreen
        date={date}
        timezone={timezone}
        revision={0}
        taskRepository={taskRepository}
        repository={repository}
        initialConditions={DEFAULT_CONDITIONS}
        saveConditions={jest.fn()}
        calendarPermissionMissing
        openCalendar={openCalendar}
        openChat={jest.fn()}
        openSettings={jest.fn()}
        openTasks={jest.fn()}
        openStep={openStep}
      />,
    );

    expect(screen.getByText('端末カレンダー未連携（アプリ内予定のみ参照）')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '予定タブでカレンダーを連携する' }));
    expect(openCalendar).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: '英語リスニングの詳細を開く' }));
    expect(screen.getByText('目標：TOEIC 800')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '小さな行動を見る・分ける' }));
    expect(openStep).toHaveBeenCalledWith('task-1', 30);
  });

  it('shows metadata pills, filters overdue tasks, and keeps UI stable during silent refresh', async () => {
    let resolveReload: (tasks: Task[]) => void = () => undefined;
    const list = jest
      .fn()
      .mockResolvedValueOnce([sampleTask, overdueTask])
      .mockImplementationOnce(
        () =>
          new Promise<Task[]>((resolve) => {
            resolveReload = resolve;
          }),
      );
    const repository: TaskRepository = {
      list,
      listGoalOptions: jest.fn().mockResolvedValue([{ id: 'goal-1', title: 'TOEIC 800' }]),
      create: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };
    const recommendations: RecommendationRepository = {
      listSteps: jest.fn().mockResolvedValue([]),
      listResults: jest.fn().mockResolvedValue([]),
      addStep: jest.fn(),
      removeStep: jest.fn(),
      updateStep: jest.fn(),
      record: jest.fn(),
      undo: jest.fn(),
    };

    const screen = await render(
      <TasksScreen
        repository={repository}
        refreshToken={0}
        recommendationMode
        recommendations={recommendations}
        planningTimezone={timezone}
        now={new Date('2026-11-27T04:00:00Z')}
      />,
    );

    expect(await screen.findByText('目安 30分')).toBeTruthy();
    expect(screen.getAllByText('TOEIC 800').length).toBeGreaterThan(0);
    expect(screen.getByText('期限切れ 2026-11-20')).toBeTruthy();

    // Silent refocus refresh must NOT hide the add button or unmount tasks.
    await screen.rerender(
      <TasksScreen
        repository={repository}
        refreshToken={1}
        recommendationMode
        recommendations={recommendations}
        planningTimezone={timezone}
        now={new Date('2026-11-27T04:00:00Z')}
      />,
    );
    expect(screen.getByRole('button', { name: '新しいタスクを作成する' })).toBeTruthy();
    expect(screen.getByText('英語リスニング')).toBeTruthy();
    await act(async () => {
      resolveReload([sampleTask, overdueTask]);
    });

    await fireEvent.press(screen.getByRole('tab', { name: '期限切れ（1）' }));
    expect(screen.getByText('レポート提出')).toBeTruthy();
    expect(screen.queryByText('英語リスニング')).toBeNull();
  });

  it('keeps DayAgenda rendered without flicker when revision increments for the same day', async () => {
    const calendar: CalendarRepository = {
      getPermission: jest.fn().mockResolvedValue({ status: 'denied', canAskAgain: true }),
      requestPermission: jest.fn(),
      listEvents: jest.fn(),
    };
    let resolveSecondList: (events: []) => void = () => undefined;
    const fixed: FixedEventRepository = {
      list: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'evt-1',
            title: '定例ミーティング',
            startAt: '2026-11-27T01:00:00Z',
            endAt: '2026-11-27T02:00:00Z',
          },
        ])
        .mockImplementationOnce(
          () =>
            new Promise<[]>((resolve) => {
              resolveSecondList = resolve;
            }),
        ),
      add: jest.fn(),
      remove: jest.fn(),
    };

    const screen = await render(
      <DayAgenda date={date} timezone={timezone} revision={0} calendar={calendar} fixed={fixed} />,
    );
    expect(await screen.findByText('定例ミーティング')).toBeTruthy();

    await screen.rerender(
      <DayAgenda date={date} timezone={timezone} revision={1} calendar={calendar} fixed={fixed} />,
    );
    expect(screen.getByText('定例ミーティング')).toBeTruthy();
    expect(screen.queryByText('予定を確認しています。')).toBeNull();
    await act(async () => {
      resolveSecondList([]);
    });
  });

  it('allows retrying failed thread loading in ChatScreen', async () => {
    const open = jest
      .fn()
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce({
        messages: [{ id: 'm1', role: 'user' as const, body: 'こんにちは', createdAt: date }],
        drafts: [],
        olderCursor: null,
      });
    const repository: ChatRepository = {
      listThreads: jest.fn().mockResolvedValue([{ id: 't1', title: '朝の相談' }]),
      createThread: jest.fn(),
      listOlder: jest.fn(),
      open,
      send: jest.fn(),
      edit: jest.fn(),
      approve: jest.fn(),
      usage: jest
        .fn()
        .mockResolvedValue({ configured: true, remainingMicros: 500000, month: '2026-11' }),
    };

    const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: '朝の相談' }));
    expect(await screen.findByText('会話を読み込めませんでした。')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再試行' }));
    await waitFor(() => expect(screen.getByText('こんにちは')).toBeTruthy());
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('toggles password visibility on AuthForm', async () => {
    const screen = await render(<AuthForm onSignIn={jest.fn()} onSignUp={jest.fn()} />);
    const passwordInput = screen.getByLabelText('パスワード');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'パスワードを表示' }));
    expect(screen.getByLabelText('パスワード').props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'パスワードを隠す' }));
    expect(screen.getByLabelText('パスワード').props.secureTextEntry).toBe(true);
  });
});
