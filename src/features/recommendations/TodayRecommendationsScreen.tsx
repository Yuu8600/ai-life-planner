import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

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
  DEFAULT_CONDITIONS,
  isEffort,
  type ActionStep,
  type Conditions,
  type Outcome,
  type RecommendationRepository,
  type RecommendationResult,
} from './repository';

const availability = [
  { value: 'light', label: '忙しい' },
  { value: 'normal', label: 'ふつう' },
  { value: 'focus', label: '余裕あり' },
];
const durations = [15, 30, 60] as const;
const durationOptions = durations.map((minutes) => ({
  value: String(minutes),
  label: `${minutes}分`,
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
  openSettings,
  openTasks,
  openStep,
}: Props) {
  const { colors, spacing, typography } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [conditions, setConditions] = useState(initialConditions);
  const [shownCount, setShownCount] = useState(4);
  const [showHistory, setShowHistory] = useState(false);
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
      }),
    [current, timezone, conditions],
  );

  const fallback = choices?.startWith;
  const recentResults =
    current?.results.filter((item) => item.date >= addLocalDays(date, -6)) ?? [];

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
      return outcome === 'completed' ? '完了を記録しました。' : '今日の見送りを記録しました。';
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

  function undo(item: RecommendationResult) {
    return write('recommendation', async () => {
      await repository.undo(date, item.kind, item.targetId, item.outcome);
      setSnapshot((previous) =>
        previous?.date === date
          ? {
              ...previous,
              results: previous.results.filter(
                (result) =>
                  result !== item &&
                  (result.date !== date ||
                    result.kind !== item.kind ||
                    result.targetId !== item.targetId),
              ),
            }
          : previous,
      );
      return '未完了に戻しました。';
    });
  }

  const text = { ...typography.secondary, color: colors.textSecondary };
  const message = feedback ? (
    <Notice message={feedback.message} tone={feedback.error ? 'error' : 'success'} />
  ) : null;
  const items = choices?.candidates ?? [];
  const actionDisabled = busy || !!loadError;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs };
  const titleStyle = { ...typography.bodyStrong, color: colors.textPrimary };
  function renderChoice(item: Candidate) {
    const context =
      item.kind === 'step' ? item.taskTitle : item.goalId ? current?.goals.get(item.goalId) : null;
    return (
      <View key={targetKey(item.kind, item.id)} style={row}>
        <CompletionCheckbox
          label={`${item.title}を完了`}
          checked={false}
          disabled={actionDisabled}
          onPress={() => void record(item, 'completed')}
        />
        <View style={{ flex: 1, paddingVertical: spacing.sm }}>
          <Text style={titleStyle}>{item.title}</Text>
          <Text style={text}>
            {[
              item.reason,
              context,
              item.minutes !== null && item.minutes > conditions.minutes
                ? `目安 ${item.minutes}分`
                : null,
            ]
              .filter(Boolean)
              .join(' ・ ')}
          </Text>
        </View>
        <ActionButton
          label="見送る"
          accessibilityLabel={`${item.title}を今日は見送る`}
          variant="ghost"
          disabled={actionDisabled}
          onPress={() => void record(item, 'skipped')}
        />
      </View>
    );
  }

  function renderResults(outcome: Outcome, heading: string) {
    const results = todayResults.filter((item) => item.outcome === outcome);
    if (!results.length) return null;
    return (
      <Card>
        <SectionHeader compact title={`${heading}（${results.length}）`} />
        {results.map((item) => {
          const exists =
            item.kind === 'step'
              ? current?.steps.some((step) => step.id === item.targetId)
              : current?.tasks.some((task) => task.id === item.targetId);
          return (
            <View key={targetKey(item.kind, item.targetId)} style={row}>
              {outcome === 'completed' ? (
                <CompletionCheckbox
                  label={`${item.title}を未完了に戻す`}
                  checked
                  disabled={actionDisabled || !exists}
                  onPress={() => void undo(item)}
                />
              ) : null}
              <Text style={[titleStyle, { flex: 1 }]}>{item.title}</Text>
              {outcome === 'skipped' && exists ? (
                <ActionButton
                  label="取り消す"
                  accessibilityLabel={`${item.title}の見送りを取り消す`}
                  variant="ghost"
                  disabled={actionDisabled}
                  onPress={() => void undo(item)}
                />
              ) : null}
            </View>
          );
        })}
      </Card>
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
          label="今日の余裕"
          disabled={busy}
          options={availability}
          selectedValue={conditions.effort}
          onChange={(value) => {
            if (!isEffort(value)) return;
            const minutes = { light: 15, normal: 30, focus: 60 } as const;
            changeConditions({ effort: value, minutes: minutes[value] });
          }}
        />
        <OptionGroup
          label="使える時間"
          disabled={busy}
          options={durationOptions}
          selectedValue={String(conditions.minutes)}
          onChange={(value) =>
            changeConditions({
              ...conditions,
              minutes: durations.find((n) => String(n) === value) ?? DEFAULT_CONDITIONS.minutes,
            })
          }
        />
      </Card>
      <SectionHeader title="今日のおすすめ" />
      {feedback?.scope === 'recommendation' ? message : null}
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
      {items.length ? (
        <Card>
          {items.slice(0, shownCount).map(renderChoice)}
          {items.length > shownCount ? (
            <ActionButton
              label="もっと見る"
              variant="secondary"
              onPress={() => setShownCount((count) => count + 8)}
            />
          ) : null}
        </Card>
      ) : !loadError ? (
        <Text accessibilityLiveRegion="polite" style={text}>
          {current
            ? current.tasks.length
              ? '今の条件で表示できる候補がありません。'
              : 'まだタスクがありません。'
            : 'タスクを読み込んでいます。'}
        </Text>
      ) : null}
      {!items.length && fallback ? (
        <ActionButton
          label={`「${fallback.taskTitle}」を${conditions.minutes}分の行動に分ける`}
          variant="secondary"
          disabled={actionDisabled}
          onPress={() => openStep(fallback.taskId, conditions.minutes)}
        />
      ) : null}
      {renderResults('completed', '完了済み')}
      {renderResults('skipped', '今日の見送り')}
      {choices?.overdue.length ? (
        <ActionButton
          label={`期限を見直す（${choices.overdue.length}件）`}
          variant="secondary"
          onPress={() => openTasks('overdue')}
        />
      ) : null}
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
      {agenda}
      <ActionButton label="実行履歴を見る" variant="ghost" onPress={() => setShowHistory(true)} />
      {showHistory ? (
        <ModalFrame title="実行履歴" onClose={() => setShowHistory(false)}>
          {recentResults.length ? (
            recentResults.map((item) => (
              <Text key={`${item.date}:${targetKey(item.kind, item.targetId)}`} style={text}>
                {item.date} ・ {item.outcome === 'completed' ? '完了' : '見送り'} ・ {item.title}
              </Text>
            ))
          ) : (
            <Text style={text}>直近7日間の記録はありません。</Text>
          )}
        </ModalFrame>
      ) : null}
    </AppScreen>
  );
}
