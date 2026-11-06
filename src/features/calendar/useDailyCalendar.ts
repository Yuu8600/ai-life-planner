import { useEffect, useState } from 'react';
import { getUtcDayBounds } from '@/features/today';
import type { CalendarRepository } from './repositories/CalendarRepository';
import type { CalendarEvent } from './types';

/** Independent, permission-check-only read. Calendar failures never gate Today operations. */
export function useDailyCalendar(
  repository: CalendarRepository | null,
  localDate: string | null,
  timezone: string | null,
  revision: number,
) {
  const [result, setResult] = useState<{
    repository: CalendarRepository | null;
    localDate: string;
    timezone: string;
    revision: number;
    events: CalendarEvent[];
    message: string | null;
  } | null>(null);
  useEffect(() => {
    if (!repository || !localDate || !timezone) return;
    let active = true;
    const publish = (events: CalendarEvent[], message: string | null) => {
      if (active) setResult({ repository, localDate, timezone, revision, events, message });
    };
    void (async () => {
      try {
        const permission = await repository.getPermission();
        if (!active) return;
        if (permission.status !== 'granted') {
          publish([], 'Calendar予定は表示できません。カレンダー画面で権限を確認してください。');
          return;
        }
        const loaded = await repository.listEvents(getUtcDayBounds(localDate, timezone), localDate);
        publish(
          loaded.events,
          loaded.calendarCount === 0 ? '読み取り可能なCalendarがありません。' : null,
        );
      } catch {
        publish([], 'Calendar予定を読み込めませんでした。計画の操作は引き続き利用できます。');
      }
    })();
    return () => {
      active = false;
    };
  }, [repository, localDate, timezone, revision]);
  if (!repository || !localDate || !timezone)
    return {
      events: [],
      message: repository ? null : 'この環境ではCalendar予定を表示できません。',
    };
  if (
    result?.repository !== repository ||
    result.localDate !== localDate ||
    result.timezone !== timezone ||
    result.revision !== revision
  )
    return { events: [], message: 'Calendar予定を確認しています。' };
  return { events: result.events, message: result.message };
}
