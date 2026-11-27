import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import type { ChatRepository, Thread } from '@/features/ai-chat/v2/repository';
const thread: Thread = {
  id: 'thread',
  title: '会話1',
  updatedAt: '2026-11-27T01:00:00Z',
  canManage: true,
};
function source(): ChatRepository {
  return {
    listThreads: jest.fn(async () => [thread]),
    createThread: jest.fn(),
    open: jest.fn(async () => ({ messages: [], drafts: [], olderCursor: null })),
    listOlder: jest.fn(),
    usage: jest.fn(async () => ({ configured: false, remainingMicros: 0, month: '2026-11' })),
    send: jest.fn(),
    edit: jest.fn(),
    approve: jest.fn(),
    renameThread: jest.fn(async (_thread, title) => ({
      ...thread,
      title,
      updatedAt: '2026-11-27T02:00:00Z',
    })),
    removeThread: jest.fn(),
  };
}
it('shows update dates, keeps failed name edits, and updates the list after an explicit save', async () => {
  const repository = source();
  jest
    .mocked(repository.renameThread!)
    .mockRejectedValueOnce(new Error('保存失敗'))
    .mockImplementationOnce(async (_thread, title) => ({ ...thread, title }));
  const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
  expect(await screen.findByText(/^更新 /)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '会話1の会話を管理' }));
  expect(screen.getByRole('button', { name: '名前を保存' }).props.accessibilityState.disabled).toBe(
    true,
  );
  await fireEvent.changeText(screen.getByLabelText('会話名'), '改名した会話');
  await fireEvent.press(screen.getByRole('button', { name: '名前を保存' }));
  expect(screen.getByText('保存失敗')).toBeTruthy();
  expect(screen.getByLabelText('会話名').props.value).toBe('改名した会話');
  await fireEvent.press(screen.getByRole('button', { name: '名前を保存' }));
  expect(await screen.findByRole('button', { name: '改名した会話' })).toBeTruthy();
  expect(repository.renameThread).toHaveBeenCalledWith(thread, '改名した会話');
});
it('requires confirmation for deleting history, blocks duplicate requests, and removes only the selected thread', async () => {
  const repository = source();
  const other = { ...thread, id: 'other', title: '残す会話' };
  jest.mocked(repository.listThreads).mockResolvedValue([thread, other]);
  let finish!: () => void;
  jest.mocked(repository.removeThread!).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: '会話1の会話を管理' }));
    await fireEvent.press(screen.getByRole('button', { name: '会話を削除' }));
    expect(repository.removeThread).not.toHaveBeenCalled();
    expect(alert.mock.calls.at(-1)?.[1]).toMatch('保存済みのタスクと推薦方針は残ります');
    const action = alert.mock.calls.at(-1)?.[2]?.find((value) => value.style === 'destructive');
    await act(() => {
      action?.onPress?.();
      action?.onPress?.();
    });
    expect(repository.removeThread).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('会話名').props.editable).toBe(false);
    await act(() => finish());
    await waitFor(() => expect(screen.queryByRole('button', { name: '会話1' })).toBeNull());
    expect(screen.getByRole('button', { name: '残す会話' })).toBeTruthy();
  } finally {
    alert.mockRestore();
  }
});
it('guards dirty rename dismissal and disables management for an unmigrated backend', async () => {
  const repository = source();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: '会話1の会話を管理' }));
    await fireEvent.changeText(screen.getByLabelText('会話名'), '未保存');
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('変更を破棄しますか？');
    await act(() =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((value) => value.style === 'destructive')
        ?.onPress?.(),
    );
    expect(repository.renameThread).not.toHaveBeenCalled();
    jest.mocked(repository.listThreads).mockResolvedValue([{ ...thread, canManage: false }]);
    await screen.unmount();
    const legacy = await render(<ChatScreen repository={repository} reviewPlan={jest.fn()} />);
    expect(await legacy.findByRole('button', { name: '会話1' })).toBeTruthy();
    expect(legacy.queryByRole('button', { name: '会話1の会話を管理' })).toBeNull();
  } finally {
    alert.mockRestore();
  }
});
