import { act, fireEvent, render } from '@testing-library/react-native';

import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import type { ChatRepository } from '@/features/ai-chat/v2/repository';
import { AccountPanel } from '@/features/auth/components/AccountPanel';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { ActionStepsScreen } from '@/features/recommendations/ActionStepsScreen';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';
import type { RecommendationRepository } from '@/features/recommendations/repository';
import { selectTaskList } from '@/features/tasks/selectTaskList';
import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    userId: 'user-1',
    goalId: null,
    estimatedMinutes: 30,
    priority: 'medium',
    deadline: null,
    localDeadline: null,
    recurrence: { kind: 'once', weekdays: [] },
    status: 'pending',
    createdAt: '2026-11-27T00:00:00.000Z',
    updatedAt: '2026-11-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('APP_IMPLEMENTATION_REFERENCE remaining gaps', () => {
  it('omits timer buttons from Today candidate details and ActionSteps while clarifying schedule/duration labels', async () => {
    const tasks = [
      makeTask({
        id: 'urgent-long',
        title: '重要レポート',
        estimatedMinutes: 60,
        localDeadline: '2026-11-28',
        priority: 'high',
      }),
    ];
    const taskRepository: TaskRepository = {
      list: jest.fn().mockResolvedValue(tasks),
      findById: jest.fn().mockResolvedValue(tasks[0]),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listGoalOptions: jest.fn().mockResolvedValue([]),
    };
    const repository: RecommendationRepository = {
      listSteps: jest.fn().mockResolvedValue([]),
      listResults: jest.fn().mockResolvedValue([
        {
          date: '2026-11-27',
          kind: 'task',
          targetId: 'past-1',
          taskId: 'past-1',
          goalId: null,
          title: '昨日の読書',
          outcome: 'completed',
        },
      ]),
      record: jest.fn(),
      undo: jest.fn(),
      addStep: jest.fn(),
      updateStep: jest.fn(),
      removeStep: jest.fn(),
    };
    const stepsRepository: RecommendationRepository = {
      ...repository,
      listSteps: jest.fn().mockResolvedValue([
        {
          id: 'step-1',
          taskId: 'urgent-long',
          title: '構成メモを書く',
          minutes: 10,
          effort: 'light',
          repeatable: false,
          completed: false,
          createdAt: '2026-11-28T00:00:00.000Z',
        },
      ]),
    };

    const screen = await render(
      <TodayRecommendationsScreen
        taskRepository={taskRepository}
        repository={repository}
        timezone="Asia/Tokyo"
        date="2026-11-28"
        revision={0}
        initialConditions={{ minutes: 30, effort: 'normal' }}
        saveConditions={jest.fn()}
        calendarWindow={{ minutes: null, until: null, availability: 'all' }}
        openChat={jest.fn()}
        openSettings={jest.fn()}
        openTasks={jest.fn()}
        openStep={jest.fn()}
      />,
    );

    expect(await screen.findByText('このあとの予定はありません')).toBeTruthy();
    expect(screen.getByText('設定時間超過（期限優先）')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '重要レポートの詳細を開く' }));
    expect(screen.queryByRole('button', { name: /作業タイマーを開く/ })).toBeNull();
    const dismiss = screen.getByTestId('candidate-details-presentation').props.onDismiss;
    await fireEvent.press(screen.getByRole('button', { name: '詳細を閉じる' }));
    await act(() => dismiss());
    await fireEvent.press(screen.getByRole('button', { name: 'これまでの記録' }));
    expect(screen.getByText(/2026年11月27日 ・ 完了・実施 ・ 昨日の読書/)).toBeTruthy();
    await screen.unmount();

    const stepsScreen = await render(
      <ActionStepsScreen
        taskId="urgent-long"
        date="2026-11-28"
        revision={0}
        dayError=""
        refreshDay={jest.fn()}
        tasks={taskRepository}
        repository={stepsRepository}
        close={jest.fn()}
        openAI={jest.fn()}
      />,
    );
    expect(await stepsScreen.findByText('構成メモを書く')).toBeTruthy();
    expect(stepsScreen.queryByRole('button', { name: /作業タイマーを開く/ })).toBeNull();
    expect(stepsScreen.queryByRole('button', { name: 'タイマー' })).toBeNull();
    await stepsScreen.unmount();
  });

  it('supports password reset flow from AuthForm without losing the typed email', async () => {
    const onResetPassword = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <AuthForm onResetPassword={onResetPassword} onSignIn={jest.fn()} onSignUp={jest.fn()} />,
    );

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'パスワードをお忘れですか？' }));
    expect(screen.getByDisplayValue('user@example.com')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '再設定メールを送信する' }));
    });
    expect(onResetPassword).toHaveBeenCalledWith('user@example.com');
    expect(screen.getByText(/パスワード再設定用のメールを送信しました/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'ログインに戻る' }));
    expect(screen.getByRole('button', { name: 'ログインする' })).toBeTruthy();
  });

  it('sorts tasks by estimated duration ascending with null last', () => {
    const sorted = selectTaskList(
      [
        makeTask({ id: 'c', title: '未設定', estimatedMinutes: null }),
        makeTask({ id: 'b', title: '長め', estimatedMinutes: 60 }),
        makeTask({ id: 'a', title: '短め', estimatedMinutes: 10 }),
      ],
      { query: '', goal: 'all', sort: 'duration' },
    );
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('uses user-friendly copy in AccountPanel and ChatScreen', async () => {
    const account = await render(<AccountPanel email="a@example.com" signOut={jest.fn()} />);
    expect(account.getByText('この端末からログアウトします。')).toBeTruthy();

    const chatRepo: ChatRepository = {
      listThreads: jest.fn().mockResolvedValue([]),
      createThread: jest.fn(),
      open: jest.fn(),
      listOlder: jest.fn(),
      send: jest.fn(),
      usage: jest.fn().mockResolvedValue({
        configured: true,
        remainingMicros: 250_000,
        calendarSharing: false,
      }),
      edit: jest.fn(),
      approve: jest.fn(),
    };
    const chat = await render(<ChatScreen repository={chatRepo} reviewPlan={jest.fn()} />);
    expect(
      await chat.findByText('今月の残り利用枠（目安）：50%（毎月1日リセット・残り $0.25）'),
    ).toBeTruthy();
    await fireEvent.press(chat.getByRole('button', { name: '新規会話' }));
    expect(chat.getByRole('button', { name: '期限切れを整理したい' })).toBeTruthy();
  });
});
