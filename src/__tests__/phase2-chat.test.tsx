import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ChatScreen } from '@/features/ai-chat/v2/ChatScreen';
import { CalendarShareEditor } from '@/features/ai-chat/v2/CalendarShareEditor';
import { readCalendarForShare } from '@/features/ai-chat/v2/readCalendarForShare';
import type { ChatRepository, Draft } from '@/features/ai-chat/v2/repository';
import type { CalendarEvent, CalendarRepository, FixedEventRepository } from '@/features/calendar';
import { DraftEditor } from '@/features/ai-chat/v2/DraftEditor';

const event: CalendarEvent = {
  id: 'calendar-event',
  title: '打ち合わせ',
  calendarId: 'calendar',
  calendarTitle: null,
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  status: 'confirmed',
  availability: 'busy',
  location: '非公開の場所',
  instanceId: null,
  timeZone: 'Asia/Tokyo',
  startAt: '2026-11-27T00:00:00Z',
  endAt: '2026-11-27T01:00:00Z',
};
function repository(overrides: Partial<ChatRepository> = {}): ChatRepository {
  return {
    listThreads: jest.fn(async () => [{ id: 'thread', title: '既存会話' }]),
    createThread: jest.fn(async () => ({ id: 'new', title: '新しい相談' })),
    open: jest.fn(async () => ({ messages: [], drafts: [], olderCursor: null })),
    listOlder: jest.fn(),
    send: jest.fn(),
    usage: jest.fn(async () => ({
      configured: true,
      calendarSharing: true,
      remainingMicros: 500000,
      month: '2026-11',
    })),
    edit: jest.fn(),
    approve: jest.fn(),
    ...overrides,
  };
}

it('does not create an empty thread on opening New and reuses the first thread after send failure', async () => {
  const source = repository({
    send: jest.fn().mockRejectedValueOnce(new Error('送信失敗')).mockResolvedValueOnce(undefined),
  });
  const screen = await render(<ChatScreen repository={source} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '新規会話' }));
  expect(source.createThread).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByPlaceholderText('メッセージを入力'), '相談したい');
  await fireEvent.press(screen.getByRole('button', { name: 'AIに送信' }));
  expect(screen.getByText('送信失敗')).toBeTruthy();
  expect(screen.getByPlaceholderText('メッセージを入力').props.value).toBe('相談したい');
  await fireEvent.press(screen.getByRole('button', { name: 'AIに送信' }));
  expect(source.createThread).toHaveBeenCalledTimes(1);
  expect(source.send).toHaveBeenCalledTimes(2);
});
it('hides unavailable input while keeping existing conversations readable', async () => {
  const source = repository({
    usage: jest.fn(async () => ({ configured: false, remainingMicros: 0, month: '2026-11' })),
  });
  const screen = await render(<ChatScreen repository={source} reviewPlan={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: '既存会話' }));
  expect(screen.queryByPlaceholderText('メッセージを入力')).toBeNull();
  expect(screen.queryByRole('button', { name: '新規会話' })).toBeNull();
  expect(source.open).toHaveBeenCalledWith('thread');
});
it('prepares calendar sharing directly but never selects or sends events automatically', async () => {
  const source = repository();
  const read = jest.fn(async () => ({ events: [event], timezone: 'Asia/Tokyo' }));
  const screen = await render(
    <ChatScreen
      repository={source}
      reviewPlan={jest.fn()}
      prepareCalendar
      initialDate="2026-11-27"
      readCalendar={read}
    />,
  );
  expect(await screen.findByText('予定の共有確認')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: '打ち合わせ' }));
  expect(source.send).not.toHaveBeenCalled();
  expect(source.createThread).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '次の送信に使う' }));
  expect(source.send).not.toHaveBeenCalled();
  expect(screen.getByText(/予定1件の詳細/)).toBeTruthy();
  expect(screen.queryByText(/非公開の場所/)).toBeNull();
});
it('allows closing during preparation and does not apply late results', async () => {
  let finish!: (value: { events: CalendarEvent[]; timezone: string }) => void;
  const read = jest.fn(
    () =>
      new Promise<{ events: CalendarEvent[]; timezone: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const apply = jest.fn(),
    close = jest.fn();
  const screen = await render(
    <CalendarShareEditor
      autoPrepare
      initialDate="2026-11-27"
      readEvents={read}
      apply={apply}
      close={close}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
  expect(close).toHaveBeenCalledTimes(1);
  await screen.unmount();
  await act(() => finish({ events: [event], timezone: 'Asia/Tokyo' }));
  expect(apply).not.toHaveBeenCalled();
});
it('reads app events when device access fails and refuses a misleading availability summary', async () => {
  const device: CalendarRepository = {
    getPermission: jest.fn(async () => ({ status: 'denied' as const, canAskAgain: true })),
    requestPermission: jest.fn(),
    listEvents: jest.fn(),
  };
  const fixed: FixedEventRepository = {
    list: jest.fn(async () => [event]),
    add: jest.fn(),
    remove: jest.fn(),
  };
  const result = await readCalendarForShare('2026-11-27', 'Asia/Tokyo', device, fixed);
  expect(result.warning).toMatch('端末');
  expect(result.events[0].calendarId).toBe('app');
  const apply = jest.fn();
  const screen = await render(
    <CalendarShareEditor
      autoPrepare
      initialDate="2026-11-27"
      readEvents={async () => result}
      apply={apply}
      close={jest.fn()}
    />,
  );
  await screen.findByText(/端末の予定を取得できません/);
  await fireEvent.press(screen.getByRole('radio', { name: 'カレンダー共有 予定の有無' }));
  expect(
    screen.getByRole('button', { name: '次の送信に使う' }).props.accessibilityState.disabled,
  ).toBe(true);
});
it('uses a picker for proposal deadlines and guards unsaved date edits without saving', async () => {
  const source = repository(),
    close = jest.fn();
  const draft: Draft = {
    id: 'draft',
    revision: 'v1',
    approvedAt: null,
    items: [
      {
        key: 'task',
        kind: 'task',
        title: '読書',
        priority: 'medium',
        deadline: null,
        minutes: 10,
        targetId: null,
        goalKey: null,
        before: null,
        expectedUpdatedAt: null,
      },
    ],
  };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(
      <DraftEditor
        draft={draft}
        repository={source}
        close={close}
        refreshed={jest.fn()}
        reviewPlan={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '項目を編集' }));
    await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、期限なし' }));
    await fireEvent.press(screen.getByRole('button', { name: '読書の期限を明日にする' }));
    await fireEvent.press(screen.getByRole('button', { name: 'パネルを閉じる' }));
    expect(alert).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(source.edit).not.toHaveBeenCalled();
    expect(source.approve).not.toHaveBeenCalled();
  } finally {
    alert.mockRestore();
  }
});

it('saves a chosen proposal date only when the user explicitly saves the draft', async () => {
  const source = repository();
  const draft: Draft = {
    id: 'draft',
    revision: 'v1',
    approvedAt: null,
    items: [
      {
        key: 'task',
        kind: 'task',
        title: '読書',
        priority: 'medium',
        deadline: null,
        minutes: 10,
        targetId: null,
        goalKey: null,
        before: null,
        expectedUpdatedAt: null,
      },
    ],
  };
  const screen = await render(
    <DraftEditor
      draft={draft}
      repository={source}
      close={jest.fn()}
      refreshed={jest.fn()}
      reviewPlan={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '項目を編集' }));
  await fireEvent.press(screen.getByRole('button', { name: '日付を選ぶ、期限なし' }));
  await fireEvent.press(screen.getByRole('button', { name: '読書の期限を明日にする' }));
  expect(source.edit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '下書きだけ保存' }));
  expect(source.edit).toHaveBeenCalledWith(draft, [
    expect.objectContaining({ deadline: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
  ]);
  expect(source.approve).not.toHaveBeenCalled();
});
