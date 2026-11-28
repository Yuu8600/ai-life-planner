import { SwipeActions } from '@/shared/components/SwipeActions';
import { useSuccessFeedback } from '@/shared/feedback/SuccessFeedback';
import { formatCalendarDateJa } from '@/shared/dateInput';
import { getLocalDate } from '@/features/today';
import type {
  RecommendationRepository,
  RecommendationResult,
} from '@/features/recommendations/repository';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { getTaskErrorMessage } from './errors';
import { Notice } from '@/shared/components/Notice';
import { ToastBanner } from '@/shared/components/ToastBanner';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { radius, spacing, useTheme } from '@/shared/theme';

import { FormInput } from '@/shared/components/FormField';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { selectTaskList, type TaskSort } from './selectTaskList';
import { GoalOptionsNotice } from './components/GoalOptionsNotice';
import { TaskFilters } from './components/TaskFilters';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskListItem } from './components/TaskListItem';
import { TaskStatePanel } from './components/TaskStatePanel';
import { TASK_FILTERS } from './filters';
import { matchesTaskFilter, toTaskSummary } from './presentation';
import type { CreateTaskInput, Task, TaskRepository } from './repositories/TaskRepository';
import type { TaskFilterId } from './types';
import { useTasks } from './useTasks';

type TasksScreenProps = {
  intro?: ReactNode;
  recommendationMode?: boolean;
  recommendations?: RecommendationRepository;
  dayError?: string;
  retryDay?: () => void;
  initialFilter?: TaskFilterId;
  filterEntry?: string;
  onOpenSteps?: (taskId: string) => void;
  onAskAI?: (task: Task) => void;
  onOpenGoals?: () => void;
  planningTimezone?: string;
  onReplanTask?: (taskId: string, date: string) => void;
  now?: Date;
  refreshToken?: number;
  repository: TaskRepository | null;
};

export function TasksScreen({
  intro,
  recommendationMode = false,
  recommendations,
  dayError,
  retryDay,
  initialFilter,
  filterEntry,
  onOpenSteps,
  onOpenGoals,
  onAskAI,
  now,
  planningTimezone,
  onReplanTask,
  refreshToken = 0,
  repository,
}: TasksScreenProps) {
  const theme = useTheme();
  const notifySuccess = useSuccessFeedback();
  const {
    clearMutationError,
    createTask,
    deleteTask,
    goalOptions,
    goalOptionsError,
    isLoading,
    isLoadingGoalOptions,
    loadError,
    mutationError,
    pendingMutation,
    refreshSilent,
    retry,
    retryGoalOptions,
    tasks,
    updateTask,
  } = useTasks(repository, refreshToken);
  const [mountedAt] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>(initialFilter ?? 'all');
  const [nativeFilter, setNativeFilter] = useState<'all' | 'incomplete' | 'overdue' | 'recurring'>(
    initialFilter === 'overdue' ? 'overdue' : 'all',
  );
  const filterSyncKey = `${initialFilter ?? ''}:${filterEntry ?? ''}`;
  const [lastFilterSync, setLastFilterSync] = useState(filterSyncKey);
  if (filterSyncKey !== lastFilterSync) {
    setLastFilterSync(filterSyncKey);
    setNativeFilter(initialFilter === 'overdue' ? 'overdue' : 'all');
  }
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TaskSort>('recent');
  const [goal, setGoal] = useState('all');
  const [refinements, setRefinements] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [batchMessage, setBatchMessage] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const today = planningTimezone ? getLocalDate(now ?? mountedAt, planningTimezone) : undefined;
  const [daily, setDaily] = useState<{ date: string; results: RecommendationResult[] }>();
  const [dailyError, setDailyError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [lastAction, setLastAction] = useState<{
    date: string;
    taskId: string;
    message: string;
    undo?: boolean;
  }>();
  const [actionBusy, setActionBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [dailyAttempt, setDailyAttempt] = useState(0);
  const actionLock = useRef(false);

  useEffect(() => {
    if (!recommendations || !today) return;
    let active = true;
    void recommendations.listResults(today, today).then(
      (results) => {
        if (!active) return;
        setDaily({ date: today, results });
        setDailyError('');
      },
      (error) => {
        if (active) setDailyError(getTaskErrorMessage(error));
      },
    );
    return () => {
      active = false;
    };
  }, [recommendations, today, dailyAttempt, refreshToken]);

  function deadlineOf(task: Task) {
    return (
      task.localDeadline ??
      (task.deadline && planningTimezone ? getLocalDate(task.deadline, planningTimezone) : null)
    );
  }

  const results = new Map(
    (daily?.date === today ? (daily?.results ?? []) : [])
      .filter((result) => result.kind === 'task')
      .map((result) => [result.targetId, result.outcome]),
  );
  const isComplete = (task: Task) =>
    task.status === 'completed' || results.get(task.id) === 'completed';
  const isOverdue = (task: Task) => {
    const deadline = deadlineOf(task);
    return (
      (task.recurrence?.kind ?? 'once') === 'once' && !!(deadline && today && deadline < today)
    );
  };
  const goalTitleById = new Map(goalOptions.map((goal) => [goal.id, goal.title]));
  const incompleteTasks = recommendationMode ? tasks.filter((task) => !isComplete(task)) : [];
  const completedTasks = recommendationMode ? tasks.filter(isComplete) : [];
  const overdueCount = recommendationMode
    ? incompleteTasks.filter((task) => isOverdue(task)).length
    : 0;
  const recurringCount = recommendationMode
    ? incompleteTasks.filter((task) => (task.recurrence?.kind ?? 'once') !== 'once').length
    : 0;
  const statusTasks = recommendationMode
    ? tasks.filter((task) => {
        if (nativeFilter === 'incomplete') return !isComplete(task);
        if (nativeFilter === 'overdue') return !isComplete(task) && isOverdue(task);
        if (nativeFilter === 'recurring')
          return !isComplete(task) && (task.recurrence?.kind ?? 'once') !== 'once';
        return true;
      })
    : tasks.filter((task) => matchesTaskFilter(task, activeFilter, now));
  const listOptions = {
    query,
    goal,
    sort,
    timezone: planningTimezone,
  };
  const visibleTasks = selectTaskList(statusTasks, listOptions);
  const activeVisibleTasks = recommendationMode ? selectTaskList(incompleteTasks, listOptions) : [];
  const completedVisibleTasks = recommendationMode
    ? selectTaskList(completedTasks, listOptions)
    : [];
  const finishedVisibleTasks = completedVisibleTasks.filter((task) => task.status === 'completed');
  const initialLoading = isLoading && (!recommendationMode || !tasks.length);
  const isMutating = pendingMutation !== null || actionBusy;
  const isSaving = pendingMutation === 'create' || pendingMutation?.startsWith('update:') === true;

  async function toggle(task: Task) {
    if (!recommendations || !today || daily?.date !== today || actionLock.current || isMutating)
      return;
    const outcome = results.get(task.id);
    actionLock.current = true;
    setActionBusy(true);
    setBusyTaskId(task.id);
    setActionMessage('');
    setLastAction(undefined);
    try {
      if (isComplete(task)) {
        await recommendations.undo(
          today,
          'task',
          task.id,
          outcome === 'completed' ? 'completed' : 'reopen',
        );
      } else if (outcome === 'skipped') {
        await recommendations.undo(today, 'task', task.id, 'skipped');
      } else {
        const recorded = await recommendations.record(today, 'task', task.id, 'completed');
        const status = (task.recurrence?.kind ?? 'once') === 'once' ? '完了' : '今日の実施';
        setLastAction({
          date: today,
          taskId: task.id,
          message:
            recorded === 'skipped'
              ? `「${task.title}」は今日だけあとでになっています。`
              : `「${task.title}」の${status}を記録しました。`,
          undo: true,
        });
      }
      if (outcome === 'skipped' || isComplete(task)) {
        setLastAction({
          date: today,
          taskId: task.id,
          message:
            outcome === 'skipped' ? '今日のおすすめ対象に戻しました。' : '未完了に戻しました。',
        });
      }
      notifySuccess();
      const fresh = await recommendations.listResults(today, today);
      setDaily({ date: today, results: fresh });
    } catch (error) {
      setActionMessage(getTaskErrorMessage(error));
      setDailyAttempt((value) => value + 1);
    } finally {
      refreshSilent();
      actionLock.current = false;
      setActionBusy(false);
      setBusyTaskId(null);
    }
  }

  async function runBatch(message: string, operation: () => Promise<void>) {
    if (actionLock.current || isMutating) return;
    actionLock.current = true;
    setActionBusy(true);
    setActionMessage('');
    setBatchMessage('');
    setLastAction(undefined);
    try {
      await operation();
      setBatchMessage(message);
    } catch (error) {
      setActionMessage(getTaskErrorMessage(error));
    } finally {
      refreshSilent();
      setDailyAttempt((value) => value + 1);
      actionLock.current = false;
      setActionBusy(false);
    }
  }

  function confirmDeleteCompleted() {
    if (!repository?.removeCompleted || !finishedVisibleTasks.length || isMutating) return;
    const ids = finishedVisibleTasks.map((task) => task.id);
    appAlert.alert(
      `${ids.length}件の完了済みタスクを削除しますか？`,
      '関連する小さな行動とタスク向けの推薦方針も削除されます。実施記録や時間割の記録は残ります。削除は元に戻せません。',
      [
        { style: 'cancel', text: 'キャンセル' },
        {
          style: 'destructive',
          text: `${ids.length}件を削除`,
          onPress: () =>
            void runBatch(`${ids.length}件の完了済みタスクを削除しました。`, () =>
              repository.removeCompleted!(ids),
            ),
        },
      ],
    );
  }

  const dismissActionToast = useCallback(() => {
    setLastAction(undefined);
    setBatchMessage('');
  }, []);

  const openCreateForm = () => {
    if (isMutating || !repository) return;
    clearMutationError();
    setEditingTask(null);
  };

  const openEditForm = (task: Task) => {
    if (isMutating) return;
    clearMutationError();
    setEditingTask(task);
  };

  const saveTask = async (input: CreateTaskInput): Promise<boolean> => {
    const { status, ...editable } = input;
    const saved = editingTask
      ? await updateTask(editingTask.id, recommendationMode ? editable : { ...editable, status })
      : await createTask(input);

    if (saved) setEditingTask(undefined);
    return saved;
  };

  const confirmDelete = (task: Task) => {
    if (isMutating) return;

    appAlert.alert(
      'タスクを削除しますか？',
      `「${task.title}」を削除します。この操作は取り消せません。`,
      [
        { style: 'cancel', text: 'キャンセル' },
        {
          onPress: () =>
            void deleteTask(task.id).then((deleted) => {
              if (deleted && editingTask?.id === task.id) setEditingTask(undefined);
            }),
          style: 'destructive',
          text: '削除',
        },
      ],
    );
  };

  function taskRow(task: Task, isLast = false) {
    const deadline = deadlineOf(task);
    const checked = isComplete(task);
    const overdue = !checked && isOverdue(task);
    const skipped = !checked && results.get(task.id) === 'skipped';
    const recurring = (task.recurrence?.kind ?? 'once') !== 'once';
    const dailyCheck = recurring && (!checked || results.get(task.id) === 'completed');
    const canRowDelete = task.status === 'completed';
    const goalTitle = task.goalId ? goalTitleById.get(task.goalId) : undefined;
    const rowBusy = busyTaskId === task.id || pendingMutation === `delete:${task.id}`;

    return (
      <SwipeActions
        key={task.id}
        label={task.title}
        disabled={isMutating}
        onDelete={() => confirmDelete(task)}
      >
        <View
          style={[
            styles.taskRow,
            rowBusy && { opacity: 0.55 },
            !isLast && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.borderSubtle,
            },
          ]}
          testID={`task-card-${task.id}`}
        >
          {skipped ? (
            <ActionButton
              label="戻す"
              accessibilityLabel={`${task.title}をおすすめ対象に戻す`}
              variant="ghost"
              disabled={isMutating || !!dailyError || !!dayError}
              onPress={() => void toggle(task)}
            />
          ) : (
            <CompletionCheckbox
              checked={checked}
              label={
                dailyCheck
                  ? `${task.title}の今日の実施を${checked ? '取り消す' : '記録'}`
                  : `${task.title}を${checked ? '未完了に戻す' : '完了'}`
              }
              disabled={!today || daily?.date !== today || isMutating || !!dailyError || !!dayError}
              onPress={() => void toggle(task)}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.title}を編集する`}
            disabled={isMutating}
            onPress={() => openEditForm(task)}
            style={({ pressed }) => [styles.rowTitle, pressed && { opacity: 0.65 }]}
          >
            <View style={styles.rowContent}>
              <Text
                style={[
                  {
                    ...theme.typography.bodyStrong,
                    color: theme.colors.textPrimary,
                    flexShrink: 1,
                  },
                  checked && {
                    color: theme.colors.textSecondary,
                    textDecorationLine: 'line-through',
                  },
                ]}
              >
                {task.title}
              </Text>
              <View style={styles.metaPills}>
                {overdue && deadline ? (
                  <Badge label={`期限切れ ${formatCalendarDateJa(deadline)}`} tone="error" />
                ) : null}
                {!overdue && deadline ? (
                  <Badge label={`期限 ${formatCalendarDateJa(deadline)}`} tone="neutral" />
                ) : null}
                {!checked && task.priority === 'high' ? (
                  <Badge label="優先度 高" tone="warning" />
                ) : null}
                {task.estimatedMinutes !== null ? (
                  <Badge label={`目安 ${task.estimatedMinutes}分`} tone="neutral" />
                ) : null}
                {checked ? (
                  <Badge label={dailyCheck ? '今日の実施済み' : '完了'} tone="success" />
                ) : recurring ? (
                  <Badge label="繰り返し" tone="accent" />
                ) : null}
                {skipped ? <Badge label="あとで" tone="neutral" /> : null}
                {goalTitle ? <Badge label={goalTitle} tone="info" /> : null}
              </View>
            </View>
            {!canRowDelete ? (
              <Text style={{ ...theme.typography.sectionTitle, color: theme.colors.textSecondary }}>
                ›
              </Text>
            ) : null}
          </Pressable>
          {canRowDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${task.title}を削除`}
              accessibilityState={{
                disabled: isMutating,
                busy: pendingMutation === `delete:${task.id}`,
              }}
              disabled={isMutating}
              onPress={() => confirmDelete(task)}
              style={({ pressed }) => [
                styles.rowDeleteButton,
                {
                  borderColor: isMutating ? theme.colors.borderSubtle : theme.colors.error,
                  backgroundColor: pressed ? theme.colors.surfaceSubtle : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  ...theme.typography.label,
                  color: isMutating ? theme.colors.disabledText : theme.colors.error,
                }}
              >
                削除
              </Text>
            </Pressable>
          ) : null}
        </View>
      </SwipeActions>
    );
  }

  const lastTask =
    lastAction?.date === today ? tasks.find((task) => task.id === lastAction?.taskId) : undefined;
  const lastOutcome = lastTask ? results.get(lastTask.id) : undefined;
  const actionUndo = lastOutcome && lastTask && lastAction?.undo ? lastTask : undefined;

  const toastOverlay =
    lastTask && lastAction && !actionMessage && !dailyError ? (
      <ToastBanner
        message={lastAction.message}
        actionLabel={actionUndo ? '元に戻す' : undefined}
        actionDisabled={isMutating || !!dayError}
        onAction={actionUndo ? () => void toggle(actionUndo) : undefined}
        onDismiss={dismissActionToast}
      />
    ) : batchMessage && !actionMessage && !dailyError ? (
      <ToastBanner message={batchMessage} onDismiss={dismissActionToast} />
    ) : null;

  return (
    <AppScreen
      testID="tasks-screen"
      overlay={toastOverlay}
      header={
        <ScreenHeader
          title="タスク"
          action={
            repository && !initialLoading && !loadError ? (
              <ActionButton
                accessibilityLabel="新しいタスクを作成する"
                disabled={isMutating}
                label={planningTimezone || recommendationMode ? 'タスクを追加' : '＋ 追加'}
                onPress={openCreateForm}
                style={styles.addButton}
                variant="primary"
              />
            ) : null
          }
        />
      }
    >
      {intro}
      <View style={{ gap: spacing.sm }}>
        <FormInput
          accessibilityLabel="タスクを検索"
          placeholder="タスク名で検索"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <ActionButton
          label={
            refinements
              ? '並び替え・目標を閉じる'
              : `並び替え・目標${goal !== 'all' || sort !== 'recent' ? '（指定中）' : ''}`
          }
          expanded={refinements}
          variant="ghost"
          onPress={() => setRefinements((value) => !value)}
        />
        {refinements ? (
          <>
            <OptionGroup
              label="並び替え"
              disabled={false}
              selectedValue={sort}
              onChange={(value) => setSort(value as TaskSort)}
              options={[
                { label: '更新順', value: 'recent' },
                { label: '期限順', value: 'deadline' },
                { label: '優先度順', value: 'priority' },
                { label: '所要時間順', value: 'duration' },
                { label: '名前順', value: 'title' },
              ]}
            />
            <OptionGroup
              label="目標で絞り込み"
              disabled={isLoadingGoalOptions}
              selectedValue={goal}
              onChange={setGoal}
              options={[
                { label: 'すべて', value: 'all' },
                { label: '目標なし', value: 'none' },
                ...goalOptions.map((item) => ({ label: item.title, value: item.id })),
              ]}
            />
          </>
        ) : null}
        {query || goal !== 'all' ? (
          <ActionButton
            label="検索・目標をクリア"
            variant="ghost"
            onPress={() => {
              setQuery('');
              setGoal('all');
            }}
          />
        ) : null}
      </View>
      {recommendationMode ? (
        <View style={{ gap: spacing.sm }}>
          {onOpenGoals ? (
            <View style={styles.secondaryActions}>
              <ActionButton
                label="目標 ›"
                accessibilityLabel="目標"
                variant="ghost"
                onPress={onOpenGoals}
              />
            </View>
          ) : null}
          {tasks.length > 0 ? (
            <View accessibilityRole="tablist" style={styles.filterRow}>
              {(
                [
                  { id: 'all', label: `すべて（${tasks.length}）` },
                  {
                    id: 'incomplete',
                    label: `未完了（${incompleteTasks.length}）`,
                  },
                  ...(overdueCount > 0 || nativeFilter === 'overdue'
                    ? [{ id: 'overdue' as const, label: `期限切れ（${overdueCount}）` }]
                    : []),
                  ...(recurringCount > 0 || nativeFilter === 'recurring'
                    ? [{ id: 'recurring' as const, label: `繰り返し（${recurringCount}）` }]
                    : []),
                ] as const
              ).map((chip) => {
                const selected = nativeFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setNativeFilter(chip.id)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.borderSubtle,
                        backgroundColor: selected
                          ? theme.colors.primary
                          : pressed
                            ? theme.colors.surfaceSubtle
                            : theme.colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        ...theme.typography.label,
                        color: selected ? theme.colors.onPrimary : theme.colors.textSecondary,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <TaskFilters
          activeFilter={activeFilter}
          filters={TASK_FILTERS}
          onChange={setActiveFilter}
        />
      )}
      {recommendationMode && (dayError || dailyError || actionMessage) ? (
        <View style={{ marginTop: spacing.sm }}>
          <Notice
            tone="error"
            message={dayError || dailyError || actionMessage}
            action={
              <ActionButton
                label="再読み込み"
                variant="secondary"
                onPress={() => {
                  setActionMessage('');
                  retryDay?.();
                  setDailyAttempt((value) => value + 1);
                  retry();
                }}
              />
            }
          />
        </View>
      ) : null}

      {
        <GoalOptionsNotice
          isLoading={isLoadingGoalOptions}
          message={goalOptionsError}
          onRetry={retryGoalOptions}
        />
      }

      {initialLoading ? (
        <TaskStatePanel
          isLoading
          message="登録したタスクを読み込んでいます。"
          testID="tasks-loading-state"
          title="読み込み中"
        />
      ) : loadError ? (
        <TaskStatePanel
          actionLabel={repository ? '再読み込み' : undefined}
          message={loadError}
          onPressAction={repository ? retry : undefined}
          testID="tasks-error-state"
          title={repository ? 'タスクを読み込めませんでした' : 'ログインが必要です'}
        />
      ) : tasks.length === 0 ? (
        <TaskStatePanel
          message={
            recommendationMode
              ? '「タスクを追加」から、取り組みたいことを名前だけで登録できます。'
              : '「タスクを追加」から、取り組む行動と所要時間を登録しましょう。登録したタスクはPlannerで計画にできます。'
          }
          testID="tasks-empty-state"
          title="まだタスクがありません"
        />
      ) : recommendationMode && nativeFilter === 'all' ? (
        activeVisibleTasks.length === 0 && completedVisibleTasks.length === 0 ? (
          <TaskStatePanel
            message="検索語・目標・状態フィルターを変更すると、ほかのタスクを確認できます。"
            testID="tasks-filter-empty-state"
            title="該当するタスクはありません"
          />
        ) : (
          <>
            {activeVisibleTasks.length > 0 ? (
              <Card style={styles.listCard}>
                {activeVisibleTasks.map((task, index) =>
                  taskRow(task, index === activeVisibleTasks.length - 1),
                )}
              </Card>
            ) : null}
            {completedVisibleTasks.length > 0 ? (
              <View style={styles.completedSection} testID="tasks-completed-section">
                <View style={styles.completedHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      completedExpanded
                        ? `完了済み（${completedVisibleTasks.length}）を折りたたむ`
                        : `完了済み（${completedVisibleTasks.length}）を表示`
                    }
                    accessibilityState={{ expanded: completedExpanded }}
                    onPress={() => setCompletedExpanded((value) => !value)}
                    style={({ pressed }) => [styles.completedToggle, pressed && { opacity: 0.65 }]}
                  >
                    <Text
                      style={{
                        ...theme.typography.sectionTitle,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {`完了済み（${completedVisibleTasks.length}） ${completedExpanded ? '▾' : '▸'}`}
                    </Text>
                  </Pressable>
                  {repository?.removeCompleted && finishedVisibleTasks.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="完了済みをすべて削除"
                      accessibilityState={{ disabled: isMutating || initialLoading }}
                      disabled={isMutating || initialLoading}
                      onPress={confirmDeleteCompleted}
                      style={({ pressed }) => [
                        styles.clearCompletedButton,
                        pressed && { opacity: 0.65 },
                      ]}
                    >
                      <Text
                        style={{
                          ...theme.typography.label,
                          color:
                            isMutating || initialLoading
                              ? theme.colors.disabledText
                              : theme.colors.error,
                        }}
                      >
                        完了済みをすべて削除
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {completedExpanded ? (
                  <Card style={styles.completedListCard}>
                    {completedVisibleTasks.map((task, index) =>
                      taskRow(task, index === completedVisibleTasks.length - 1),
                    )}
                  </Card>
                ) : null}
              </View>
            ) : null}
          </>
        )
      ) : visibleTasks.length === 0 ? (
        <TaskStatePanel
          message="検索語・目標・状態フィルターを変更すると、ほかのタスクを確認できます。"
          testID="tasks-filter-empty-state"
          title="該当するタスクはありません"
        />
      ) : recommendationMode ? (
        <Card style={styles.listCard}>
          {visibleTasks.map((task, index) => taskRow(task, index === visibleTasks.length - 1))}
        </Card>
      ) : (
        <View style={styles.list}>
          {visibleTasks.map((task, index) => {
            const deadline = deadlineOf(task);
            const overdue =
              task.status !== 'completed' && !!(today && deadline && deadline < today);
            return (
              <TaskListItem
                disabled={isMutating}
                compactActions={recommendationMode || Boolean(planningTimezone)}
                recommendationMode={recommendationMode}
                isDeleting={pendingMutation === `delete:${task.id}`}
                isLast={index === visibleTasks.length - 1}
                key={task.id}
                onDelete={() => confirmDelete(task)}
                onEdit={() => openEditForm(task)}
                task={toTaskSummary(
                  recommendationMode ? { ...task, localDeadline: deadline } : task,
                  goalOptions,
                )}
                overdue={overdue}
                onComplete={
                  (planningTimezone || recommendationMode) &&
                  task.status !== 'completed' &&
                  (!recommendationMode || (task.recurrence?.kind ?? 'once') === 'once')
                    ? () => void updateTask(task.id, { status: 'completed' })
                    : undefined
                }
                onReplan={
                  overdue && today && onReplanTask ? () => onReplanTask(task.id, today) : undefined
                }
              />
            );
          })}
        </View>
      )}

      {mutationError && editingTask === undefined ? (
        <View style={{ marginTop: spacing.md }}>
          <Notice tone="error" message={mutationError} />
        </View>
      ) : null}

      {editingTask !== undefined ? (
        <TaskFormModal
          errorMessage={mutationError}
          goalOptions={goalOptions}
          goalOptionsError={goalOptionsError}
          isLoadingGoalOptions={isLoadingGoalOptions}
          isSubmitting={isSaving || pendingMutation?.startsWith('delete:') === true}
          onClose={() => setEditingTask(undefined)}
          onDelete={
            recommendationMode && editingTask ? () => confirmDelete(editingTask) : undefined
          }
          onRetryGoalOptions={retryGoalOptions}
          onSubmit={saveTask}
          task={editingTask}
          planningTimezone={planningTimezone}
          recommendationMode={recommendationMode}
          onAskAI={
            editingTask && onAskAI
              ? () => {
                  setEditingTask(undefined);
                  onAskAI(editingTask);
                }
              : undefined
          }
          onOpenSteps={
            editingTask && onOpenSteps
              ? () => {
                  setEditingTask(undefined);
                  onOpenSteps(editingTask.id);
                }
              : undefined
          }
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, minWidth: 0 },
  listCard: { marginTop: spacing.md, padding: 0, gap: 0, overflow: 'hidden' },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs,
  },
  rowTitle: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  rowDeleteButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  completedToggle: {
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  clearCompletedButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  completedListCard: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  addButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill },
});
