import { fireEvent, render } from '@testing-library/react-native';
import { LegacyPlanHistory } from '@/features/planner/v2/LegacyPlanHistory';
import { EventEditor } from '@/features/planner/v2/EventEditor';
import type { ActivityLog } from '@/features/activity/repositories/ActivityLogRepository';

it('distinguishes no historical data from a failed read and supports retry', async () => {
  const plans = {
    getPlanForDate: jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null),
  };
  const activities = { listForPlanDate: jest.fn(async () => []) };
  const screen = await render(
    <LegacyPlanHistory date="2026-11-28" plans={plans} activities={activities} />,
  );
  await screen.findByText('過去の計画を読み込めませんでした。');
  expect(screen.queryByText('この日の旧計画・実行履歴はありません。')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '計画を再読み込み' }));
  expect(await screen.findByText('この日の旧計画・実行履歴はありません。')).toBeTruthy();
});
it('retains activity-only history when there is no old plan', async () => {
  const log: ActivityLog = {
    id: 'log',
    actionTitle: '以前の作業',
    eventType: 'planned_action_completed',
    occurredAt: '2026-11-28T01:00:00Z',
    planDate: '2026-11-28',
    plannedActionId: null,
    scheduledStartAt: '2026-11-28T00:00:00Z',
    scheduledEndAt: '2026-11-28T01:00:00Z',
    taskId: null,
    timezone: 'Asia/Tokyo',
  };
  const screen = await render(
    <LegacyPlanHistory
      date="2026-11-28"
      plans={{ getPlanForDate: jest.fn(async () => null) }}
      activities={{ listForPlanDate: jest.fn(async () => [log]) }}
    />,
  );
  expect(await screen.findByText('以前の作業')).toBeTruthy();
  expect(screen.queryByText('この日の旧計画・実行履歴はありません。')).toBeNull();
});
it('uses time pickers for flexible lifestyle windows and retains duration validation', async () => {
  const save = jest.fn();
  const screen = await render(
    <EventEditor date="2026-11-28" timezone="Asia/Tokyo" close={jest.fn()} save={save} />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '予定の種類 柔軟な生活予定' }));
  await fireEvent.changeText(screen.getByLabelText('予定名'), '朝食');
  expect(screen.getByRole('button', { name: '開始、09:00' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '終了、10:00' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '予定を保存' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'flexible',
      duration: 30,
      startAt: '2026-11-28T00:00:00.000Z',
      endAt: '2026-11-28T01:00:00.000Z',
    }),
  );
});
