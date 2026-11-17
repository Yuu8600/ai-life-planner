import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';
import { getTaskErrorMessage } from '@/features/tasks/errors';
import { addLocalDays, formatLocalDateJa, getUtcDayBounds } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
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
  EFFORT_OPTIONS,
  isEffort,
  type ActionStep,
  type Conditions,
  type Outcome,
  type RecommendationRepository,
  type RecommendationResult,
} from './repository';

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
  const [excluded, setExcluded] = useState<{ date: string; keys: Set<string> }>();
  const [modal, setModal] = useState<'now' | 'history'>();
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
        excluded: excluded?.date === date ? excluded.keys : undefined,
      }),
    [current, date, timezone, conditions, excluded],
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
    setExcluded(undefined);
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
        previous ? { ...previous, tasks: [task, ...previous.tasks] } : previous,
      );
      return 'タスクを追加しました。';
    });
  }

  function another(candidate: Candidate) {
    setFeedback(undefined);
    setExcluded((previous) => {
      const keys = new Set(previous?.date === date ? previous.keys : undefined);
      keys.add(targetKey(candidate.kind, candidate.id));
      return { date, keys };
    });
  }

  const text = { ...typography.body, color: colors.textSecondary };
  const message = feedback ? (
    <Notice message={feedback.message} tone={feedback.error ? 'error' : 'success'} />
  ) : null;
  const hasAlternates = excluded?.date === date && excluded.keys.size > 0;
  function renderChoices(items: Candidate[], alternate: boolean) {
    if (!current || !choices) {
      return (
        <Text accessibilityLiveRegion="polite" style={text}>
          {loadError ? 'タスクを読み込めませんでした。' : 'タスクを読み込んでいます。'}
        </Text>
      );
    }
    if (!items.length) {
      return (
        <Card style={{ gap: spacing.sm }}>
          <Text style={text}>
            {!current.tasks.length
              ? 'まだタスクがありません。'
              : current.tasks.every((task) => task.status === 'completed')
                ? '登録したタスクはすべて完了しました。'
                : '今の条件で表示できる候補がありません。'}
          </Text>
          {fallback ? (
            <>
              <Text style={text}>「{fallback.taskTitle}」の一部から取り組めます。</Text>
              <ActionButton
                label={`${conditions.minutes}分でできる行動を決める`}
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setModal(undefined);
                  openStep(fallback.taskId, conditions.minutes);
                }}
              />
            </>
          ) : null}
          {alternate && !current.tasks.length ? (
            <ActionButton
              label="タスクを追加する"
              variant="secondary"
              onPress={() => {
                setModal(undefined);
                openTasks();
              }}
            />
          ) : null}
          {hasAlternates ? (
            <ActionButton
              label="最初の候補に戻る"
              variant="ghost"
              onPress={() => setExcluded(undefined)}
            />
          ) : null}
          {!alternate && current.tasks.length > 0 ? (
            <ActionButton
              label="時間・余裕を変更"
              variant="ghost"
              onPress={() => setModal('now')}
            />
          ) : null}
        </Card>
      );
    }
    return items.map((item) => {
      const goal = item.goalId ? current.goals.get(item.goalId) : null;
      return (
        <Card key={targetKey(item.kind, item.id)} style={{ gap: spacing.xs }}>
          {goal ? (
            <Text style={{ ...typography.secondary, color: colors.primary }}>{goal}</Text>
          ) : null}
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitle, color: colors.textPrimary }}
          >
            {item.title}
          </Text>
          {item.kind === 'step' ? <Text style={text}>{item.taskTitle}の小さな行動</Text> : null}
          <Text style={text}>{item.reason}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <ActionButton
              label="完了"
              accessibilityLabel={`${item.title}を完了`}
              variant="secondary"
              disabled={busy || !!loadError}
              onPress={() => void record(item, 'completed')}
            />
            <ActionButton
              label="今日は見送る"
              accessibilityLabel={`${item.title}を今日は見送る`}
              variant="ghost"
              disabled={busy || !!loadError}
              onPress={() => void record(item, 'skipped')}
            />
            {alternate ? (
              <ActionButton
                label="別の候補"
                variant="ghost"
                disabled={busy}
                onPress={() => another(item)}
              />
            ) : null}
          </View>
        </Card>
      );
    });
  }

  return (
    <AppScreen testID="recommendation-today" contentContainerStyle={{ gap: spacing.md }}>
      <ScreenHeader
        title="今日"
        subtitle={formatLocalDateJa(getUtcDayBounds(date, timezone).startAt, timezone)}
        action={<ActionButton label="設定" variant="ghost" onPress={openSettings} />}
      />
      <Card style={{ gap: spacing.sm }}>
        <ActionButton
          label="今から何する？"
          onPress={() => {
            setFeedback(undefined);
            setModal('now');
          }}
        />
        <Text style={text}>
          {conditions.minutes}分 ・{' '}
          {EFFORT_OPTIONS.find((option) => option.value === conditions.effort)?.label}
        </Text>
      </Card>
      <SectionHeader title="今日のおすすめ" />
      {!modal && feedback?.scope === 'recommendation' ? message : null}
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
      {renderChoices(choices?.candidates ?? [], false)}
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
      <SectionHeader
        title={`今日の完了 ${todayResults.filter((item) => item.outcome === 'completed').length}件`}
      />
      <ActionButton
        label="実行履歴を見る"
        variant="secondary"
        onPress={() => setModal('history')}
      />
      {modal === 'now' ? (
        <ModalFrame title="今から何する？" onClose={() => setModal(undefined)} closeDisabled={busy}>
          <OptionGroup
            label="使える時間"
            disabled={busy}
            options={durationOptions}
            selectedValue={String(conditions.minutes)}
            onChange={(value) =>
              changeConditions({
                ...conditions,
                minutes:
                  durations.find((minutes) => String(minutes) === value) ??
                  DEFAULT_CONDITIONS.minutes,
              })
            }
          />
          <OptionGroup
            label="今の余裕"
            disabled={busy}
            options={EFFORT_OPTIONS}
            selectedValue={conditions.effort}
            onChange={(value) => {
              if (isEffort(value)) changeConditions({ ...conditions, effort: value });
            }}
          />
          {feedback?.scope === 'recommendation' ? message : null}
          {renderChoices(choices?.candidates.slice(0, 1) ?? [], true)}
        </ModalFrame>
      ) : null}
      {modal === 'history' ? (
        <ModalFrame title="実行履歴" onClose={() => setModal(undefined)}>
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
