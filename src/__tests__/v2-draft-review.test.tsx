import { fireEvent, render } from '@testing-library/react-native';

import { DraftEditor } from '@/features/ai-chat/v2/DraftEditor';
import type { ChatRepository, Draft, RecordProposal } from '@/features/ai-chat/v2/repository';

it('confirms the selected items before approving them', async () => {
  const first: RecordProposal = {
    key: 'review-first',
    kind: 'task',
    title: '読書',
    priority: 'medium',
    deadline: null,
    minutes: 30,
    targetId: null,
    goalKey: null,
    before: null,
    expectedUpdatedAt: null,
  };
  const draft: Draft = {
    id: 'draft',
    revision: 'revision',
    approvedAt: null,
    items: [first, { ...first, key: 'review-second', title: '散歩' }],
  };
  const repository: ChatRepository = {
    listThreads: jest.fn(),
    createThread: jest.fn(),
    open: jest.fn(),
    listOlder: jest.fn(),
    send: jest.fn(),
    usage: jest.fn(),
    edit: jest.fn(),
    approve: jest.fn(),
  };
  const screen = await render(
    <DraftEditor
      repository={repository}
      draft={draft}
      close={jest.fn()}
      refreshed={jest.fn()}
      reviewPlan={jest.fn()}
    />,
  );

  await fireEvent.press(screen.getByRole('checkbox', { name: '散歩を採用' }));
  expect(
    screen.getByRole('checkbox', { name: '散歩を採用' }).props.accessibilityState.checked,
  ).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: '1件の採用内容を確認' }));
  expect(repository.approve).not.toHaveBeenCalled();
  expect(screen.queryByText(/散歩/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '1件を承認' }));
  expect(repository.approve).toHaveBeenCalledWith(draft, ['review-first']);
});

it('approves edited values in the same sheet and retains them on failure', async () => {
  const draft: Draft = {
    id: 'draft',
    revision: 'original',
    approvedAt: null,
    items: [
      {
        key: 'report',
        kind: 'task',
        title: 'レポート',
        priority: 'medium',
        deadline: null,
        minutes: 30,
        targetId: null,
        goalKey: null,
        before: null,
        expectedUpdatedAt: null,
        patch: { title: 'レポート' },
      },
    ],
  };
  const close = jest.fn();
  const repository: ChatRepository = {
    listThreads: jest.fn(),
    createThread: jest.fn(),
    open: jest.fn(),
    listOlder: jest.fn(),
    send: jest.fn(),
    usage: jest.fn(),
    edit: jest.fn(),
    approve: jest
      .fn()
      .mockRejectedValueOnce(new Error('ネットワークを確認してください。'))
      .mockResolvedValueOnce(undefined),
  };
  const screen = await render(
    <DraftEditor
      draft={draft}
      repository={repository}
      close={close}
      refreshed={jest.fn()}
      reviewPlan={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '項目を編集' }));
  await fireEvent.changeText(screen.getByDisplayValue('レポート'), 'レポートの構成を書く');
  await fireEvent.press(screen.getByRole('button', { name: '1件の採用内容を確認' }));
  expect(screen.getByText('タスク　レポートの構成を書く')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '1件を承認' }));
  expect(screen.getByText('ネットワークを確認してください。')).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '1件を承認' }));
  expect(repository.edit).not.toHaveBeenCalled();
  expect(repository.approve).toHaveBeenLastCalledWith(
    draft,
    ['report'],
    [
      expect.objectContaining({
        title: 'レポートの構成を書く',
        patch: { title: 'レポートの構成を書く' },
      }),
    ],
  );
  expect(close).toHaveBeenCalledTimes(1);
});
