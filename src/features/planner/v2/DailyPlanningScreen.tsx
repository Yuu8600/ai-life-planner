import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { addLocalDays, formatPlanningTime, getPlanningDate } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { DeadlineCalendar } from '@/shared/components/DeadlineCalendar';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, spacing, typography } from '@/shared/theme';
import {
  approvePlan,
  loadDay,
  previewPlan,
  previewInitialPlan,
  type DailyPlanningDependencies,
  type LoadedDay,
  type PlanPreview,
} from './dayService';
import { calendarConflicts, weeklyCompletedDays } from './engine';
import { EventEditor, readPlanTime } from './EventEditor';
import { CalendarAgenda } from './CalendarAgenda';
import { DayTimeline, timelineKinds } from './DayTimeline';
import {
  focusedTimelineWindow,
  sessionLabel,
  timelineEntries,
  timelineWindow,
  type TimelineEntry,
} from './timelineEntries';
import { reportPlanningIssue } from './planningDiagnostics';
import { WorkSessionDetails } from './WorkSessionDetails';
import type { PlanChange, WorkSession } from './types';

const statusLabels = {
  completed: '完了',
  skipped: '取りやめ',
  deferred: 'あとで',
  scheduled: '予定',
};

export function DailyPlanningScreen({
  deps,
  mode,
  initialTaskId,
  initialDate,
  review,
  openSettings,
  closeAdvanced,
  renderLegacyHistory,
  openDayPlan,
}: {
  deps: DailyPlanningDependencies;
  mode: 'today' | 'calendar';
  initialTaskId?: string;
  initialDate?: string;
  review?: string;
  openSettings: () => void;
  closeAdvanced?: () => void;
  openDayPlan?: (date: string) => void;
  renderLegacyHistory?: (date: string) => ReactNode;
}) {
  const [selected, setSelected] = useState(initialDate);
  const [dateDraft, setDateDraft] = useState<string>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [loaded, setLoaded] = useState<LoadedDay>();
  const [today, setToday] = useState('');
  const [limitedDate, setLimitedDate] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [calendarPermissionError, setCalendarPermissionError] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<PlanPreview>();
  const [legacyDate, setLegacyDate] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [fullDay, setFullDay] = useState(false);
  const [showUnplaced, setShowUnplaced] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [detail, setDetail] = useState<TimelineEntry>();
  const [detailId, setDetailId] = useState<string>();
  const [moveError, setMoveError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [edit, setEdit] = useState<{ session: WorkSession; from: string; to: string }>();
  const [focused, setFocused] = useState(false);
  const confirmedRequest = useRef<string | undefined>(undefined);
  const committing = useRef(false);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setNow(Date.now());
      reload();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') reload();
      });
      return () => {
        subscription.remove();
        setFocused(false);
      };
    }, [reload]),
  );

  useEffect(() => {
    if (!focused) return;
    let active = true;
    void (async () => {
      let operation = 'plan.settings';
      try {
        const settings = await deps.repository.getSettings();
        const current = getPlanningDate(new Date(), settings);
        const date = selected ?? current;
        if (!active) return;
        setToday(current);
        operation = 'plan.load';
        const day = await loadDay(deps, date, limitedDate === date);
        if (!active) return;
        const reviewRequested =
          review && date === initialDate && confirmedRequest.current !== review;
        setLoaded(day);
        setError('');
        setCalendarPermissionError('');
        if (reviewRequested && day.allowed) {
          operation = 'plan.preview';
          confirmedRequest.current = review;
          setPreview(
            day.saved
              ? previewPlan(day, { kind: 'replan', taskId: initialTaskId })
              : previewInitialPlan(day, initialTaskId),
          );
        }
      } catch (e) {
        if (!active) return;
        setError(reportPlanningIssue(operation, e) ?? '計画を読み込めませんでした。');
      }
    })();
    return () => {
      active = false;
    };
  }, [deps, focused, refresh, selected, limitedDate, review, initialDate, initialTaskId]);

  const day = loaded?.input.date === (selected ?? today) ? loaded : undefined;
  const saved = day?.saved?.plan;
  const timeline = useMemo(
    () =>
      day && mode === 'today'
        ? { entries: timelineEntries(day), window: timelineWindow(day) }
        : null,
    [day, mode],
  );
  const suggest = (change: PlanChange, localError = setError) => {
    if (!day || committing.current) return false;
    try {
      const next = previewPlan({ ...day, input: { ...day.input, now: Date.now() } }, change);
      if (day.saved && JSON.stringify(next.plan) === JSON.stringify(day.saved.plan)) {
        localError('変更できる作業枠・生活予定はありません。');
        return false;
      }
      setPreview(next);
      setError('');
      setDetailError('');
      return true;
    } catch (e) {
      localError(e instanceof Error ? e.message : '変更案を作成できませんでした。');
      return false;
    }
  };
  const switchDate = (date: string | undefined) => {
    setSelected(date);
    setBrowse(false);
    setShowUnplaced(false);
    setFullDay(false);
    setDetail(undefined);
    setDetailId(undefined);
    setEdit(undefined);
    scroll.current?.scrollTo({ y: 0, animated: false });
    setPreview(undefined);
    setError('');
  };
  async function confirm() {
    if (!preview || committing.current) return;
    committing.current = true;
    setPending(true);
    try {
      await approvePlan(deps, preview, limitedDate === preview.plan.date);
      setPreview(undefined);
      reload();
    } catch (e) {
      setPreview(undefined);
      setError(reportPlanningIssue('plan.approve', e) ?? '計画を保存できませんでした。');
      if (review) confirmedRequest.current = undefined;
    } finally {
      committing.current = false;
      setPending(false);
    }
  }
  const time = (value: string) =>
    day ? formatPlanningTime(value, day.input.date, day.input.timezone) : '';
  const dropError = (e: unknown) =>
    setError(reportPlanningIssue('plan.event', e) ?? '予定を更新できませんでした。');
  const conflicts = saved && day ? calendarConflicts(saved, day.input.busy) : [];
  const selectedSession = saved?.sessions.find((item) => item.id === detailId);
  const showTask = (id: string) => {
    setDetailError('');
    setBrowse(false);
    setDetailId(id);
  };
  const workTitle =
    preview && day
      ? '変更を確認'
      : edit
        ? '作業枠の時刻を編集'
        : (selectedSession?.title ?? (browse ? '作業枠を探す' : ''));
  const closeWork = () => {
    setBrowse(false);
    setDetailId(undefined);
    setDetailError('');
    setEdit(undefined);
    setPreview(undefined);
  };
  function reviewTimeEdit() {
    if (!edit || !day) return;
    try {
      const read = (value: string) => readPlanTime(value, day.input.date, day.input.timezone);
      if (
        suggest(
          {
            kind: 'move',
            id: edit.session.id,
            interval: { startAt: read(edit.from), endAt: read(edit.to) },
          },
          setDetailError,
        )
      )
        setEdit(undefined);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : '時刻を入力し直してください。');
    }
  }
  const workFooter =
    preview && day ? (
      <ActionButton label="この変更を保存" loading={pending} onPress={() => void confirm()} />
    ) : edit ? (
      <ActionButton label="変更を確認" onPress={reviewTimeEdit} />
    ) : selectedSession?.status === 'scheduled' ? (
      <ActionButton
        label="作業枠を完了"
        onPress={() => {
          if (suggest({ kind: 'complete', id: selectedSession.id }, setDetailError))
            setDetailId(undefined);
        }}
      />
    ) : undefined;
  return (
    <AppScreen
      contentContainerStyle={styles.screen}
      scrollRef={scroll}
      scrollEnabled={!dragging}
      onScroll={({ nativeEvent }) => {
        scrollY.current = nativeEvent.contentOffset.y;
      }}
    >
      <ScreenHeader
        title={mode === 'today' ? '今日の計画' : 'カレンダー'}
        action={
          closeAdvanced ? (
            <ActionButton variant="ghost" label="戻る" onPress={closeAdvanced} />
          ) : (
            <ActionButton variant="ghost" label="設定" onPress={openSettings} />
          )
        }
      />
      {today ? (
        <View style={styles.row}>
          <ActionButton
            label="‹"
            accessibilityLabel="前の日"
            variant="secondary"
            onPress={() => switchDate(addLocalDays(selected ?? today, -1))}
          />
          <ActionButton
            accessibilityLabel={`表示日 ${selected ?? today}。日付を選ぶ`}
            label={selected ?? today}
            variant="ghost"
            onPress={() => setDateDraft(selected ?? today)}
          />
          <ActionButton
            label="›"
            accessibilityLabel="次の日"
            variant="secondary"
            onPress={() => switchDate(addLocalDays(selected ?? today, 1))}
          />
          {selected && selected !== today ? (
            <ActionButton label="今日" variant="ghost" onPress={() => switchDate(undefined)} />
          ) : null}
        </View>
      ) : null}
      {error ? <Notice tone="error" message={error} /> : null}
      {!day && !error ? <Text style={styles.text}>読み込み中…</Text> : null}
      {error ? <ActionButton label="再読み込み" variant="secondary" onPress={reload} /> : null}
      {day?.calendarError ? (
        <>
          <Notice tone="warning" message={calendarPermissionError || day.calendarError} />
          <View style={styles.row}>
            <ActionButton
              label="許可を確認"
              variant="secondary"
              onPress={() =>
                void deps.calendar
                  .requestPermission()
                  .then(async (result) => {
                    if (result.status === 'denied' && !result.canAskAgain)
                      await Linking.openSettings();
                    reload();
                  })
                  .catch((error: unknown) => {
                    reportPlanningIssue('calendar.requestPermission', error);
                    setCalendarPermissionError('iPhoneカレンダーの許可を確認できませんでした。');
                  })
              }
            />
            {!day.allowed ? (
              <ActionButton
                label="この日はアプリ内予定のみ使う"
                onPress={() => setLimitedDate(day.input.date)}
              />
            ) : null}
          </View>
        </>
      ) : null}
      {saved?.limited || (day?.allowed && day.calendarError) ? (
        <Notice tone="warning" message="この日の時間割にはアプリ内の予定だけを使用します。" />
      ) : null}
      {day ? (
        <>
          {mode === 'calendar' ? (
            <CalendarAgenda
              key={day.input.date}
              day={day}
              time={time}
              onAdd={() => setAdding(true)}
              onRemove={(id) => void deps.repository.removeEvent(id).then(reload).catch(dropError)}
              onOpenPlan={() => openDayPlan?.(day.input.date)}
            />
          ) : (
            <>
              {conflicts.length ? <Notice tone="warning" message={conflicts.join('\n')} /> : null}
              {saved?.warnings.length ? (
                <Notice tone="warning" message={saved.warnings.join('\n')} />
              ) : null}
              {saved ? (
                <ActionButton
                  label="再計画"
                  variant="secondary"
                  onPress={() => suggest({ kind: 'replan' })}
                />
              ) : (
                <>
                  <Text style={styles.text}>この日の保存済み時間割はありません。</Text>
                  {day.allowed && Date.parse(day.input.window.endAt) > now ? (
                    <ActionButton
                      label="時間割の案を見る"
                      variant="secondary"
                      onPress={() => {
                        try {
                          setPreview(
                            previewInitialPlan({
                              ...day,
                              input: { ...day.input, now: Date.now() },
                            }),
                          );
                          setError('');
                        } catch (reason) {
                          setError(
                            reason instanceof Error
                              ? reason.message
                              : '時間割の案を作成できませんでした。',
                          );
                        }
                      }}
                    />
                  ) : null}
                </>
              )}
              {day.deviceEvents.some((item) => item.allDay && item.status !== 'canceled') ? (
                <View style={styles.card}>
                  <Text style={styles.heading}>終日のiPhone予定</Text>
                  {day.deviceEvents
                    .filter((item) => item.allDay && item.status !== 'canceled')
                    .map((item) => (
                      <Text
                        key={`${item.calendarId}:${item.instanceId ?? item.id}:${item.startAt}`}
                        style={styles.text}
                      >
                        {item.title || '名称未設定の予定'}
                      </Text>
                    ))}
                </View>
              ) : null}
              {saved?.unplaced.length ? (
                <ActionButton
                  label={
                    showUnplaced
                      ? '未配置のタスクを隠す'
                      : `未配置のタスク ${saved.unplaced.length}件`
                  }
                  variant="ghost"
                  expanded={showUnplaced}
                  onPress={() => setShowUnplaced(!showUnplaced)}
                />
              ) : null}
              {showUnplaced
                ? saved?.unplaced.map((item) => (
                    <Card key={item.taskId} style={styles.card}>
                      <Text style={styles.heading}>
                        {day.tasks.find((task) => task.id === item.taskId)?.title ?? item.taskId}
                      </Text>
                      <Text style={styles.text}>{item.reason}</Text>
                      {item.reason.startsWith('期限切れ') ? (
                        <ActionButton
                          label="このタスクを再計画"
                          variant="secondary"
                          onPress={() => suggest({ kind: 'replan', taskId: item.taskId })}
                        />
                      ) : null}
                    </Card>
                  ))
                : null}
              {timeline ? (
                <DayTimeline
                  key={day.input.date}
                  window={
                    fullDay
                      ? timeline.window
                      : focusedTimelineWindow(
                          timeline.window,
                          day.input.window,
                          timeline.entries,
                          day.input.now,
                        )
                  }
                  workWindow={day.input.window}
                  date={day.input.date}
                  timezone={day.input.timezone}
                  entries={timeline.entries}
                  now={now}
                  scroll={scroll}
                  scrollY={scrollY}
                  onDragging={setDragging}
                  showFullDay={fullDay}
                  onToggleFullDay={() => setFullDay(!fullDay)}
                  onBrowse={saved?.sessions.length ? () => setBrowse(true) : undefined}
                  onOpen={(item) => {
                    if (item.kind === 'task') showTask(item.session.id);
                    else setDetail(item);
                  }}
                  onMove={(id, interval) => suggest({ kind: 'move', id, interval }, setMoveError)}
                />
              ) : null}
              {day.tasks
                .filter((task) => task.recurrence === 'weekly' && !task.completed)
                .map((task) => (
                  <Text style={styles.text} key={task.id}>
                    {task.title}　今週 {weeklyCompletedDays(task.id, day.input.date, day.history)} /{' '}
                    {task.weekdays.length} 日
                  </Text>
                ))}
            </>
          )}
        </>
      ) : null}
      {dateDraft && Platform.OS === 'android' ? (
        <DeadlineCalendar
          label="表示する日付"
          value={dateDraft}
          onChange={(date) => {
            switchDate(date);
            setDateDraft(undefined);
          }}
          onDismiss={() => setDateDraft(undefined)}
        />
      ) : dateDraft ? (
        <ModalFrame
          title="表示する日付"
          onClose={() => setDateDraft(undefined)}
          footer={
            <ActionButton
              label="この日を開く"
              onPress={() => {
                switchDate(dateDraft);
                setDateDraft(undefined);
              }}
            />
          }
        >
          <DeadlineCalendar
            label="表示する日付"
            value={dateDraft}
            onChange={setDateDraft}
            onDismiss={() => setDateDraft(undefined)}
          />
        </ModalFrame>
      ) : null}
      {day && renderLegacyHistory ? (
        <>
          <ActionButton
            variant="secondary"
            label={legacyDate === day.input.date ? 'V1の記録を閉じる' : 'V1の計画と実行履歴を見る'}
            onPress={() =>
              setLegacyDate(legacyDate === day.input.date ? undefined : day.input.date)
            }
          />
          {legacyDate === day.input.date ? renderLegacyHistory(day.input.date) : null}
        </>
      ) : null}
      {adding && day ? (
        <EventEditor
          date={day.input.date}
          timezone={day.input.timezone}
          close={() => setAdding(false)}
          save={async (event) => {
            await deps.repository.addEvent(day.input.date, event);
            reload();
          }}
        />
      ) : null}
      {moveError ? (
        <ModalFrame
          title="この時刻には移動できません"
          onClose={() => setMoveError('')}
          footer={<ActionButton label="タイムラインに戻る" onPress={() => setMoveError('')} />}
        >
          <Notice tone="warning" message={moveError} />
        </ModalFrame>
      ) : null}
      {detail ? (
        <ModalFrame title={detail.title} onClose={() => setDetail(undefined)}>
          <Text style={styles.text}>
            {timelineKinds[detail.kind].label} · {time(detail.startAt)}〜{time(detail.endAt)}
          </Text>
        </ModalFrame>
      ) : null}
      {workTitle ? (
        <ModalFrame
          title={workTitle}
          onClose={closeWork}
          closeDisabled={pending}
          footer={workFooter}
        >
          {browse && saved ? (
            <>
              {saved.sessions.map((item) => (
                <ActionButton
                  key={item.id}
                  variant="secondary"
                  label={`${time(item.startAt)} · ${item.title} · ${sessionLabel(item, now)}`}
                  onPress={() => showTask(item.id)}
                />
              ))}
            </>
          ) : null}
          {selectedSession ? (
            <WorkSessionDetails
              item={selectedSession}
              now={now}
              time={time}
              error={detailError}
              edit={() => {
                setDetailId(undefined);
                setEdit({
                  session: selectedSession,
                  from: time(selectedSession.startAt),
                  to: time(selectedSession.endAt),
                });
              }}
              suggest={(change) => {
                if (suggest(change, setDetailError)) setDetailId(undefined);
              }}
            />
          ) : null}
          {edit && day ? (
            <>
              {detailError ? <Notice tone="error" message={detailError} /> : null}
              <FormField
                label="開始時刻"
                helper="HH:MM。日をまたぐ活動時間は「翌日 01:00」の形式。"
              >
                <FormInput value={edit.from} onChangeText={(from) => setEdit({ ...edit, from })} />
              </FormField>
              <FormField label="終了時刻">
                <FormInput value={edit.to} onChangeText={(to) => setEdit({ ...edit, to })} />
              </FormField>
            </>
          ) : null}
          {preview && day ? (
            <>
              {preview.change.kind === 'move'
                ? (() => {
                    const id = preview.change.id;
                    const from = saved?.sessions.find((item) => item.id === id);
                    return from ? (
                      <Text style={styles.text}>
                        変更前　{time(from.startAt)}〜{time(from.endAt)}
                      </Text>
                    ) : null;
                  })()
                : null}
              {preview.change.kind === 'skip' ? (
                <Text style={styles.text}>
                  選んだ枠だけを取りやめ、このタスクの当日の自動追加を停止します。
                </Text>
              ) : null}
              {preview.change.kind === 'initial' ? (
                <Text style={styles.text}>保存すると、この日の時間割として登録されます。</Text>
              ) : null}
              {preview.plan.unplaced
                .filter(
                  (item) =>
                    !saved?.unplaced.some(
                      (prior) => prior.taskId === item.taskId && prior.reason === item.reason,
                    ),
                )
                .map((item) => (
                  <Text key={item.taskId} style={styles.text}>
                    {day.tasks.find((task) => task.id === item.taskId)?.title ?? 'Task'}　
                    {item.reason}
                  </Text>
                ))}
              {preview.plan.sessions
                .filter(
                  (item) =>
                    !saved?.sessions.some(
                      (prior) => JSON.stringify(prior) === JSON.stringify(item),
                    ),
                )
                .map((item) => (
                  <Text style={styles.text} key={item.id}>
                    {item.title}　{time(item.startAt)}〜{time(item.endAt)}　
                    {statusLabels[item.status]}
                    {item.locked ? '・固定' : ''}
                  </Text>
                ))}
              {preview.plan.lifestyle
                .filter(
                  (item) =>
                    !saved?.lifestyle.some(
                      (prior) =>
                        item.id === prior.id &&
                        item.startAt === prior.startAt &&
                        item.endAt === prior.endAt,
                    ),
                )
                .map((item) => (
                  <Text key={item.id} style={styles.text}>
                    {item.title}　{time(item.startAt)}〜{time(item.endAt)}
                  </Text>
                ))}
              {preview.plan.warnings
                .filter((message) => !saved?.warnings.includes(message))
                .map((message) => (
                  <Notice key={message} tone="warning" message={message} />
                ))}
            </>
          ) : null}
        </ModalFrame>
      ) : null}
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.sm },
  heading: { ...typography.sectionTitle, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textPrimary },
});
