import { effectivePolicies, policyLabels, type RecommendationPolicy } from './policy';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { AgendaAvailability } from '@/features/calendar';
import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';
import { getTaskErrorMessage } from '@/features/tasks/errors';
import { addLocalDays, formatLocalDateJa, getUtcDayBounds } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/theme';

import { recommend, targetKey, type Candidate } from './recommend';
import {
  type ActionStep,
  type Conditions,
  type Outcome,
  type RecommendationRepository,
  type RecommendationResult,
} from './repository';

const durations = [30, 60, 120, null] as const;
const durationOptions = durations.map((minutes) => ({
  value: String(minutes),
  label: minutes === null ? '指定なし' : minutes === 30 ? '30分' : `${minutes / 60}時間`,
}));

type Props = {
  taskRepository: TaskRepository;
  repository: RecommendationRepository;
  timezone: string;
  date: string;
  revision: number;
  initialConditions: Conditions;
  saveConditions: (value: Conditions) => void;
  agenda?: ReactNode;
  calendarLoading?: boolean;
  calendarWindow?: {
    minutes: number | null;
    until: number | null;
    availability?: AgendaAvailability;
    occupiedNow?: boolean;
  };
  openChat?: () => void;
  openSettings: () => void;
  openTasks: (filter?: 'overdue') => void;
  openStep: (taskId: string, minutes: number) => void;
};

type Snapshot = {
  date: string;
  tasks: Task[];
  steps: ActionStep[];
  results: RecommendationResult[];
  goals: Map<string, string>;
};

export function TodayRecommendationsScreen({
  taskRepository,
  repository,
  timezone,
  date,
  revision,
  initialConditions,
  saveConditions,
  agenda,
  calendarLoading,
  calendarWindow,
  openChat,
  openSettings,
  openTasks,
  openStep,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [conditions, setConditions] = useState<Conditions>({
    ...initialConditions,
    effort: 'normal',
  });
  const [shownCount, setShownCount] = useState(4);
  const [laterDate, setLaterDate] = useState<string>();
  const [lastChange, setLastChange] = useState<string>();
  const [policySheet, setPolicySheet] = useState(false);
  const [policies, setPolicies] = useState<{ date: string; values: RecommendationPolicy[] }>();
  const [policyError, setPolicyError] = useState('');
  const [policyBusy, setPolicyBusy] = useState(false);
  const policyLock = useRef(false);
  const publishedPolicies = policies?.date === date ? policies.values : [];
  const activePolicies = effectivePolicies(publishedPolicies, date);
  const [showHistory, setShowHistory] = useState(false);
  const [recordSelection, setRecordSelection] = useState<string[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    scope: 'recommendation' | 'quickAdd';
    error?: boolean;
  }>();
  const loadVersion = useRef(0);
  const writeLock = useRef(false);
  const current = snapshot?.date === date ? snapshot : undefined;
  const todayResults = current?.results.filter((item) => item.date === date) ?? [];
  const choices = useMemo(
    () =>
      current &&
      recommend({
        ...current,
        timezone,
        conditions,
        expandedToday: true,
        calendarMinutes: calendarWindow?.minutes,
        policies: policies?.date === date ? policies.values : undefined,
      }),
    [current, timezone, conditions, date, calendarWindow?.minutes, policies],
  );

  const fallback = choices?.startWith;
  const recentResults =
    current?.results.filter((item) => item.date < date && item.date >= addLocalDays(date, -6)) ??
    [];

  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;
    void (async () => {
      try {
        const [tasks, steps, results, goals] = await Promise.all([
          taskRepository.list(),
          repository.listSteps(),
          repository.listResults(addLocalDays(date, -90), date),
          taskRepository.listGoalOptions().catch(() => []),
        ]);
        if (!active || version !== loadVersion.current) return;
        setLoadError('');
        setSnapshot({
          date,
          tasks,
          steps,
          results,
          goals: new Map(goals.map((goal) => [goal.id, goal.title])),
        });
      } catch (error) {
        if (active && version === loadVersion.current) setLoadError(getTaskErrorMessage(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [taskRepository, repository, date, revision, retry]);

  useEffect(() => {
    if (!repository.listPolicies) return;
    let alive = true;
    void repository.listPolicies(date).then(
      (values) => {
        if (alive) {
          setPolicies({ date, values });
          setPolicyError('');
        }
      },
      () => {
        if (alive) {
          setPolicies(undefined);
          setPolicyError('推薦方針を読み込めませんでした。');
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [repository, date, revision, retry]);

  async function setPolicy(item: RecommendationPolicy, active: boolean) {
    if (!repository.setPolicyActive || policyLock.current) return;
    policyLock.current = true;
    setPolicyBusy(true);
    setPolicyError('');
    try {
      await repository.setPolicyActive(item.id, item.revision, active);
      setPolicies((old) =>
        old?.date === date
          ? {
              ...old,
              values: old.values.map((value) =>
                value.id === item.id
                  ? {
                      ...value,
                      status: active ? 'active' : 'revoked',
                      revision: value.revision + 1,
                    }
                  : value,
              ),
            }
          : old,
      );
    } catch (error) {
      setPolicyError(getTaskErrorMessage(error));
    } finally {
      policyLock.current = false;
      setPolicyBusy(false);
    }
  }

  function changeConditions(value: Conditions) {
    setConditions(value);
    setShownCount(4);
    saveConditions(value);
  }

  async function write(scope: 'recommendation' | 'quickAdd', operation: () => Promise<string>) {
    if (writeLock.current) return;
    writeLock.current = true;
    setBusy(true);
    setFeedback(undefined);
    setLastChange(undefined);
    try {
      const message = await operation();
      loadVersion.current++;
      setRetry((count) => count + 1);
      setFeedback({ message, scope });
    } catch (error) {
      setFeedback({ message: getTaskErrorMessage(error), scope, error: true });
      setRetry((count) => count + 1);
    } finally {
      writeLock.current = false;
      setBusy(false);
    }
  }

  function repeats(kind: Candidate['kind'], id: string) {
    return kind === 'task'
      ? (current?.tasks.find((task) => task.id === id)?.recurrence?.kind ?? 'once') !== 'once'
      : (current?.steps.some((step) => step.id === id && step.repeatable) ?? false);
  }

  function record(candidate: Candidate, requested: Outcome) {
    return write('recommendation', async () => {
      const outcome = await repository.record(date, candidate.kind, candidate.id, requested);
      setSnapshot((previous) => {
        if (previous?.date !== date) return previous;
        const saved: RecommendationResult = {
          date,
          kind: candidate.kind,
          targetId: candidate.id,
          taskId: candidate.taskId,
          goalId: candidate.goalId,
          title: candidate.title,
          outcome,
        };
        const results = previous.results.filter(
          (item) =>
            item.date !== date || item.kind !== candidate.kind || item.targetId !== candidate.id,
        );
        return { ...previous, results: [saved, ...results] };
      });
      setLastChange(`${date}:${targetKey(candidate.kind, candidate.id)}`);
      if (outcome === 'skipped') return `「${candidate.title}」を今日だけあとでにしました。`;
      const action = repeats(candidate.kind, candidate.id) ? '今日の実施' : '完了';
      return `「${candidate.title}」の${action}を記録しました。`;
    });
  }

  function addTask() {
    const name = title.trim();
    if (!name) return;
    return write('quickAdd', async () => {
      const task = await taskRepository.create({
        title: name,
        status: 'pending',
        priority: 'medium',
        goalId: null,
        deadline: null,
        estimatedMinutes: null,
      });
      setTitle('');
      setSnapshot((previous) =>
        previous
          ? { ...previous, tasks: [task, ...previous.tasks.filter((item) => item.id !== task.id)] }
          : previous,
      );
      return 'タスクを追加しました。';
    });
  }

  function hasTarget(item: RecommendationResult) {
    return item.kind === 'step'
      ? current?.steps.some((step) => step.id === item.targetId)
      : current?.tasks.some((task) => task.id === item.targetId);
  }

  function removeResults(items: RecommendationResult[]) {
    const keys = new Set(items.map((item) => targetKey(item.kind, item.targetId)));
    setSnapshot((previous) =>
      previous?.date === date
        ? {
            ...previous,
            results: previous.results.filter(
              (item) => item.date !== date || !keys.has(targetKey(item.kind, item.targetId)),
            ),
          }
        : previous,
    );
  }

  function undo(item: RecommendationResult) {
    return write('recommendation', async () => {
      await repository.undo(date, item.kind, item.targetId, item.outcome);
      removeResults([item]);
      return item.outcome === 'skipped'
        ? '今日のおすすめ対象に戻しました。'
        : repeats(item.kind, item.targetId)
          ? '今日の実施を取り消しました。'
          : '未完了に戻しました。';
    });
  }

  function undoBatch(items: RecommendationResult[], message: string) {
    const batch = repository.undoBatch?.bind(repository);
    if (!batch || !items.length) return;
    return write('recommendation', async () => {
      await batch(
        date,
        items.map((item) => ({
          kind: item.kind,
          id: item.targetId,
          expected: item.outcome,
        })),
      );
      removeResults(items);
      if (items[0].outcome === 'skipped') setLaterDate(undefined);
      else setRecordSelection(null);
      return message;
    });
  }

  const deferred = todayResults.filter((item) => item.outcome === 'skipped' && hasTarget(item));
  const completed = todayResults.filter((item) => item.outcome === 'completed');
  const selectedRecords = completed.filter(
    (item) =>
      hasTarget(item) &&
      recordSelection?.includes(`${date}:${targetKey(item.kind, item.targetId)}`),
  );
  const showingLater = laterDate === date;
  const text = { ...typography.secondary, color: colors.textSecondary };
  const latest = todayResults.find(
    (item) => `${date}:${targetKey(item.kind, item.targetId)}` === lastChange,
  );
  const message = feedback ? (
    <Notice
      message={feedback.message}
      tone={feedback.error ? 'error' : 'success'}
      action={
        latest && !showHistory ? (
          <ActionButton
            label="元に戻す"
            variant="ghost"
            disabled={busy}
            onPress={() => void undo(latest)}
          />
        ) : undefined
      }
    />
  ) : null;
  const items = choices?.candidates ?? [];
  const limit =
    shownCount === 4 && activePolicies.some((item) => item.policyKind === 'lighter_day')
      ? Math.max(2, choices?.urgentCount ?? 0)
      : shownCount;
  const visible = items.slice(0, limit);
  const urgent = visible.filter((item) => item.urgent);
  const regular = visible.filter((item) => !item.urgent);
  const scheduleLabel =
    calendarWindow?.availability === 'partial' ? '確認できた予定では' : '予定表では';
  const actionDisabled = busy || !!loadError;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs };
  const titleStyle = { ...typography.bodyStrong, color: colors.textPrimary };
  function renderChoice(item: Candidate) {
    const context =
      item.kind === 'step' ? item.taskTitle : item.goalId ? current?.goals.get(item.goalId) : null;
    return (
      <View key={targetKey(item.kind, item.id)} style={row}>
        <CompletionCheckbox
          label={
            repeats(item.kind, item.id) ? `${item.title}の今日の実施を記録` : `${item.title}を完了`
          }
          checked={false}
          disabled={actionDisabled}
          onPress={() => void record(item, 'completed')}
        />
        <View style={{ flex: 1, paddingVertical: spacing.sm }}>
          <Text style={titleStyle}>{item.title}</Text>
          <Text style={text}>
            {[
              ...item.reason
                .split(' ・ ')
                .filter((reason) => !/^(所要時間|次の予定まで)/.test(reason)),
              item.minutes === null ? '所要時間未設定' : `目安 ${item.minutes}分`,
              item.minutes !== null &&
              conditions.minutes !== null &&
              item.minutes > conditions.minutes
                ? `${conditions.minutes}分を超える見込み`
                : item.minutes !== null &&
                    calendarWindow?.minutes != null &&
                    item.minutes > calendarWindow.minutes
                  ? '予定の間には収まらない見込み'
                  : null,
              repeats(item.kind, item.id) ? '今日の実施を記録' : null,
              context,
            ]
              .filter(Boolean)
              .join(' ・ ')}
          </Text>
        </View>
        <ActionButton
          label="あとで"
          accessibilityLabel={`${item.title}を今日だけあとでにする`}
          variant="ghost"
          disabled={actionDisabled}
          onPress={() => void record(item, 'skipped')}
        />
      </View>
    );
  }

  function renderCompleted(item: RecommendationResult) {
    const key = `${date}:${targetKey(item.kind, item.targetId)}`;
    const repeating = repeats(item.kind, item.targetId);
    return (
      <View key={key} style={row}>
        <CompletionCheckbox
          label={
            recordSelection
              ? `${item.title}の記録を選択`
              : repeating
                ? `${item.title}の今日の実施を取り消す`
                : `${item.title}を未完了に戻す`
          }
          checked={recordSelection ? recordSelection.includes(key) : true}
          disabled={actionDisabled || !hasTarget(item)}
          onPress={() => {
            if (recordSelection)
              setRecordSelection((prior) =>
                prior?.includes(key)
                  ? prior.filter((entry) => entry !== key)
                  : [...(prior ?? []), key],
              );
            else void undo(item);
          }}
        />
        <View style={{ flex: 1, paddingVertical: spacing.xs }}>
          <Text style={titleStyle}>{item.title}</Text>
          <Text style={text}>
            {item.kind === 'step' ? '小さな行動' : repeating ? '今日の実施' : 'タスクの完了'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <AppScreen testID="recommendation-today" contentContainerStyle={{ gap: spacing.md }}>
      <ScreenHeader
        title="今日"
        subtitle={formatLocalDateJa(getUtcDayBounds(date, timezone).startAt, timezone)}
        action={<ActionButton label="設定" variant="ghost" onPress={openSettings} />}
      />
      <Card style={{ gap: spacing.sm }}>
        <SectionHeader compact title="今から何する？" />
        <OptionGroup
          label="使える時間"
          disabled={busy}
          options={durationOptions}
          selectedValue={String(conditions.minutes)}
          onChange={(value) =>
            changeConditions({
              ...conditions,
              minutes: durations.find((n) => String(n) === value) ?? null,
            })
          }
        />
        {openChat ? (
          <Text style={text}>
            {calendarWindow === undefined
              ? calendarLoading
                ? '予定を確認しています。'
                : 'タスク情報でおすすめを表示しています。'
              : calendarWindow.minutes === null
                ? `${scheduleLabel}、この後に時間を占める予定は見つかりません。`
                : calendarWindow.occupiedNow
                  ? `${scheduleLabel}、現在は予定の時間帯です。`
                  : calendarWindow.minutes === 0
                    ? `${scheduleLabel}、次の予定まで1分未満です。`
                    : `${scheduleLabel}、次の予定まで${calendarWindow.minutes}分。`}
          </Text>
        ) : null}
        {!showHistory && feedback?.scope === 'recommendation' ? message : null}
        {loadError ? (
          <Notice
            message={loadError}
            tone="error"
            action={
              <ActionButton
                label="再試行"
                variant="secondary"
                onPress={() => setRetry((count) => count + 1)}
              />
            }
          />
        ) : null}
        {urgent.length ? (
          <View style={{ gap: spacing.xs }}>
            <SectionHeader title="期限が近いタスク" compact />
            {urgent.map(renderChoice)}
          </View>
        ) : null}
        {regular.map(renderChoice)}
        {items.length > limit ? (
          <ActionButton
            label="もっと見る"
            variant="secondary"
            onPress={() => setShownCount((count) => count + 8)}
          />
        ) : null}
        {!items.length && !loadError ? (
          <Text accessibilityLiveRegion="polite" style={text}>
            {!current
              ? 'タスクを読み込んでいます。'
              : deferred.length
                ? 'いま表示するおすすめはありません。'
                : current.tasks.length
                  ? '今の条件で表示できる候補がありません。'
                  : 'まだタスクがありません。'}
          </Text>
        ) : null}
        {!items.length && fallback && conditions.minutes !== null ? (
          <ActionButton
            label={`「${fallback.taskTitle}」を小さな行動に分ける`}
            variant="secondary"
            disabled={actionDisabled}
            onPress={() => {
              if (conditions.minutes !== null) openStep(fallback.taskId, conditions.minutes);
            }}
          />
        ) : null}
        {deferred.length ? (
          <>
            <ActionButton
              label={
                showingLater
                  ? 'あとでにしたタスクを閉じる'
                  : `あとでにしたタスクを表示（${deferred.length}件）`
              }
              variant="ghost"
              expanded={showingLater}
              onPress={() => setLaterDate(showingLater ? undefined : date)}
            />
            {showingLater ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={text}>今日だけおすすめから外れます。</Text>
                {deferred.map((item) => (
                  <View key={targetKey(item.kind, item.targetId)} style={row}>
                    <Text style={[titleStyle, { flex: 1 }]}>{item.title}</Text>
                    <ActionButton
                      label="戻す"
                      accessibilityLabel={`${item.title}をおすすめ対象に戻す`}
                      variant="ghost"
                      disabled={actionDisabled}
                      onPress={() => void undo(item)}
                    />
                  </View>
                ))}
                {repository.undoBatch ? (
                  <ActionButton
                    label="すべて戻す"
                    variant="secondary"
                    disabled={actionDisabled}
                    onPress={() =>
                      void undoBatch(
                        deferred,
                        `${deferred.length}件を今日のおすすめ対象に戻しました。`,
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>
      <ActionButton
        label="これまでの記録"
        variant="ghost"
        onPress={() => {
          setRecordSelection(null);
          setShowHistory(true);
        }}
      />
      {choices?.overdue.length ? (
        <ActionButton
          label={`期限を見直す（${choices.overdue.length}件）`}
          variant="secondary"
          onPress={() => openTasks('overdue')}
        />
      ) : null}
      {agenda}
      {publishedPolicies.length ? (
        <ActionButton
          variant="ghost"
          label={
            activePolicies.length === 1
              ? `適用中：${activePolicies[0].targetTitle ?? policyLabels[activePolicies[0].policyKind]}`
              : activePolicies.length
                ? `推薦方針 ${activePolicies.length}件を適用中`
                : '推薦方針'
          }
          onPress={() => setPolicySheet(true)}
        />
      ) : null}
      {policyError && !policySheet ? <Notice tone="warning" message={policyError} /> : null}
      <FormField label="タスクをクイック追加">
        <FormInput
          accessibilityLabel="クイック追加するタスク名"
          maxLength={200}
          value={title}
          onChangeText={setTitle}
          placeholder="例：英単語を復習する"
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => void addTask()}
        />
      </FormField>
      <ActionButton
        label="タスクを追加"
        variant="secondary"
        disabled={busy || !title.trim()}
        onPress={() => void addTask()}
      />
      {feedback?.scope === 'quickAdd' ? message : null}
      {openChat ? <ActionButton label="AIに相談" variant="ghost" onPress={openChat} /> : null}
      {policySheet ? (
        <ModalFrame
          title="推薦方針"
          onClose={() => setPolicySheet(false)}
          closeDisabled={policyBusy}
        >
          {policyError ? <Notice tone="error" message={policyError} /> : null}
          {publishedPolicies.map((item) => (
            <Card key={item.id}>
              <Text style={titleStyle}>
                {policyLabels[item.policyKind]} {item.targetTitle}
              </Text>
              <Text style={text}>
                {item.startDate} ～ {item.endDate} ・{' '}
                {item.status === 'revoked'
                  ? '解除済み'
                  : activePolicies.includes(item)
                    ? '適用中'
                    : '同じ条件の新しい方針を適用中'}
              </Text>
              <ActionButton
                label={item.status === 'active' ? '解除' : '再適用'}
                variant="ghost"
                disabled={policyBusy}
                onPress={() => void setPolicy(item, item.status === 'revoked')}
              />
            </Card>
          ))}
        </ModalFrame>
      ) : null}
      {showHistory ? (
        <ModalFrame
          title="これまでの記録"
          closeLabel="これまでの記録を閉じる"
          onClose={() => setShowHistory(false)}
          closeDisabled={busy}
          footer={
            recordSelection ? (
              <ActionButton
                label={`選んだ${selectedRecords.length}件を取り消す`}
                loading={busy}
                disabled={actionDisabled || !selectedRecords.length}
                onPress={() =>
                  void undoBatch(
                    selectedRecords,
                    `今日の記録を${selectedRecords.length}件取り消しました。`,
                  )
                }
              />
            ) : undefined
          }
        >
          {feedback?.scope === 'recommendation' ? message : null}
          {completed.length ? (
            <Card>
              <SectionHeader compact title="今日の完了と実施" />
              {repository.undoBatch && completed.some(hasTarget) ? (
                <ActionButton
                  label={recordSelection ? '選択をやめる' : '複数選択'}
                  variant="ghost"
                  disabled={actionDisabled}
                  onPress={() => setRecordSelection(recordSelection ? null : [])}
                />
              ) : null}
              {completed.map(renderCompleted)}
            </Card>
          ) : null}
          {recentResults.length ? (
            <>
              <SectionHeader compact title="過去の記録" />
              {recentResults.map((item) => (
                <Text key={`${item.date}:${targetKey(item.kind, item.targetId)}`} style={text}>
                  {item.date} ・ {item.outcome === 'completed' ? '完了・実施' : 'あとで'} ・{' '}
                  {item.title}
                </Text>
              ))}
            </>
          ) : !completed.length ? (
            <Text style={text}>直近7日間の完了・実施の記録はありません。</Text>
          ) : null}
        </ModalFrame>
      ) : null}
    </AppScreen>
  );
}
