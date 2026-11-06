import { PlannerPreview } from '@/features/planner/components/PlannerPreview';
import { render, within } from '@testing-library/react-native';
import { orderDailyTimeline } from '@/shared/types/dailyTimeline';
import { CalendarTimelineCard } from '@/features/calendar';

it('orders all-day first, retains overlapping entries and stable ties without mutating input', () => {
  const input = [
    { allDay: false, startAt: '2026-01-01T02:00:00Z', value: 'later' },
    { allDay: false, startAt: '2026-01-01T00:00:00Z', value: 'action' },
    { allDay: true, startAt: '2026-01-01T10:00:00Z', value: 'all-day' },
    { allDay: false, startAt: '2026-01-01T00:00:00Z', value: 'calendar' },
    { allDay: false, startAt: '2026-01-01T00:30:00Z', value: 'overlap' },
  ];
  const before = JSON.stringify(input);
  expect(orderDailyTimeline(input)).toEqual(['all-day', 'action', 'calendar', 'overlap', 'later']);
  expect(JSON.stringify(input)).toBe(before);
});
it('labels cross-date endpoints in the display timezone with no action controls', async () => {
  const screen = await render(
    <CalendarTimelineCard
      event={{
        title: '夜間予定',
        allDay: false,
        startAt: '2026-09-10T14:00:00Z',
        endAt: '2026-09-10T16:00:00Z',
      }}
      localDate="2026-09-10"
      timezone="Asia/Tokyo"
    />,
  );
  const card = screen.getByTestId('calendar-timeline-event');
  expect(within(card).getByText('23:00–2026-09-11 01:00')).toBeTruthy();
  expect(within(card).queryAllByRole('button')).toHaveLength(0);
  expect(
    screen.getByLabelText('23:00–2026-09-11 01:00、夜間予定、Calendar・読み取り専用'),
  ).toBeTruthy();
});

it('interleaves Preview context with actions while retaining unscheduled tasks and warnings', async () => {
  const preview = {
    localDate: '2026-09-11',
    timezone: 'Asia/Tokyo',
    summary: 'summary',
    actions: [
      {
        id: 'task',
        startAt: '2026-09-11T00:00:00Z',
        startTime: '09:00',
        endTime: '09:30',
        timeRange: '09:00–09:30',
        title: 'Action title',
        reason: 'reason',
      },
    ],
    calendarEvents: [
      {
        title: 'later context',
        allDay: false,
        startAt: '2026-09-11T01:00:00Z',
        endAt: '2026-09-11T02:00:00Z',
      },
      {
        title: 'earlier context',
        allDay: false,
        startAt: '2026-09-10T23:00:00Z',
        endAt: '2026-09-11T00:30:00Z',
      },
      {
        title: 'all-day context',
        allDay: true,
        startAt: '2026-09-10T15:00:00Z',
        endAt: '2026-09-11T15:00:00Z',
      },
    ],
    unscheduled: [{ taskId: 'other', title: 'unscheduled title', reason: 'no slot' }],
    warnings: [
      { code: 'ESTIMATED_MINUTES_MISMATCH' as const, path: 'actions', message: 'warning text' },
    ],
  };
  const original = JSON.stringify(preview);
  const screen = await render(<PlannerPreview preview={preview} />);
  const json = JSON.stringify(screen.toJSON());
  const titles = ['all-day context', 'earlier context', 'Action title', 'later context'];
  titles
    .slice(1)
    .forEach((title, i) => expect(json.indexOf(titles[i])).toBeLessThan(json.indexOf(title)));
  expect(screen.getByText('unscheduled title')).toBeTruthy();
  expect(screen.getByText('・warning text')).toBeTruthy();
  expect(screen.getAllByTestId('calendar-timeline-event')).toHaveLength(3);
  expect(JSON.stringify(preview)).toBe(original);
});
