import { fireEvent, render, within } from '@testing-library/react-native';

import { Timeline } from '@/features/today/components/Timeline';
import type { TimelineItem } from '@/features/today/types';

function item(id: string, status: TimelineItem['status']): TimelineItem {
  return {
    startAt: '2000-01-01T10:00:00Z',
    endAt: '2000-01-01T10:30:00Z',
    id,
    title: id,
    taskTitle: id,
    start: '10:00',
    end: '10:30',
    status,
    statusLabel: status,
    reason: null,
  };
}

describe('Today next action', () => {
  it('focuses the first scheduled action and moves focus after completion', async () => {
    const onExecute = jest.fn();
    const items = [
      item('完了済み', 'completed'),
      item('スキップ済み', 'skipped'),
      item('最初の行動', 'scheduled'),
      item('次の行動', 'scheduled'),
    ];
    const screen = await render(<Timeline items={items} onExecute={onExecute} />);
    const next = within(screen.getByTestId('today-next-action'));
    expect(next.getByText('最初の行動')).toBeTruthy();
    expect(screen.getAllByText('次に取り組む')).toHaveLength(1);
    expect(screen.queryByText('Task: 最初の行動')).toBeNull();
    await fireEvent.press(next.getByRole('button', { name: '最初の行動を完了する' }));
    expect(onExecute).toHaveBeenCalledWith('最初の行動', 'completed');
    await screen.rerender(
      <Timeline
        items={items.map((action) =>
          action.id === '最初の行動' ? { ...action, status: 'completed' } : action,
        )}
        onExecute={onExecute}
      />,
    );
    expect(within(screen.getByTestId('today-next-action')).getByText('次の行動')).toBeTruthy();
  });

  it('shows no next-action prompt when every action is executed', async () => {
    const screen = await render(
      <Timeline items={[item('完了済み', 'completed'), item('スキップ済み', 'skipped')]} />,
    );
    expect(screen.queryByTestId('today-next-action')).toBeNull();
  });
});
