import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { getUtcDayBounds, formatLocalTimeJa } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { Notice } from '@/shared/components/Notice';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { useTheme } from '@/shared/theme';

import type { CalendarRepository } from './repositories/CalendarRepository';
import type { FixedEventRepository } from './FixedEventRepository';
import { recommendationIntervals, type AgendaAvailability } from './recommendationCalendar';
import type { CalendarEvent, CalendarInterval } from './types';

export type AgendaWindowInput = {
  date: string;
  timezone: string;
  revision: number;
  intervals: CalendarInterval[];
  availability: AgendaAvailability;
  loading: boolean;
  permissionMissing?: boolean;
};

type Props = {
  date: string;
  timezone: string;
  calendar: CalendarRepository;
  fixed: FixedEventRepository;
  revision: number;
  summary?: boolean;
  now?: number;
  onSchedule?: (state: AgendaWindowInput) => void;
  onOpenCalendar?: () => void;
};

type DayState<T> = {
  key: string;
  values: T[];
  status: 'ready' | 'permission' | 'missing' | 'error';
  canAsk?: boolean;
};

export function DayAgenda({
  date,
  timezone,
  calendar,
  fixed,
  revision,
  summary,
  now,
  onSchedule,
  onOpenCalendar,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const [device, setDevice] = useState<DayState<CalendarEvent>>();
  const [local, setLocal] =
    useState<DayState<Awaited<ReturnType<FixedEventRepository['list']>>[number]>>();
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const bounds = getUtcDayBounds(date, timezone);
  const requestKey = JSON.stringify([date, timezone, revision, retry]);

  useEffect(() => {
    let active = true;
    const day = getUtcDayBounds(date, timezone);
    void (async () => {
      try {
        const permission = await calendar.getPermission();
        if (!active) return;
        if (permission.status !== 'granted') {
          setDevice({
            key: requestKey,
            values: [],
            status: 'permission',
            canAsk: permission.canAskAgain,
          });
          return;
        }
        const result = await calendar.listEvents(day, date);
        if (active)
          setDevice({
            key: requestKey,
            values: result.events.filter((event) => event.status !== 'canceled'),
            status: result.calendarCount ? 'ready' : 'missing',
          });
      } catch {
        if (active) setDevice({ key: requestKey, values: [], status: 'error' });
      }
    })();
    void fixed.list(day).then(
      (values) => {
        if (active) setLocal({ key: requestKey, values, status: 'ready' });
      },
      () => {
        if (active) setLocal({ key: requestKey, values: [], status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [calendar, fixed, date, timezone, requestKey]);

  const deviceState = device?.key === requestKey ? device : undefined;
  const localState = local?.key === requestKey ? local : undefined;
  useEffect(() => {
    if (!onSchedule) return;
    const deviceReady = deviceState?.status === 'ready';
    const localReady = localState?.status === 'ready';
    onSchedule({
      date,
      timezone,
      revision,
      intervals: recommendationIntervals(
        deviceState?.values ?? [],
        localState?.values ?? [],
        timezone,
      ),
      loading: !deviceState || !localState,
      permissionMissing: deviceState?.status === 'permission',
      availability:
        deviceReady && localReady ? 'all' : deviceReady || localReady ? 'partial' : 'none',
    });
  }, [deviceState, localState, date, timezone, revision, onSchedule]);

  async function checkPermission() {
    if (permissionBusy) return;
    setPermissionBusy(true);
    setActionError('');
    try {
      if (device?.canAsk) await calendar.requestPermission();
      else await Linking.openSettings();
      setRetry((value) => value + 1);
    } catch {
      setActionError('端末の設定からカレンダー権限を確認してください。');
    } finally {
      setPermissionBusy(false);
    }
  }

  const events = [
    ...(deviceState?.values ?? []).map((event) => ({
      ...event,
      key: JSON.stringify([event.calendarId, event.id, event.startAt]),
      source: '端末カレンダー',
    })),
    ...(localState?.values ?? []).map((event) => ({
      ...event,
      key: event.id,
      source: 'アプリ内の予定',
      allDay: false,
    })),
  ].sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.startAt) - Date.parse(b.startAt),
  );
  const time = { ...typography.secondary, color: colors.textSecondary };
  const refresh = () => setRetry((value) => value + 1);
  const upcoming =
    now === undefined
      ? events
      : events.filter((event) => event.allDay || Date.parse(event.endAt) > now);
  const shown = summary ? upcoming.slice(0, 3) : events;

  return (
    <View style={{ gap: spacing.sm }}>
      {summary ? <SectionHeader title="直近の予定" /> : null}
      {shown.map((event) => (
        <Card key={event.key} style={{ gap: spacing.xs }}>
          <Text style={time}>
            {event.allDay
              ? '終日'
              : [
                  Date.parse(event.startAt) < Date.parse(bounds.startAt)
                    ? '前日から'
                    : formatLocalTimeJa(event.startAt, timezone),
                  Date.parse(event.endAt) >= Date.parse(bounds.endAt)
                    ? '24:00'
                    : formatLocalTimeJa(event.endAt, timezone),
                ].join(' – ')}{' '}
            ・ {event.source}
          </Text>
          <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>{event.title}</Text>
          {!summary && event.source === 'アプリ内の予定' ? (
            <ActionButton
              label="予定を削除"
              accessibilityLabel={`${event.title}を削除`}
              variant="ghost"
              onPress={() =>
                appAlert.alert(
                  '予定を削除しますか？',
                  `${event.title}。削除すると元に戻せません。`,
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '削除',
                      style: 'destructive',
                      onPress: () => {
                        setActionError('');
                        void fixed
                          .remove(event.id)
                          .then(refresh, () =>
                            setActionError('予定を削除できませんでした。再試行してください。'),
                          );
                      },
                    },
                  ],
                )
              }
            />
          ) : null}
        </Card>
      ))}
      {!deviceState || !localState ? <Text style={time}>予定を確認しています。</Text> : null}
      {deviceState?.status === 'ready' && localState?.status === 'ready' && !events.length ? (
        <Text style={time}>表示する予定はありません。</Text>
      ) : null}
      {deviceState?.status === 'permission' ? (
        <Notice
          tone="warning"
          message="端末カレンダーの権限を確認してください。"
          action={
            !summary ? (
              <ActionButton
                label="権限を確認"
                loading={permissionBusy}
                variant="secondary"
                onPress={() => void checkPermission()}
              />
            ) : onOpenCalendar ? (
              <ActionButton label="予定タブを開く" variant="secondary" onPress={onOpenCalendar} />
            ) : undefined
          }
        />
      ) : null}
      {deviceState?.status === 'missing' ? (
        <Notice message="読み取り可能な端末カレンダーがありません。" />
      ) : null}
      {deviceState?.status === 'error' || localState?.status === 'error' ? (
        <Notice
          tone="warning"
          message={
            deviceState?.status === 'error'
              ? '端末の予定を読み込めませんでした。'
              : 'アプリ内の予定を読み込めませんでした。'
          }
          action={<ActionButton label="予定を再試行" variant="secondary" onPress={refresh} />}
        />
      ) : null}
      {actionError ? <Notice tone="error" message={actionError} /> : null}
      {onOpenCalendar && upcoming.length > 3 ? (
        <ActionButton
          label={`予定をすべて見る（${upcoming.length}件）`}
          variant="secondary"
          onPress={onOpenCalendar}
        />
      ) : null}
    </View>
  );
}
