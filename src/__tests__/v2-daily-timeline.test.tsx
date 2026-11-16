import { fireEvent, render, within } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { Dimensions } from 'react-native';

import type { CalendarEvent } from '@/features/calendar';
import { DailyPlanningScreen } from '@/features/planner/v2/DailyPlanningScreen';
import type { DailyPlanningDependencies } from '@/features/planner/v2/dayService';
import type { DailyPlan, WorkSession } from '@/features/planner/v2/types';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => mockUseEffect(callback, [callback]),
}));

const day = '2090-11-16';
const time = (clock: string) => `${day}T${clock}:00.000Z`;
const interval = (a: string, b: string) => ({ startAt: time(a), endAt: time(b) });
const task: WorkSession = {
  ...interval('10:00', '10:30'),
  id: 'session',
  taskId: 'reading',
  title: '読書',
  status: 'scheduled',
  locked: false,
  reason: '',
};

function fixture() {
  const plan: DailyPlan = {
    date: day,
    timezone: 'UTC',
    window: interval('08:00', '19:00'),
    sessions: [task],
    leisure: [interval('16:00', '17:00')],
    lifestyle: [{ id: 'meal', title: '昼食', ...interval('12:00', '12:30') }],
    warnings: [],
    unplaced: [],
    limited: false,
  };
  const meeting: CalendarEvent = {
    ...interval('14:00', '14:30'),
    title: '歯医者',
    id: 'device',
    instanceId: null,
    calendarId: 'calendar',
    calendarTitle: null,
    location: null,
    timeZone: null,
    allDay: false,
    allDayStartDate: null,
    allDayEndDate: null,
    availability: 'busy',
    status: 'confirmed',
  };
  const settings = {
    timezone: 'UTC',
    planningStart: '08:00',
    planningEnd: '19:00',
    planningEndDayOffset: 0 as const,
    minimumFreeMinutes: 10,
    calendarBufferBeforeMinutes: 0,
    calendarBufferAfterMinutes: 0,
  };
  const save = jest
    .fn<
      ReturnType<DailyPlanningDependencies['repository']['save']>,
      Parameters<DailyPlanningDependencies['repository']['save']>
    >()
    .mockResolvedValue(undefined);
  const deps: DailyPlanningDependencies = {
    repository: {
      getSettings: async () => settings,
      load: async () => ({
        settings,
        source: 'source',
        history: [],
        gap: 30,
        tasks: [],
        saved: { revision: 'revision', plan },
        events: [
          {
            ...interval('13:00', '13:30'),
            kind: 'fixed',
            id: 'fixed',
            title: '面談',
            before: 15,
            after: 0,
          },
        ],
      }),
      save,
      addEvent: jest.fn(),
      removeEvent: jest.fn(),
      getGap: jest.fn(),
      setGap: jest.fn(),
    },
    calendar: {
      getPermission: async () => ({ status: 'granted', canAskAgain: true }),
      requestPermission: jest.fn(),
      listEvents: async () => ({ calendarCount: 1, discardedEventCount: 0, events: [meeting] }),
    },
  };
  return { deps, save };
}

it('renders the different kinds of intervals and routes a vertical drag through approval', async () => {
  const { deps, save } = fixture();
  const screen = await render(
    <DailyPlanningScreen deps={deps} mode="today" initialDate={day} openSettings={jest.fn()} />,
  );
  const axis = await screen.findByTestId('v2-day-timeline');
  expect(within(axis).getByLabelText(/読書、10:00〜10:30/)).toBeTruthy();
  expect(within(axis).getByLabelText(/面談、13:00〜13:30/)).toBeTruthy();
  expect(within(axis).getByLabelText(/歯医者、14:00〜14:30/)).toBeTruthy();
  expect(within(axis).getByLabelText(/昼食、12:00〜12:30/)).toBeTruthy();
  expect(within(axis).getByLabelText(/自由時間、16:00〜17:00/)).toBeTruthy();

  const block = screen.getByTestId('timeline-task:session');
  const position = (pageY: number) => ({ nativeEvent: { pageY } });
  await fireEvent(block, 'touchStart', position(310));
  await fireEvent(block, 'longPress', position(310));
  const target = 310 + 80 * Math.max(1, Dimensions.get('window').fontScale);
  await fireEvent(block, 'touchMove', position(target));
  expect(within(screen.getByTestId('timeline-drop-time')).getByText('11:00〜11:30')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await fireEvent(block, 'touchEnd', position(target));
  expect(await screen.findByText('変更前　10:00〜10:30')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'この変更を保存' }));
  expect(save).toHaveBeenCalledWith(
    day,
    'revision',
    'source',
    expect.objectContaining({
      sessions: [expect.objectContaining({ ...interval('11:00', '11:30'), locked: true })],
    }),
  );
});

it('keeps the numeric edit open when it would overlap a fixed event', async () => {
  const { deps, save } = fixture();
  const screen = await render(
    <DailyPlanningScreen deps={deps} mode="today" initialDate={day} openSettings={jest.fn()} />,
  );
  await fireEvent.press(await screen.findByTestId('timeline-task:session'));
  expect(screen.getByRole('button', { name: '作業枠を完了' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '開始・終了時刻を入力' }));
  await fireEvent.changeText(screen.getByLabelText('開始時刻'), '13:00');
  await fireEvent.changeText(screen.getByLabelText('終了時刻'), '13:30');
  await fireEvent.press(screen.getByRole('button', { name: '変更を確認' }));
  expect(screen.getByDisplayValue('13:00')).toBeTruthy();
  expect(screen.getByText(/時刻、衝突、自由時間/)).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
});

it('takes the selected date from Calendar to Today without exposing work editing in Calendar', async () => {
  const { deps } = fixture();
  const openDayPlan = jest.fn();
  const screen = await render(
    <DailyPlanningScreen
      deps={deps}
      mode="calendar"
      initialDate={day}
      openSettings={jest.fn()}
      openDayPlan={openDayPlan}
    />,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'この日の作業計画を開く' }));
  expect(openDayPlan).toHaveBeenCalledWith(day);
  expect(screen.queryByTestId('v2-day-timeline')).toBeNull();
  expect(screen.getByRole('button', { name: '予定を追加' })).toBeTruthy();
});
