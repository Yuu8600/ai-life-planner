import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DayTimeline } from '@/features/calendar/components/DayTimeline';
import { FreeTimeSummary } from '@/features/calendar/components/FreeTimeSummary';
import { EventBufferEditor } from '@/features/calendar/components/EventBufferEditor';
import { toCalendarEventViewModel } from '@/features/calendar/presentation';
import type { CalendarEvent } from '@/features/calendar/types';
import { PlannerPreview } from '@/features/planner/components/PlannerPreview';
import { calculateFreeTime } from '@/features/planner';
import type { PlannerPreviewViewModel } from '@/features/planner/plannerPreviewPresentation';
const event: CalendarEvent = {
  id: 'event',
  calendarId: 'calendar',
  instanceId: null,
  calendarTitle: '仕事用Calendar',
  title: '長い予定名をすべて読み、移動前の準備事項も確認する',
  startAt: '2026-11-08T01:00:00.000Z',
  endAt: '2026-11-08T02:00:00.000Z',
  allDay: false,
  allDayStartDate: null,
  allDayEndDate: null,
  availability: 'busy',
  status: 'confirmed',
  location: '長い建物名・会議室・入口での受付方法まで確認する',
  timeZone: 'Asia/Tokyo',
};
it('keeps complete event titles, metadata, canceled state and edit controls available', async () => {
  const edit = jest.fn();
  const vm = toCalendarEventViewModel({ ...event, status: 'canceled' }, '2026-11-08', 'Asia/Tokyo');
  const screen = await render(
    <DayTimeline
      events={[vm]}
      editableKeys={[vm.key]}
      individualKeys={[vm.key]}
      onEditBuffer={edit}
    />,
  );
  expect(screen.getByText(event.title).props.numberOfLines).toBeUndefined();
  expect(screen.getByText(event.location!).props.numberOfLines).toBeUndefined();
  expect(screen.getByText('キャンセル済み')).toBeTruthy();
  expect(screen.getByText('個別余白')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: event.title + 'の余白を設定' }));
  expect(edit).toHaveBeenCalledWith(vm.key);
});
it('labels the full overnight planning window and the meaning of Calendar capacity', async () => {
  const result = calculateFreeTime({
    events: [],
    selectedDate: '2026-11-08',
    timezone: 'Asia/Tokyo',
    planningStart: '09:00',
    planningEnd: '02:00',
    planningEndDayOffset: 1,
    minimumFreeMinutes: 20,
  });
  const screen = await render(<FreeTimeSummary result={result} timezone="Asia/Tokyo" />);
  expect(screen.getByText('09:00–翌日 02:00')).toBeTruthy();
  expect(screen.getByText('1枠・合計1020分')).toBeTruthy();
  expect(screen.getByText(/保存済みActionと過去の時間は差し引いていません/)).toBeTruthy();
});
it('keeps zero overrides, visible errors and cancellation without writing on selection', async () => {
  const repository = {
    list: jest.fn(async () => []),
    upsert: jest.fn(async () => {
      throw Error('offline');
    }),
    remove: jest.fn(async () => {}),
  };
  const close = jest.fn(),
    saved = jest.fn();
  const screen = await render(
    <EventBufferEditor
      event={event}
      timeLabel="10:00–11:00"
      commonBefore={17}
      commonAfter={30}
      individual={{
        calendarId: event.calendarId,
        eventId: event.id,
        occurrenceStartAt: event.startAt,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      }}
      repository={repository}
      onClose={close}
      onSaved={saved}
    />,
  );
  expect(screen.getByText('個別設定を適用中')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'この予定の前の余白、0分' })).toBeTruthy();
  expect(repository.upsert).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('余白設定を保存'));
  expect(
    await screen.findByText('個別余白を保存できませんでした。もう一度お試しください。'),
  ).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('キャンセル'));
  expect(close).toHaveBeenCalledTimes(1);
  expect(repository.remove).not.toHaveBeenCalled();
});
it('locks modal close, cancellation and repeated writes while saving', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const repository = {
    list: jest.fn(async () => []),
    upsert: jest.fn(async () => {}),
    remove: jest.fn(() => pending),
  };
  const close = jest.fn();
  const screen = await render(
    <EventBufferEditor
      event={event}
      timeLabel="10:00–11:00"
      commonBefore={17}
      commonAfter={30}
      repository={repository}
      onClose={close}
      onSaved={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByText('余白設定を保存'));
  await fireEvent.press(screen.getByText('保存中…'));
  expect(screen.getByRole('button', { name: '余白設定を閉じる' })).toBeDisabled();
  expect(screen.getByText('キャンセル')).toBeDisabled();
  expect(repository.remove).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await pending;
  });
  expect(close).toHaveBeenCalledTimes(1);
});
it('keeps preview counts, action labels, unplaced reasons and warnings visible', async () => {
  const preview: PlannerPreviewViewModel = {
    localDate: '2026-11-08',
    timezone: 'Asia/Tokyo',
    calendarEvents: [],
    summary: '確認用の提案',
    actions: [
      {
        id: 'a',
        startAt: event.startAt,
        startTime: '10:00',
        endTime: '10:30',
        timeRange: '10:00–10:30',
        title: '復習',
        reason: 'まとまった時間',
      },
    ],
    unscheduled: [{ taskId: 'b', title: '未配置の長いタスク', reason: '連続した時間が不足' }],
    warnings: [{ code: 'INVALID_INPUT', path: 'input', message: '最新の設定を確認してください。' }],
  };
  const screen = await render(
    <PlannerPreview preview={preview}>
      <Text>保存操作の補足</Text>
    </PlannerPreview>,
  );
  expect(screen.getByText('配置されたAction 1件')).toBeTruthy();
  expect(screen.getByText('Action')).toBeTruthy();
  expect(screen.getByText('未配置の長いタスク')).toBeTruthy();
  expect(screen.getByText('連続した時間が不足')).toBeTruthy();
  expect(screen.getByText('最新の設定を確認してください。')).toBeTruthy();
  expect(screen.getByText('保存操作の補足')).toBeTruthy();
});
