import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getUtcDayBounds,
  getPlanningWindow,
  addLocalDays,
  formatLocalTimeJa,
} from '@/features/today';
import { calculateFreeTime } from '@/features/planner';
import type { ProfilePlanningSettings } from '@/features/settings';
import { ActionButton } from '@/shared/components/ActionButton';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { Notice } from '@/shared/components/Notice';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { useTheme } from '@/shared/theme';

import type { CalendarRepository } from './repositories/CalendarRepository';
import type { FixedEvent, FixedEventRepository } from './FixedEventRepository';
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
  onEditEvent?: (event: FixedEvent) => void;
  planningSettings?: ProfilePlanningSettings;
};

type DayState<T> = {
  scopeKey: string;
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
  onEditEvent,
  planningSettings,
}: Props) {
  const { colors, controls, radius, spacing, typography } = useTheme();
  const [device, setDevice] = useState<DayState<CalendarEvent>>();
  const [local, setLocal] =
    useState<DayState<Awaited<ReturnType<FixedEventRepository['list']>>[number]>>();
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const deleteLock = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const bounds = getUtcDayBounds(date, timezone);
  let planningWindow: CalendarInterval | undefined;
  try {
    if (planningSettings) planningWindow = getPlanningWindow(date, planningSettings);
  } catch {
    // The calculation below reports invalid settings without hiding the agenda.
  }
  const queryStart =
    Math.min(Date.parse(bounds.startAt), Date.parse(planningWindow?.startAt ?? bounds.startAt)) -
    (planningSettings?.calendarBufferAfterMinutes ?? 0) * 60000;
  const queryEnd =
    Math.max(Date.parse(bounds.endAt), Date.parse(planningWindow?.endAt ?? bounds.endAt)) +
    (planningSettings?.calendarBufferBeforeMinutes ?? 0) * 60000;
  const scopeKey = JSON.stringify([date, timezone, queryStart, queryEnd]);

  useEffect(() => {
    let active = true;
    const day = {
      startAt: new Date(queryStart).toISOString(),
      endAt: new Date(queryEnd).toISOString(),
    };
    void (async () => {
      try {
        const permission = await calendar.getPermission();
        if (!active) return;
        if (permission.status !== 'granted') {
          setDevice({
            scopeKey,
            values: [],
            status: 'permission',
            canAsk: permission.canAskAgain,
          });
          return;
        }
        const results = await Promise.all([
          calendar.listEvents(day, date),
          ...(planningSettings?.planningEndDayOffset === 1
            ? [calendar.listEvents(day, addLocalDays(date, 1))]
            : []),
        ]);
        const result = results[0];
        const values = [
          ...new Map(
            results
              .flatMap((item) => item.events)
              .map((event) => [JSON.stringify([event.calendarId, event.id, event.startAt]), event]),
          ).values(),
        ];
        if (active)
          setDevice({
            scopeKey,
            values: values.filter((event) => event.status !== 'canceled'),
            status: result.calendarCount ? 'ready' : 'missing',
          });
      } catch {
        if (active) setDevice({ scopeKey, values: [], status: 'error' });
      }
    })();
    void fixed.list(day).then(
      (values) => {
        if (active) setLocal({ scopeKey, values, status: 'ready' });
      },
      () => {
        if (active) setLocal({ scopeKey, values: [], status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [
    calendar,
    fixed,
    date,
    timezone,
    revision,
    retry,
    scopeKey,
    queryStart,
    queryEnd,
    planningSettings?.planningEndDayOffset,
  ]);

  // Keep previous results for the same (date, timezone) while refreshing to avoid layout flicker.
  const deviceState = device?.scopeKey === scopeKey ? device : undefined;
  const localState = local?.scopeKey === scopeKey ? local : undefined;
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
      isApp: false,
    })),
    ...(localState?.values ?? []).map((event) => ({
      ...event,
      key: event.id,
      source: 'アプリ内の予定',
      allDay: false,
      isApp: true,
    })),
  ]
    .filter((event) =>
      event.allDay
        ? !('allDayStartDate' in event) ||
          !event.allDayStartDate ||
          (event.allDayStartDate <= date && !!event.allDayEndDate && event.allDayEndDate > date)
        : Date.parse(event.startAt) < Date.parse(bounds.endAt) &&
          Date.parse(event.endAt) > Date.parse(bounds.startAt),
    )
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) || Date.parse(a.startAt) - Date.parse(b.startAt),
    );
  const time = { ...typography.secondary, color: colors.textSecondary };
  const refresh = () => setRetry((value) => value + 1);
  const upcoming =
    now === undefined
      ? events
      : events.filter((event) => event.allDay || Date.parse(event.endAt) > now);
  const shown = summary ? upcoming.slice(0, 3) : events;

  let freeTime: ReturnType<typeof calculateFreeTime> | undefined;
  let freeError = '';
  if (planningSettings && deviceState && localState) {
    try {
      freeTime = calculateFreeTime({
        ...planningSettings,
        selectedDate: date,
        events: [
          ...deviceState.values.filter(
            (event) =>
              !event.allDay ||
              ((event.availability === 'busy' || event.availability === 'unavailable') &&
                !!event.allDayStartDate &&
                !!event.allDayEndDate),
          ),
          ...localState.values.map((event) => ({
            ...event,
            allDay: false,
            allDayStartDate: null,
            allDayEndDate: null,
            availability: 'busy' as const,
            status: 'confirmed' as const,
            calendarId: 'app',
            calendarTitle: null,
            instanceId: null,
            location: null,
            timeZone: timezone,
          })),
        ],
      });
    } catch {
      freeError = '空き時間を計算できませんでした。活動時間の設定を確認してください。';
    }
  }
  const complete = deviceState?.status === 'ready' && localState?.status === 'ready';
  const clock = (instant: string) =>
    `${Date.parse(instant) >= Date.parse(bounds.endAt) ? '翌日 ' : ''}${formatLocalTimeJa(instant, timezone)}`;

  return (
    <View style={{ gap: spacing.sm }}>
      {planningSettings && freeTime ? (
        <Card>
          <SectionHeader compact title="活動時間の空き枠" />
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            {clock(freeTime.planningWindow.startAt)} – {clock(freeTime.planningWindow.endAt)}・
            {planningSettings.minimumFreeMinutes}分以上の枠
          </Text>
          {!complete ? (
            <Notice
              tone="warning"
              message="一部の予定を確認できていません。確認できた予定のみを使った参考表示です。"
            />
          ) : null}
          <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
            {complete ? '空き時間' : '参考の空き時間'}：合計{' '}
            {Math.floor(
              freeTime.freeSlots.reduce((total, slot) => total + slot.durationMinutes, 0),
            )}{' '}
            分
          </Text>
          {freeTime.freeSlots.map((slot) => (
            <Text key={slot.startAt} style={{ ...typography.body, color: colors.textPrimary }}>
              {clock(slot.startAt)} – {clock(slot.endAt)}（{Math.floor(slot.durationMinutes)}分）
            </Text>
          ))}
          {!freeTime.freeSlots.length ? (
            <Text style={time}>条件に合う空き枠はありません。</Text>
          ) : null}
        </Card>
      ) : null}
      {freeError ? <Notice tone="warning" message={freeError} /> : null}
      {summary ? (
        <View style={styles.summaryHeader}>
          <SectionHeader compact title="直近の予定" />
          {onOpenCalendar && upcoming.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`予定をすべて見る（${upcoming.length}件）`}
              onPress={onOpenCalendar}
              style={({ pressed }) => [styles.moreLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ ...typography.label, color: colors.primary }}>すべて見る ›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {shown.length > 0 ? (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {shown.map((event, index) => (
            <View
              key={event.key}
              style={[
                styles.eventRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderSubtle,
                },
              ]}
            >
              <View
                style={[
                  styles.accentBar,
                  {
                    backgroundColor: event.isApp ? colors.primary : colors.calendar,
                    borderRadius: radius.pill,
                  },
                ]}
              />
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <View style={styles.eventMetaRow}>
                  <Text
                    style={{
                      ...typography.timeLabel,
                      fontVariant: ['tabular-nums'],
                      color: colors.textSecondary,
                    }}
                  >
                    {event.allDay
                      ? '終日'
                      : [
                          Date.parse(event.startAt) < Date.parse(bounds.startAt)
                            ? '前日から'
                            : formatLocalTimeJa(event.startAt, timezone),
                          Date.parse(event.endAt) >= Date.parse(bounds.endAt)
                            ? '24:00'
                            : formatLocalTimeJa(event.endAt, timezone),
                        ].join(' – ')}
                  </Text>
                  <Badge
                    label={event.isApp ? 'アプリ内' : '端末'}
                    tone={event.isApp ? 'accent' : 'neutral'}
                  />
                </View>
                <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
                  {event.title}
                </Text>
              </View>
              {!summary && event.isApp && onEditEvent && fixed.update ? (
                <ActionButton
                  label="編集"
                  accessibilityLabel={`${event.title}を編集`}
                  variant="secondary"
                  disabled={deleting}
                  onPress={() => {
                    const original = localState?.values.find((value) => value.id === event.id);
                    if (original) onEditEvent(original);
                  }}
                />
              ) : null}
              {!summary && event.isApp ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}を削除`}
                  disabled={deleting}
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
                            if (deleteLock.current) return;
                            deleteLock.current = true;
                            setDeleting(true);
                            setActionError('');
                            void fixed
                              .remove(event.id)
                              .then(refresh, () =>
                                setActionError('予定を削除できませんでした。再試行してください。'),
                              )
                              .finally(() => {
                                deleteLock.current = false;
                                setDeleting(false);
                              });
                          },
                        },
                      ],
                    )
                  }
                  style={({ pressed }) => ({
                    minHeight: controls.minimumTarget,
                    paddingHorizontal: spacing.sm,
                    justifyContent: 'center',
                    borderRadius: radius.sm,
                    backgroundColor: pressed ? colors.errorSoft : 'transparent',
                  })}
                >
                  <Text style={{ ...typography.label, color: colors.error }}>削除</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {!deviceState || !localState ? (
        <Card variant="flat" style={styles.emptyCard}>
          <Text style={time}>予定を確認しています。</Text>
        </Card>
      ) : null}

      {deviceState?.status === 'ready' && localState?.status === 'ready' && !events.length ? (
        <Card variant="flat" style={styles.emptyCard}>
          <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
            この日の予定はありません
          </Text>
        </Card>
      ) : null}

      {deviceState?.status === 'permission' ? (
        <Card style={styles.permissionCard}>
          <View style={styles.permissionRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
                端末カレンダー未連携
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                端末カレンダーの権限を確認してください。
              </Text>
            </View>
            {!summary ? (
              <ActionButton
                label="権限を確認"
                loading={permissionBusy}
                variant="secondary"
                style={styles.compactButton}
                onPress={() => void checkPermission()}
              />
            ) : onOpenCalendar ? (
              <ActionButton
                label="予定タブを開く"
                variant="secondary"
                style={styles.compactButton}
                onPress={onOpenCalendar}
              />
            ) : null}
          </View>
        </Card>
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

const styles = StyleSheet.create({
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  moreLink: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  permissionCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  compactButton: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
});
