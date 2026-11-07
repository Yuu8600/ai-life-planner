import { useEffect, useMemo, useState } from 'react';
import {
  loadCalendarPlanningEvents,
  type CalendarEvent,
  type CalendarRepository,
  type CalendarEventBufferRepository,
} from '@/features/calendar';
import { calculateFreeTime, type FreeTimeCalculationResult } from '@/features/planner';
import type { SettingsRepository } from '@/features/settings';
import { getPlanningDate } from './planningTime';
import { getUtcDayBounds } from './timezone';
import { datesInWindow, type AxisWindow } from './timeAxis';

type Availability = { result: FreeTimeCalculationResult; minimum: number };
type Result = {
  events: CalendarEvent[];
  message: string | null;
  availability: Availability | null;
  availabilityMessage: string;
};
const unavailable = '配置可能な空き時間を確認できません。白い隙間がすべて空き時間とは限りません。';

/** Independent read-only projections. A capacity failure never disables saved Action operations. */
export function useTodayCalendar(
  repository: CalendarRepository | null,
  settingsRepository: SettingsRepository | null,
  overrides: CalendarEventBufferRepository | null,
  date: string | null,
  timezone: string | null,
  window: AxisWindow | undefined,
  revision: number,
  now: () => Date,
) {
  const key = useMemo(
    () => ({
      repository,
      settingsRepository,
      overrides,
      date,
      timezone,
      startAt: window?.startAt,
      endAt: window?.endAt,
      revision,
      now,
    }),
    [
      repository,
      settingsRepository,
      overrides,
      date,
      timezone,
      window?.startAt,
      window?.endAt,
      revision,
      now,
    ],
  );
  const [loaded, setLoaded] = useState<{ key: object; value: Result } | null>(null);
  useEffect(() => {
    const { repository, settingsRepository, overrides, date, timezone, startAt, endAt, now } = key;
    const window = startAt && endAt ? { startAt, endAt } : undefined;
    if (!repository || !date || !timezone) return;
    let active = true;
    let value: Result = {
      events: [],
      message: 'Calendar予定を確認しています。',
      availability: null,
      availabilityMessage: unavailable,
    };
    const publish = (part: Partial<Result>) => {
      value = { ...value, ...part };
      if (active) setLoaded({ key, value });
    };
    void (async () => {
      try {
        if ((await repository.getPermission()).status !== 'granted') {
          publish({
            message: 'Calendar予定は表示できません。カレンダー画面で権限を確認してください。',
          });
          return;
        }
        if (!active) return;
        // Share reads between the display window and current calculation, including adjacent days.
        const cache = new Map<string, ReturnType<CalendarRepository['listEvents']>>();
        const cached: CalendarRepository = {
          getPermission: () => repository.getPermission(),
          requestPermission: () => repository.requestPermission(),
          listEvents: (interval, day) => {
            const id = JSON.stringify([interval, day]);
            if (!cache.has(id)) cache.set(id, repository.listEvents(interval, day));
            return cache.get(id)!;
          },
        };
        const display = Promise.all(
          datesInWindow(date, timezone, window).map((day) =>
            cached.listEvents(getUtcDayBounds(day, timezone), day),
          ),
        )
          .then((days) => {
            const events = [
              ...new Map(
                days
                  .flatMap((day) => day.events)
                  .map((event) => [
                    JSON.stringify([event.calendarId, event.id, event.startAt]),
                    event,
                  ]),
              ).values(),
            ];
            publish({
              events,
              message: days.every((day) => day.calendarCount === 0)
                ? '読み取り可能なCalendarがありません。'
                : null,
            });
            return days.some((day) => day.calendarCount > 0);
          })
          .catch(() => {
            publish({
              events: [],
              message: 'Calendar予定を読み込めませんでした。計画の操作は引き続き利用できます。',
            });
            return false;
          });
        const capacity = (async () => {
          if (!settingsRepository) return;
          const settings = await settingsRepository.getProfilePlanningSettings();
          if (getPlanningDate(now(), settings) !== date) return;
          const loaded = await loadCalendarPlanningEvents(
            cached,
            date,
            settings.timezone,
            settings.calendarBufferBeforeMinutes,
            settings.calendarBufferAfterMinutes,
            overrides,
            settings.planningEndDayOffset,
          );
          if (loaded.calendarCount === 0 || getPlanningDate(now(), settings) !== date) return;
          const result = calculateFreeTime({
            ...settings,
            selectedDate: date,
            events: loaded.calculationEvents,
            calendarEventBufferOverrides: loaded.overrides,
          });
          if (!(await display)) return;
          publish({
            availability: { result, minimum: settings.minimumFreeMinutes },
            availabilityMessage:
              '配置可能な空き時間: 最新の活動時間・余白・最小空き時間を適用し、配置済みActionと過去の時間を除いています。',
          });
        })().catch(() => publish({ availability: null, availabilityMessage: unavailable }));
        await Promise.all([display, capacity]);
      } catch {
        publish({
          message: 'Calendar予定を読み込めませんでした。計画の操作は引き続き利用できます。',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [key]);
  return loaded?.key === key
    ? loaded.value
    : {
        events: [],
        message: repository
          ? 'Calendar予定を確認しています。'
          : 'この環境ではCalendar予定を表示できません。',
        availability: null,
        availabilityMessage: unavailable,
      };
}
