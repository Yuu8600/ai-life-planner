import { act, fireEvent, render } from '@testing-library/react-native';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import type { ChatRepository, Draft } from '@/features/ai-chat/v2/repository';

const proposal: Draft = {
  id: 'draft',
  revision: 'revision',
  approvedAt: null,
  createdAt: '2026-11-26T09:00:01Z',
  items: [
    {
      key: 'task',
      kind: 'task',
      title: '読書',
      priority: 'medium',
      deadline: null,
      minutes: null,
      goalKey: null,
      targetId: null,
      before: null,
      expectedUpdatedAt: null,
    },
  ],
};

function setup(fail = false) {
  let state = proposal;
  const repository: ChatRepository = {
    listThreads: jest.fn(async () => [{ id: 'thread', title: '会話' }]),
    createThread: jest.fn(),
    listOlder: jest.fn(),
    send: jest.fn(),
    edit: jest.fn(),
    usage: jest.fn(async () => ({ configured: true, remainingMicros: 500000, month: '2026-11' })),
    open: jest.fn(async () => ({
      messages: [
        {
          id: 'reply',
          role: 'assistant' as const,
          body: '追加しました',
          createdAt: '2026-11-26T09:00:00Z',
        },
      ],
      drafts: [state],
      olderCursor: null,
    })),
    approve: jest.fn(async () => {
      if (fail) throw new Error('保存に失敗しました');
      state = { ...state, approvedAt: '2026-11-26T10:00:00Z', appliedKeys: ['task'] };
    }),
    reject: jest.fn(async () => {
      state = { ...state, rejectedAt: '2026-11-26T10:00:00Z' };
    }),
  };
  return { repository };
}

it('keeps a task as a proposal until Add succeeds, then restores its saved state on reopening', async () => {
  const { repository } = setup();
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  expect(await screen.findByText(/操作の提案/)).toBeTruthy();
  expect(screen.queryByText('追加しました')).toBeNull();
  expect(repository.approve).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '追加' }));
  expect(repository.approve).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/保存しました/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '会話一覧' }));
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  expect(await screen.findByText(/保存しました/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '追加' })).toBeNull();
});

it('rejects without approving and retains the rejected record', async () => {
  const { repository } = setup();
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  await fireEvent.press(await screen.findByRole('button', { name: '提案を却下' }));
  expect(repository.approve).not.toHaveBeenCalled();
  expect(await screen.findByText(/提案を取り消しました/)).toBeTruthy();
});

it('keeps the proposal actionable when storage fails', async () => {
  const { repository } = setup(true);
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  await fireEvent.press(await screen.findByRole('button', { name: '追加' }));
  expect(await screen.findByText('保存に失敗しました')).toBeTruthy();
  expect(screen.queryByText(/保存しました/)).toBeNull();
  expect(screen.getByRole('button', { name: '追加' })).toBeTruthy();
});

it('blocks repeated approval while the first save is pending', async () => {
  const { repository } = setup();
  let finish!: () => void;
  jest.mocked(repository.approve).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  const button = await screen.findByRole('button', { name: '追加' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(repository.approve).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
});

it('keeps multiple proposals with their corresponding responses', async () => {
  const { repository } = setup();
  jest.mocked(repository.open).mockResolvedValue({
    messages: [
      { id: 'first', role: 'assistant', body: '一つ目の回答', createdAt: '2026-11-26T09:00:00Z' },
      { id: 'second', role: 'assistant', body: '二つ目の回答', createdAt: '2026-11-26T10:00:00Z' },
    ],
    drafts: [
      proposal,
      {
        ...proposal,
        id: 'second-draft',
        createdAt: '2026-11-26T10:00:01Z',
        rejectedAt: '2026-11-26T11:00:00Z',
        items: [{ ...proposal.items[0], title: '散歩' }],
      },
    ],
    olderCursor: null,
  });
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '会話' }));
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('読書')).toBeLessThan(tree.indexOf('提案を取り消しました'));
  expect(tree.indexOf('提案を取り消しました')).toBeLessThan(tree.indexOf('散歩'));
  expect(screen.getAllByRole('button', { name: '追加' })).toHaveLength(1);
});
