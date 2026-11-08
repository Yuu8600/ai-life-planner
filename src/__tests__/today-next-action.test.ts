import { selectNextAction } from '@/features/today/nextAction';
import type { TimelineItem } from '@/features/today/types';
const item = (
  id: string,
  startAt: string,
  endAt: string,
  status: TimelineItem['status'] = 'scheduled',
): TimelineItem => ({
  id,
  startAt,
  endAt,
  status,
  title: id,
  start: '',
  end: '',
  statusLabel: status,
  reason: null,
});
const actions = [
  item('future', '2026-11-08T03:00:00Z', '2026-11-08T04:00:00Z'),
  item('old', '2026-11-07T23:00:00Z', '2026-11-08T00:00:00Z'),
  item('active', '2026-11-08T01:00:00Z', '2026-11-08T02:00:00Z'),
];
it('prioritizes an active unfinished Action over overdue and future entries regardless of array order', () => {
  expect(selectNextAction(actions, new Date('2026-11-08T01:30:00Z'))).toMatchObject({
    item: { id: 'active' },
    label: '予定時間内・未完了',
  });
});
it('labels overdue unfinished work without moving saved instants', () => {
  expect(selectNextAction(actions, new Date('2026-11-08T02:00:00Z'))).toMatchObject({
    item: { id: 'old', startAt: '2026-11-07T23:00:00Z' },
    label: '予定時刻を過ぎた未完了',
  });
});
it('ignores completed and skipped Actions and identifies future work', () => {
  expect(
    selectNextAction(
      [{ ...actions[1], status: 'completed' }, { ...actions[2], status: 'skipped' }, actions[0]],
      new Date('2026-11-08T02:00:00Z'),
    ),
  ).toMatchObject({ item: { id: 'future' }, label: '次の予定' });
});
it('returns no recommendation when all Actions are executed or absent', () => {
  expect(selectNextAction([], new Date())).toBeNull();
  expect(
    selectNextAction(
      actions.map((a) => ({ ...a, status: 'completed' })),
      new Date(),
    ),
  ).toBeNull();
});
