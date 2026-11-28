import { useFocusTimer } from '@/features/focus-timer';
import { SwipeActions } from '@/shared/components/SwipeActions';
import { useSuccessFeedback } from '@/shared/feedback/SuccessFeedback';
import { effectivePolicies, policyLabels, type RecommendationPolicy } from './policy';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AgendaAvailability } from '@/features/calendar';
import {
  TaskFormModal,
  getGoalOptionsErrorMessage,
  getTaskErrorMessage,
  TaskNotFoundError,
  type CreateTaskInput,
  type Task,
  type TaskGoalOption,
  type TaskRepository,
} from '@/features/tasks';
import { formatCalendarDateJa } from '@/shared/dateInput';
import { addLocalDays, formatLocalDateJa, getUtcDayBounds } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Badge } from '@/shared/components/Badge';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { ToastBanner } from '@/shared/components/ToastBanner';
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
  calendarPermissionMissing?: boolean;
  calendarWindow?: {
    minutes: number | null;
    until: number | null;
    availability?: AgendaAvailability;
    occupiedNow?: boolean;
  };
  openCalendar?: () => void;
  openChat?: () => void;
  askTaskAI?: (task: Task) => void;
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
  calendarPermissionMissing = false,
  calendarWindow,
  openCalendar,
  openChat,
  askTaskAI,
  openSettings,
  openTasks,
  openStep,
}: Props) {
  const notifySuccess = useSuccessFeedback();
  const timer = useFocusTimer();
  const { colors, controls, radius, spacing, typography } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [editingTask, setEditingTask] = useState<Task>();
  const [editorGoals, setEditorGoals] = useState<TaskGoalOption[]>([]);
  const [editorGoalError, setEditorGoalError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const editorRequest = useRef(0);
  const candidateAction = useRef<(() => void) | undefined>(undefined);
  const [candidateClosing, setCandidateClosing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [conditions, setConditions] = useState<Conditions>({
    ...initialConditions,
    effort: 'normal',
  });
  const [extraCount, setExtraCount] = useState(0);
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [quickAddBusy, setQuickAddBusy] = useState(false);
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
    setExtraCount(0);
    saveConditions(value);
  }

  async function write(
    scope: 'recommendation' | 'quickAdd',
    operation: () => Promise<string>,
    itemKey?: string,
  ) {
    if (writeLock.current) return;
    writeLock.current = true;
    if (scope === 'quickAdd') setQuickAddBusy(true);
    else {
      setBusy(true);
      setPendingKey(itemKey ?? null);
    }
    setLastChange(undefined);
    try {
      const message = await operation();
      notifySuccess();
      loadVersion.current++;
      setRetry((count) => count + 1);
      setFeedback({ message, scope });
    } catch (error) {
      setFeedback({ message: getTaskErrorMessage(error), scope, error: true });
      setRetry((count) => count + 1);
    } finally {
      writeLock.current = false;
      setBusy(false);
      setPendingKey(null);
      setQuickAddBusy(false);
    }
  }

  function repeats(kind: Candidate['kind'], id: string) {
    return kind === 'task'
      ? (current?.tasks.find((task) => task.id === id)?.recurrence?.kind ?? 'once') !== 'once'
      : (current?.steps.some((step) => step.id === id && step.repeatable) ?? false);
  }

  function record(candidate: Candidate, requested: Outcome) {
    const key = targetKey(candidate.kind, candidate.id);
    return write(
      'recommendation',
      async () => {
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
        setLastChange(`${date}:${key}`);
        if (outcome === 'skipped') return `「${candidate.title}」を今日だけあとでにしました。`;
        const action = repeats(candidate.kind, candidate.id) ? '今日の実施' : '完了';
        return `「${candidate.title}」の${action}を記録しました。`;
      },
      key,
    );
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
      setQuickAddOpen(false);
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
    return write(
      'recommendation',
      async () => {
        await repository.undo(date, item.kind, item.targetId, item.outcome);
        removeResults([item]);
        return item.outcome === 'skipped'
          ? '今日のおすすめ対象に戻しました。'
          : repeats(item.kind, item.targetId)
            ? '今日の実施を取り消しました。'
            : '未完了に戻しました。';
      },
      targetKey(item.kind, item.targetId),
    );
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

  const dismissFeedback = useCallback(() => {
    setFeedback(undefined);
  }, []);

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
  const modalMessage = feedback ? (
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
  const initialLimit = activePolicies.some((item) => item.policyKind === 'lighter_day')
    ? Math.max(2, choices?.urgentCount ?? 0)
    : 4;
  const limit = initialLimit + extraCount;
  const canShowMore = items.length > limit;
  const expanded = extraCount > 0 && items.length > initialLimit;
  const listControl = {
    minHeight: controls.minimumTarget,
    minWidth: controls.minimumTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: radius.pill,
  };
  const listControlText = {
    ...typography.label,
    color: colors.primary,
  };
  const visible = items.slice(0, limit);
  const urgent = visible.filter((item) => item.urgent);
  const regular = visible.filter((item) => !item.urgent);
  const scheduleLabel =
    calendarWindow?.availability === 'partial' ? '確認できた予定では' : '予定表では';
  useEffect(
    () => () => {
      editorRequest.current += 1;
    },
    [],
  );

  function finishCandidateClose() {
    const action = candidateAction.current;
    candidateAction.current = undefined;
    setSelectedCandidate(undefined);
    setCandidateClosing(false);
    action?.();
  }
  function closeCandidate(action?: () => void) {
    editorRequest.current += 1;
    setEditorLoading(false);
    candidateAction.current = action;
    // UIKit must finish dismissing the sheet before another Modal/route opens.
    if (Platform.OS === 'ios') setCandidateClosing(true);
    else finishCandidateClose();
  }
  async function openTaskEditor(taskId: string) {
    if (editorLoading) return;
    const request = ++editorRequest.current;
    setEditorLoading(true);
    setEditorError('');
    try {
      const [task, goals] = await Promise.all([
        taskRepository.findById(taskId),
        taskRepository.listGoalOptions().then(
          (values) => ({ values, error: null }),
          (error: unknown) => ({
            values: [] as TaskGoalOption[],
            error: getGoalOptionsErrorMessage(error),
          }),
        ),
      ]);
      if (request !== editorRequest.current) return;
      if (!task || task.id !== taskId) throw new TaskNotFoundError();
      setEditorGoals(goals.values);
      setEditorGoalError(goals.error);
      closeCandidate(() => setEditingTask(task));
    } catch (error) {
      if (request === editorRequest.current) {
        setEditorError(getTaskErrorMessage(error));
        setEditorLoading(false);
      }
    }
  }
  function closeTaskEditor() {
    editorRequest.current += 1;
    setEditorLoading(false);
    setEditorError('');
    setEditingTask(undefined);
  }
  async function retryEditorGoals() {
    const request = ++editorRequest.current;
    setEditorLoading(true);
    try {
      const values = await taskRepository.listGoalOptions();
      if (request === editorRequest.current) {
        setEditorGoals(values);
        setEditorGoalError(null);
      }
    } catch (error) {
      if (request === editorRequest.current) setEditorGoalError(getGoalOptionsErrorMessage(error));
    } finally {
      if (request === editorRequest.current) setEditorLoading(false);
    }
  }
  async function saveEditedTask(input: CreateTaskInput) {
    if (!editingTask || writeLock.current) return false;
    writeLock.current = true;
    setBusy(true);
    setEditorError('');
    try {
      const saved = await taskRepository.update(editingTask.id, input);
      // Invalidate older in-flight loads before publishing the saved Task.
      loadVersion.current += 1;
      setSnapshot(
        (previous) =>
          previous && {
            ...previous,
            tasks: previous.tasks.map((task) => (task.id === saved.id ? saved : task)),
          },
      );
      setEditingTask(undefined);
      setRetry((value) => value + 1);
      return true;
    } catch (error) {
      setEditorError(getTaskErrorMessage(error));
      return false;
    } finally {
      writeLock.current = false;
      setBusy(false);
    }
  }

  const actionDisabled = busy || !!loadError || !!editingTask || editorLoading || candidateClosing;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs };
  const titleStyle = { ...typography.bodyStrong, color: colors.textPrimary };

  function renderChoice(item: Candidate, index: number) {
    const key = targetKey(item.kind, item.id);
    const itemBusy = pendingKey === key;
    const context =
      item.kind === 'step' ? item.taskTitle : item.goalId ? current?.goals.get(item.goalId) : null;
    const reasons = item.reason
      .split(' ・ ')
      .filter((reason) => !/^(所要時間|次の予定まで)/.test(reason));
    const hasRecurrenceReason = reasons.some(
      (reason) => reason.startsWith('毎日のタスク') || reason.startsWith('毎週'),
    );
    const overWindow =
      item.minutes !== null &&
      calendarWindow?.minutes != null &&
      item.minutes > calendarWindow.minutes;
    const overSelectedMinutes =
      conditions.minutes !== null && item.minutes !== null && item.minutes > conditions.minutes;
    const tags = [
      ...reasons.map((label) => ({ label, tone: 'accent' as const })),
      {
        label: item.minutes === null ? '所要時間未設定' : `目安 ${item.minutes}分`,
        tone: 'neutral' as const,
      },
      ...(overSelectedMinutes
        ? [{ label: '設定時間超過（期限優先）', tone: 'warning' as const }]
        : []),
      ...(overWindow ? [{ label: '予定の間には収まらない見込み', tone: 'warning' as const }] : []),
      ...(repeats(item.kind, item.id) && !hasRecurrenceReason
        ? [{ label: '今日の実施', tone: 'accent' as const }]
        : []),
      ...(context ? [{ label: context, tone: 'neutral' as const }] : []),
    ];

    return (
      <SwipeActions
        key={key}
        label={item.title}
        disabled={actionDisabled}
        onLater={() => void record(item, 'skipped')}
      >
        <View
          style={[
            row,
            {
              paddingVertical: spacing.sm,
              opacity: itemBusy ? 0.5 : 1,
            },
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderSubtle,
            },
          ]}
        >
          <CompletionCheckbox
            label={
              repeats(item.kind, item.id)
                ? `${item.title}の今日の実施を記録`
                : `${item.title}を完了`
            }
            checked={false}
            disabled={actionDisabled}
            onPress={() => void record(item, 'completed')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}の詳細を開く`}
            disabled={actionDisabled}
            onPress={() => {
              setEditorError('');
              setSelectedCandidate(item);
            }}
            style={({ pressed }) => ({
              flex: 1,
              gap: 5,
              paddingVertical: 2,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text style={titleStyle}>{item.title}</Text>
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <Badge key={tag.label} label={tag.label} tone={tag.tone} />
              ))}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}を今日だけあとでにする`}
            disabled={actionDisabled}
            onPress={() => void record(item, 'skipped')}
            style={({ pressed }) => ({
              minHeight: 34,
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: radius.pill,
              backgroundColor: pressed ? colors.borderSubtle : colors.surfaceSubtle,
              opacity: itemBusy ? 0.45 : 1,
            })}
          >
            <Text style={{ ...typography.caption, fontWeight: '600', color: colors.textSecondary }}>
              あとで
            </Text>
          </Pressable>
        </View>
      </SwipeActions>
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

  const listRowStyle = (pressed: boolean, withTopBorder = false) => ({
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    backgroundColor: pressed ? colors.primarySoft : colors.surface,
    ...(withTopBorder
      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle }
      : {}),
  });

  const dateText = formatLocalDateJa(getUtcDayBounds(date, timezone).startAt, timezone);

  const toastOverlay =
    !showHistory && !quickAddOpen && feedback ? (
      <ToastBanner
        message={feedback.message}
        tone={feedback.error ? 'error' : 'default'}
        actionLabel={latest && feedback.scope === 'recommendation' ? '元に戻す' : undefined}
        actionDisabled={busy}
        onAction={latest ? () => void undo(latest) : undefined}
        onDismiss={dismissFeedback}
      />
    ) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <AppScreen
        testID="recommendation-today"
        scrollRef={scrollRef}
        overlay={toastOverlay}
        contentContainerStyle={{ paddingTop: spacing.sm, gap: spacing.md }}
        header={
          <ScreenHeader
            eyebrow={dateText}
            title="今日"
            compact
            action={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <ActionButton
                  label="＋"
                  accessibilityLabel="タスクをクイック追加する"
                  disabled={busy || editorLoading || candidateClosing}
                  onPress={() => {
                    setFeedback(undefined);
                    setQuickAddOpen(true);
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="設定"
                  onPress={openSettings}
                  style={({ pressed }) => ({
                    minHeight: 38,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? colors.primarySoft : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    justifyContent: 'center',
                    alignItems: 'center',
                  })}
                >
                  <Text style={{ ...typography.label, color: colors.textPrimary }}>設定</Text>
                </Pressable>
              </View>
            }
          />
        }
      >
        <ActionButton
          label={`今日の達成 ${completed.length}件 ›`}
          accessibilityLabel={`今日の達成 ${completed.length}件`}
          variant="ghost"
          onPress={() => {
            setRecordSelection(null);
            setShowHistory(true);
          }}
        />

        {choices?.overdue.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`期限を見直す（${choices.overdue.length}件）`}
            onPress={() => openTasks('overdue')}
            style={({ pressed }) => ({
              minHeight: 48,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: 'rgba(146, 64, 14, 0.2)',
              backgroundColor: colors.warningSoft,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.warning,
                }}
              />
              <Text style={{ ...typography.label, color: colors.warning, fontWeight: '700' }}>
                期限を見直す（{choices.overdue.length}件）
              </Text>
            </View>
            <Text style={{ ...typography.sectionTitle, color: colors.warning }}>›</Text>
          </Pressable>
        ) : null}

        <Card testID="today-recommendations" style={styles.focusCard}>
          <View style={styles.cardHeaderRow}>
            <SectionHeader compact title="今から何する？" />
            {items.length > 0 ? (
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {items.length > visible.length
                  ? `${visible.length} / ${items.length}件`
                  : `${items.length}件`}
              </Text>
            ) : null}
          </View>
          <OptionGroup
            label="使える時間"
            disabled={false}
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
            calendarPermissionMissing ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceSubtle,
                }}
              >
                <Text style={{ ...typography.caption, color: colors.textSecondary, flexShrink: 1 }}>
                  端末カレンダー未連携（アプリ内予定のみ参照）
                </Text>
                {openCalendar ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="予定タブでカレンダーを連携する"
                    onPress={openCalendar}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text
                      style={{ ...typography.caption, fontWeight: '700', color: colors.primary }}
                    >
                      連携する ›
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {calendarWindow === undefined
                  ? calendarLoading
                    ? '予定を確認しています。'
                    : 'タスク情報でおすすめを表示しています。'
                  : calendarWindow.minutes === null
                    ? calendarWindow.availability === 'partial'
                      ? 'アプリ内予定のみ確認中・このあとの予定はありません'
                      : 'このあとの予定はありません'
                    : calendarWindow.occupiedNow
                      ? `${scheduleLabel}、現在は予定の時間帯です。`
                      : calendarWindow.minutes === 0
                        ? `${scheduleLabel}、次の予定まで1分未満です。`
                        : `${scheduleLabel}、次の予定まで${calendarWindow.minutes}分。`}
              </Text>
            )
          ) : null}
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
          <View>{regular.map((item, index) => renderChoice(item, index))}</View>
          {canShowMore || expanded ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: spacing.xs,
              }}
            >
              {expanded ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: true }}
                  onPress={() => setExtraCount(0)}
                  style={({ pressed }) => [
                    listControl,
                    pressed && { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={listControlText}>折りたたむ</Text>
                </Pressable>
              ) : null}
              {canShowMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExtraCount((count) => count + 8)}
                  style={({ pressed }) => [
                    listControl,
                    pressed && { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={listControlText}>もっと見る</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {!items.length && !loadError ? (
            <View style={styles.emptyBlock}>
              <Text
                accessibilityLiveRegion="polite"
                style={{ ...typography.bodyStrong, color: colors.textPrimary }}
              >
                {!current
                  ? 'タスクを読み込んでいます。'
                  : deferred.length
                    ? 'いま表示するおすすめはありません。'
                    : current.tasks.length
                      ? '今の条件で表示できる候補がありません。'
                      : 'まだタスクがありません。'}
              </Text>
              {current && !current.tasks.length ? (
                <Text
                  style={{ ...typography.caption, color: colors.textSecondary, lineHeight: 20 }}
                >
                  1. 右上の＋から最初のタスクを登録{'\n'}
                  2. 予定タブでカレンダーを連携（任意・読み取り専用）{'\n'}
                  3. タスク画面から目標を登録して紐付け
                </Text>
              ) : null}
            </View>
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
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.borderSubtle,
                paddingTop: spacing.xs,
              }}
            >
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
                <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    今日だけおすすめから外れます。
                  </Text>
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
            </View>
          ) : null}
        </Card>

        {urgent.length ? (
          <Card testID="today-upcoming-deadlines" style={styles.focusCard}>
            <SectionHeader title="期限が近いタスク" compact />
            <View>{urgent.map((item, index) => renderChoice(item, index))}</View>
          </Card>
        ) : null}

        {agenda}

        {quickAddOpen ? (
          <ModalFrame
            title="タスクをクイック追加"
            onClose={() => {
              setTitle('');
              setQuickAddOpen(false);
            }}
            closeDisabled={quickAddBusy}
            dirty={!!title.trim()}
            footer={
              <ActionButton
                label="タスクを追加"
                loading={quickAddBusy}
                disabled={!title.trim()}
                onPress={() => void addTask()}
              />
            }
          >
            <FormField label="タスク名">
              <FormInput
                accessibilityLabel="クイック追加するタスク名"
                autoFocus
                maxLength={200}
                value={title}
                onChangeText={setTitle}
                placeholder="例：英単語を復習する"
                editable={!quickAddBusy}
                returnKeyType="done"
                onSubmitEditing={() => void addTask()}
              />
            </FormField>
            {feedback?.scope === 'quickAdd' && feedback.error ? (
              <Notice tone="error" message={feedback.message} />
            ) : null}
          </ModalFrame>
        ) : null}

        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="これまでの記録"
            onPress={() => {
              setRecordSelection(null);
              setShowHistory(true);
            }}
            style={({ pressed }) => listRowStyle(pressed)}
          >
            <View style={styles.linkLabelGroup}>
              <View style={[styles.iconBadge, { backgroundColor: colors.successSoft }]}>
                <Text style={{ color: colors.success, fontWeight: '800', fontSize: 13 }}>✓</Text>
              </View>
              <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
                これまでの記録
              </Text>
            </View>
            <View style={styles.linkRight}>
              {completed.length > 0 ? (
                <Badge label={`${completed.length}件`} tone="success" />
              ) : null}
              <Text style={{ ...typography.sectionTitle, color: colors.textSecondary }}>›</Text>
            </View>
          </Pressable>
          {publishedPolicies.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                activePolicies.length === 1
                  ? `適用中：${activePolicies[0].targetTitle ?? policyLabels[activePolicies[0].policyKind]}`
                  : activePolicies.length
                    ? `推薦方針 ${activePolicies.length}件を適用中`
                    : '推薦方針'
              }
              onPress={() => setPolicySheet(true)}
              style={({ pressed }) => listRowStyle(pressed, true)}
            >
              <View style={[styles.linkLabelGroup, { flex: 1 }]}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>◎</Text>
                </View>
                <Text style={{ ...typography.bodyStrong, color: colors.primary, flex: 1 }}>
                  {activePolicies.length === 1
                    ? `適用中：${activePolicies[0].targetTitle ?? policyLabels[activePolicies[0].policyKind]}`
                    : activePolicies.length
                      ? `推薦方針 ${activePolicies.length}件を適用中`
                      : '推薦方針'}
                </Text>
              </View>
              <Text style={{ ...typography.sectionTitle, color: colors.textSecondary }}>›</Text>
            </Pressable>
          ) : null}
          {openChat ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="AIに相談"
              onPress={openChat}
              style={({ pressed }) => listRowStyle(pressed, true)}
            >
              <View style={styles.linkLabelGroup}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>✦</Text>
                </View>
                <Text style={{ ...typography.bodyStrong, color: colors.primary }}>AIに相談</Text>
              </View>
              <Text style={{ ...typography.sectionTitle, color: colors.textSecondary }}>›</Text>
            </Pressable>
          ) : null}
        </Card>

        {policyError && !policySheet ? <Notice tone="warning" message={policyError} /> : null}

        {selectedCandidate ? (
          <ModalFrame
            title={selectedCandidate.title}
            testID="candidate-details"
            visible={!candidateClosing}
            onDismiss={finishCandidateClose}
            closeLabel="詳細を閉じる"
            closeDisabled={candidateClosing}
            onClose={() => closeCandidate()}
          >
            <Card variant="tinted" style={{ gap: spacing.xs }}>
              <Text style={text}>
                所要時間：
                {selectedCandidate.minutes === null
                  ? '未設定'
                  : `目安 ${selectedCandidate.minutes}分`}
              </Text>
              {selectedCandidate.deadline ? (
                <Text style={text}>期限：{formatCalendarDateJa(selectedCandidate.deadline)}</Text>
              ) : null}
              {selectedCandidate.kind === 'step' ? (
                <Text style={text}>親タスク：{selectedCandidate.taskTitle}</Text>
              ) : selectedCandidate.goalId && current?.goals.get(selectedCandidate.goalId) ? (
                <Text style={text}>目標：{current.goals.get(selectedCandidate.goalId)}</Text>
              ) : null}
            </Card>
            {editorError ? <Notice tone="error" message={editorError} /> : null}
            <View style={{ gap: spacing.sm }}>
              {timer ? (
                <ActionButton
                  label="作業タイマーを開く"
                  accessibilityLabel={`${selectedCandidate.title}の作業タイマーを開く`}
                  variant="secondary"
                  disabled={actionDisabled}
                  onPress={() => {
                    const target = selectedCandidate;
                    closeCandidate(() =>
                      timer.open({
                        kind: target.kind,
                        id: target.id,
                        title: target.title,
                        initialMinutes: target.minutes,
                      }),
                    );
                  }}
                />
              ) : null}
              <ActionButton
                label={selectedCandidate.kind === 'step' ? '親タスクを編集' : 'タスクを編集'}
                variant="secondary"
                disabled={actionDisabled}
                loading={editorLoading}
                onPress={() => void openTaskEditor(selectedCandidate.taskId)}
              />
              {askTaskAI ? (
                <ActionButton
                  label="このタスクをAIに相談"
                  variant="secondary"
                  disabled={
                    actionDisabled ||
                    !current?.tasks.some((task) => task.id === selectedCandidate.taskId)
                  }
                  onPress={() => {
                    const task = current?.tasks.find(
                      (task) => task.id === selectedCandidate.taskId,
                    );
                    if (!task) return;
                    closeCandidate(() => askTaskAI(task));
                  }}
                />
              ) : null}
              <ActionButton
                label={
                  repeats(selectedCandidate.kind, selectedCandidate.id)
                    ? '今日の実施を記録'
                    : '完了にする'
                }
                disabled={actionDisabled}
                onPress={() => {
                  const target = selectedCandidate;
                  closeCandidate(() => void record(target, 'completed'));
                }}
              />
              <ActionButton
                label="小さな行動を見る・分ける"
                variant="secondary"
                disabled={actionDisabled}
                onPress={() => {
                  const taskId = selectedCandidate.taskId;
                  closeCandidate(() => openStep(taskId, conditions.minutes ?? 30));
                }}
              />
              <ActionButton
                label="今日だけあとでにする"
                variant="ghost"
                disabled={actionDisabled}
                onPress={() => {
                  const target = selectedCandidate;
                  closeCandidate(() => void record(target, 'skipped'));
                }}
              />
            </View>
          </ModalFrame>
        ) : null}

        {editingTask ? (
          <TaskFormModal
            key={editingTask.id}
            task={editingTask}
            planningTimezone={timezone}
            recommendationMode
            goalOptions={editorGoals}
            goalOptionsError={editorGoalError}
            isLoadingGoalOptions={editorLoading}
            onRetryGoalOptions={() => void retryEditorGoals()}
            isSubmitting={busy}
            errorMessage={editorError || null}
            onClose={closeTaskEditor}
            onSubmit={saveEditedTask}
          />
        ) : null}

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
                  {formatCalendarDateJa(item.startDate)} ～ {formatCalendarDateJa(item.endDate)} ・{' '}
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
            {feedback?.scope === 'recommendation' ? modalMessage : null}
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
                    {formatCalendarDateJa(item.date)} ・{' '}
                    {item.outcome === 'completed' ? '完了・実施' : 'あとで'} ・ {item.title}
                  </Text>
                ))}
              </>
            ) : !completed.length ? (
              <Text style={text}>直近7日間の完了・実施の記録はありません。</Text>
            ) : null}
          </ModalFrame>
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  focusCard: {
    paddingVertical: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emptyBlock: {
    paddingVertical: 16,
    gap: 8,
  },
  linkLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
