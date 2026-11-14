import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { addLocalDays, formatPlanningTime, getPlanningDate } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { appAlert } from '@/shared/feedback/appAlert';
import {
  approvePlan,
  generateFirstPlan,
  loadDay,
  previewPlan,
  type DailyPlanningDependencies,
  type LoadedDay,
  type PlanPreview,
} from './dayService';
import { calendarConflicts, weeklyCompletedDays } from './engine';
import { EventEditor, readPlanTime } from './EventEditor';
import { SessionDrag } from './SessionDrag';
import type { PlanChange, WorkSession } from './types';

const statusLabels = {
  completed: '完了',
  skipped: '今日はしない',
  deferred: 'あとで',
  scheduled: '予定',
};

export function DailyPlanningScreen({
  deps,
  mode,
  initialTaskId,
  openSettings,
}: {
  deps: DailyPlanningDependencies;
  mode: 'today' | 'calendar';
  initialTaskId?: string;
  openSettings: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [loaded, setLoaded] = useState<LoadedDay>();
  const [today, setToday] = useState('');
  const [limitedDate, setLimitedDate] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<PlanPreview>();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<{ session: WorkSession; from: string; to: string }>();
  const [focused, setFocused] = useState(false);
  const confirmedRequest = useRef<string | undefined>(undefined);
  const committing = useRef(false);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
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
      try {
        const settings = await deps.repository.getSettings();
        const current = getPlanningDate(new Date(), settings);
        const date = selected ?? current;
        if (!active) return;
        setToday(current);
        const day = await loadDay(deps, date, limitedDate === date);
        if (!active) return;
        const result = await generateFirstPlan(deps, day);
        if (!active) return;
        setLoaded(result);
        setError('');
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '計画を読み込めませんでした。');
      }
    })();
    return () => {
      active = false;
    };
  }, [deps, focused, refresh, selected, limitedDate]);

  const day = loaded?.input.date === (selected ?? today) ? loaded : undefined;
  const saved = day?.saved?.plan;
  const suggest = (change: PlanChange) => {
    if (!day || committing.current) return;
    try {
      setPreview(previewPlan({ ...day, input: { ...day.input, now: Date.now() } }, change));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '変更案を作成できませんでした。');
    }
  };
  useEffect(() => {
    if (!initialTaskId || !day?.saved || !day.allowed || confirmedRequest.current === initialTaskId)
      return;
    confirmedRequest.current = initialTaskId;
    try {
      setPreview(previewPlan(day, { kind: 'replan', taskId: initialTaskId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '変更案を作成できませんでした。');
    }
  }, [day, initialTaskId]);

  const switchDate = (date: string | undefined) => {
    setSelected(date);
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
      setError(e instanceof Error ? e.message : '計画を保存できませんでした。');
    } finally {
      committing.current = false;
      setPending(false);
    }
  }
  const time = (value: string) =>
    day ? formatPlanningTime(value, day.input.date, day.input.timezone) : '';
  const dropError = (e: unknown) =>
    setError(e instanceof Error ? e.message : '予定を更新できませんでした。');
  const conflicts = saved && day ? calendarConflicts(saved, day.input.busy) : [];
  const now = Date.now();
  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <ScreenHeader
        title={mode === 'today' ? '今日の計画' : 'カレンダー'}
        action={<ActionButton variant="ghost" label="設定" onPress={openSettings} />}
      />
      {today ? (
        <View style={styles.row}>
          <ActionButton
            label="前の日"
            variant="secondary"
            onPress={() => switchDate(addLocalDays(selected ?? today, -1))}
          />
          <Text style={styles.text}>{selected ?? today}</Text>
          <ActionButton
            label="次の日"
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
          <Notice tone="warning" message={day.calendarError} />
          <View style={styles.row}>
            <ActionButton
              label="許可を確認"
              variant="secondary"
              onPress={() =>
                void deps.calendar
                  .requestPermission()
                  .then((result) => {
                    if (result.status === 'denied' && !result.canAskAgain)
                      void Linking.openSettings();
                    reload();
                  })
                  .catch(dropError)
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
        <Notice tone="warning" message="端末カレンダーを確認できない状態で作成した計画です。" />
      ) : null}
      {day ? (
        <>
          {mode === 'calendar' ? (
            <Card style={styles.card}>
              <ActionButton label="アプリ内予定を追加" onPress={() => setAdding(true)} />
              {day.events
                .filter(
                  (item) =>
                    item.startAt < day.input.window.endAt && item.endAt > day.input.window.startAt,
                )
                .map((item) => (
                  <View style={styles.row} key={item.id}>
                    <Text style={styles.text}>
                      {item.title}　{time(item.startAt)}〜{time(item.endAt)}　
                      {item.kind === 'fixed'
                        ? `移動 前${item.before}分／後${item.after}分`
                        : `柔軟・${item.duration}分`}
                    </Text>
                    <ActionButton
                      label="削除"
                      variant="ghost"
                      accessibilityLabel={`${item.title}を削除`}
                      onPress={() =>
                        appAlert.alert('予定を削除しますか？', item.title, [
                          { text: 'キャンセル', style: 'cancel' },
                          {
                            text: '削除',
                            style: 'destructive',
                            onPress: () =>
                              void deps.repository
                                .removeEvent(item.id)
                                .then(reload)
                                .catch(dropError),
                          },
                        ])
                      }
                    />
                  </View>
                ))}
              <Text style={styles.heading}>固定・移動で使えない時間</Text>
              {day.input.busy.length ? (
                day.input.busy.map((block, index) => (
                  <Text style={styles.text} key={index}>
                    {time(block.startAt)}〜{time(block.endAt)}
                  </Text>
                ))
              ) : (
                <Text style={styles.text}>この時間帯に固定枠はありません。</Text>
              )}
            </Card>
          ) : null}
          {!saved ? <Text style={styles.text}>この日の保存済み計画はありません。</Text> : null}
          {saved ? (
            <>
              {conflicts.length ? <Notice tone="warning" message={conflicts.join('\n')} /> : null}
              {saved.warnings.length ? (
                <Notice tone="warning" message={saved.warnings.join('\n')} />
              ) : null}
              <ActionButton
                label="衝突した作業枠を再計画"
                variant="secondary"
                onPress={() => suggest({ kind: 'replan' })}
              />
              {saved.leisure.length ? (
                <Card style={styles.card}>
                  <Text style={styles.heading}>確保した自由時間</Text>
                  {saved.leisure.map((item) => (
                    <Text key={item.startAt} style={styles.text}>
                      {time(item.startAt)}〜{time(item.endAt)}
                    </Text>
                  ))}
                </Card>
              ) : null}
              {saved.lifestyle.map((item) => (
                <Card key={item.id} style={styles.card}>
                  <Text style={styles.heading}>{item.title}</Text>
                  <Text style={styles.text}>
                    {time(item.startAt)}〜{time(item.endAt)}
                  </Text>
                </Card>
              ))}
              {saved.sessions.map((item) => (
                <Card key={item.id} style={styles.card}>
                  <Text style={styles.heading}>{item.title}</Text>
                  <Text style={styles.text}>
                    {time(item.startAt)}〜{time(item.endAt)}　
                    {item.status === 'scheduled' && Date.parse(item.endAt) <= now
                      ? '未確認'
                      : statusLabels[item.status]}
                    {item.locked ? '・固定' : ''}
                  </Text>
                  {item.status === 'scheduled' ? (
                    <>
                      {Date.parse(item.startAt) > now ? (
                        <>
                          <SessionDrag
                            window={saved.window}
                            session={item}
                            onDrop={(interval) => suggest({ kind: 'move', id: item.id, interval })}
                          />
                          <ActionButton
                            label="開始・終了時刻を入力"
                            variant="secondary"
                            onPress={() =>
                              setEdit({
                                session: item,
                                from: time(item.startAt),
                                to: time(item.endAt),
                              })
                            }
                          />
                        </>
                      ) : null}
                      <View style={styles.row}>
                        <ActionButton
                          label="枠を完了"
                          variant="ghost"
                          onPress={() => suggest({ kind: 'complete', id: item.id })}
                        />
                        <ActionButton
                          label="あとで"
                          disabled={item.locked}
                          variant="ghost"
                          onPress={() => suggest({ kind: 'later', id: item.id })}
                        />
                        <ActionButton
                          label="この枠を今日はしない"
                          variant="ghost"
                          onPress={() => suggest({ kind: 'skip', id: item.id })}
                        />
                        {item.locked ? (
                          <ActionButton
                            label="固定解除"
                            variant="ghost"
                            onPress={() => suggest({ kind: 'unlock', id: item.id })}
                          />
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </Card>
              ))}
              {saved.unplaced.map((item) => (
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
              ))}
              {day.tasks
                .filter((task) => task.recurrence === 'weekly' && !task.completed)
                .map((task) => (
                  <Text style={styles.text} key={task.id}>
                    {task.title}　今週 {weeklyCompletedDays(task.id, day.input.date, day.history)} /{' '}
                    {task.weekdays.length} 日
                  </Text>
                ))}
            </>
          ) : null}
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
      {edit && day ? (
        <ModalFrame
          title="作業枠の時刻を編集"
          onClose={() => setEdit(undefined)}
          footer={
            <ActionButton
              label="変更を確認"
              onPress={() => {
                try {
                  const read = (value: string) =>
                    readPlanTime(value, day.input.date, day.input.timezone);
                  suggest({
                    kind: 'move',
                    id: edit.session.id,
                    interval: { startAt: read(edit.from), endAt: read(edit.to) },
                  });
                  setEdit(undefined);
                } catch (e) {
                  setEdit(undefined);
                  dropError(e);
                }
              }}
            />
          }
        >
          <FormField label="開始時刻">
            <FormInput value={edit.from} onChangeText={(from) => setEdit({ ...edit, from })} />
          </FormField>
          <FormField label="終了時刻">
            <FormInput value={edit.to} onChangeText={(to) => setEdit({ ...edit, to })} />
          </FormField>
        </ModalFrame>
      ) : null}
      {preview && saved ? (
        <ModalFrame
          title="変更を確認"
          onClose={() => setPreview(undefined)}
          closeDisabled={pending}
          footer={
            <ActionButton label="この変更を保存" loading={pending} onPress={() => void confirm()} />
          }
        >
          {preview.change.kind === 'skip' ? (
            <Text style={styles.text}>
              選んだ枠だけを取りやめ、このタスクの当日の自動追加を停止します。
            </Text>
          ) : null}
          {preview.plan.sessions
            .filter(
              (item) =>
                !saved.sessions.some((prior) => JSON.stringify(prior) === JSON.stringify(item)),
            )
            .map((item) => (
              <Text style={styles.text} key={item.id}>
                {item.title}　{time(item.startAt)}〜{time(item.endAt)}　{statusLabels[item.status]}
                {item.locked ? '・固定' : ''}
              </Text>
            ))}
          {preview.plan.warnings
            .filter((message) => !saved.warnings.includes(message))
            .map((message) => (
              <Notice key={message} tone="warning" message={message} />
            ))}
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
