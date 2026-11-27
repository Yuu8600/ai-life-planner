import { getLocalDate } from '@/features/today';
import type {
  RecommendationRepository,
  RecommendationResult,
} from '@/features/recommendations/repository';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { getTaskErrorMessage } from './errors';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { ToastBanner } from '@/shared/components/ToastBanner';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { radius, spacing, useTheme } from '@/shared/theme';

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
  const [nativeFilter, setNativeFilter] = useState<'all' | 'overdue' | 'recurring'>(
    initialFilter === 'overdue' ? 'overdue' : 'all',
  );
  const filterSyncKey = `${initialFilter ?? ''}:${filterEntry ?? ''}`;
  const [lastFilterSync, setLastFilterSync] = useState(filterSyncKey);
  if (filterSyncKey !== lastFilterSync) {
    setLastFilterSync(filterSyncKey);
    if (initialFilter === 'overdue') setNativeFilter('overdue');
  }
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskSelection, setTaskSelection] = useState<string[] | null>(null);
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
  const overdueCount = recommendationMode
    ? tasks.filter((task) => !isComplete(task) && isOverdue(task)).length
    : 0;
  const recurringCount = recommendationMode
    ? tasks.filter((task) => (task.recurrence?.kind ?? 'once') !== 'once').length
    : 0;
  const visibleTasks = recommendationMode
    ? tasks.filter((task) => {
        if (nativeFilter === 'overdue') return !isComplete(task) && isOverdue(task);
        if (nativeFilter === 'recurring') return (task.recurrence?.kind ?? 'once') !== 'once';
        return true;
      })
    : tasks.filter((task) => matchesTaskFilter(task, activeFilter, now));
  const completedTasks = recommendationMode ? tasks.filter(isComplete) : [];
  const finishedTasks = completedTasks.filter((task) => task.status === 'completed');
  const performedToday = completedTasks.filter((task) => task.status !== 'completed');
  const selectedTasks = finishedTasks.filter((task) => taskSelection?.includes(task.id));
  if (recommendationMode && (initialFilter === 'overdue' || nativeFilter === 'overdue')) {
    visibleTasks.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));
  }
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
      setTaskSelection(null);
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

  function reopenSelected() {
    if (!recommendations?.undoBatch || !today || daily?.date !== today || !selectedTasks.length)
      return;
    void runBatch(`${selectedTasks.length}件を未完了に戻しました。`, () =>
      recommendations.undoBatch!(
        today,
        selectedTasks.map((task) => ({
          kind: 'task',
          id: task.id,
          expected: results.get(task.id) === 'completed' ? 'completed' : 'reopen',
        })),
      ),
    );
  }

  function deleteSelected() {
    if (!repository?.removeCompleted || !selectedTasks.length) return;
    const ids = selectedTasks.map((task) => task.id);
    appAlert.alert(
      `${ids.length}件のタスクを削除しますか？`,
      '関連する小さな行動とタスク向けの推薦方針も削除されます。実施記録や時間割の記録は残ります。削除は元に戻せません。',
      [
        { style: 'cancel', text: 'キャンセル' },
        {
          style: 'destructive',
          text: `${ids.length}件を削除`,
          onPress: () =>
            void runBatch(`${ids.length}件のタスクを削除しました。`, () =>
              repository.removeCompleted!(ids),
            ),
        },
      ],
    );
  }

  const dismissActionToast = useCallback(() => {
    setLastAction(undefined);
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

  function taskRow(task: Task, selecting = false, isLast = false) {
    const deadline = deadlineOf(task);
    const checked = isComplete(task);
    const overdue = !checked && isOverdue(task);
    const skipped = !checked && results.get(task.id) === 'skipped';
    const recurring = (task.recurrence?.kind ?? 'once') !== 'once';
    const dailyCheck = recurring && (!checked || results.get(task.id) === 'completed');
    const goalTitle = task.goalId ? goalTitleById.get(task.goalId) : undefined;
    const rowBusy = busyTaskId === task.id;

    return (
      <View
        key={task.id}
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
        {selecting ? (
          <CompletionCheckbox
            checked={taskSelection?.includes(task.id) ?? false}
            label={`${task.title}を選択`}
            disabled={isMutating}
            onPress={() =>
              setTaskSelection((prior) =>
                prior?.includes(task.id)
                  ? prior.filter((id) => id !== task.id)
                  : [...(prior ?? []), task.id],
              )
            }
          />
        ) : skipped ? (
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
          disabled={isMutating || selecting}
          onPress={() => {
            setShowCompleted(false);
            openEditForm(task);
          }}
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
              {overdue ? <Badge label={`期限切れ ${deadline}`} tone="error" /> : null}
              {!overdue && deadline ? <Badge label={`期限 ${deadline}`} tone="neutral" /> : null}
              {!checked && task.priority === 'high' ? <Badge label="高" tone="warning" /> : null}
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
          {!selecting ? (
            <Text style={{ ...theme.typography.sectionTitle, color: theme.colors.textSecondary }}>
              ›
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  const lastTask =
    lastAction?.date === today ? tasks.find((task) => task.id === lastAction?.taskId) : undefined;
  const lastOutcome = lastTask ? results.get(lastTask.id) : undefined;
  const actionUndo = lastOutcome && lastTask && lastAction?.undo ? lastTask : undefined;
  const modalActionFeedback =
    lastTask && lastAction && !actionMessage && !dailyError ? (
      <Notice
        tone="success"
        message={lastAction.message}
        action={
          actionUndo ? (
            <ActionButton
              label="元に戻す"
              variant="ghost"
              disabled={isMutating || !!dayError}
              onPress={() => void toggle(actionUndo)}
            />
          ) : undefined
        }
      />
    ) : null;

  const toastOverlay =
    !showCompleted && lastTask && lastAction && !actionMessage && !dailyError ? (
      <ToastBanner
        message={lastAction.message}
        actionLabel={actionUndo ? '元に戻す' : undefined}
        actionDisabled={isMutating || !!dayError}
        onAction={actionUndo ? () => void toggle(actionUndo) : undefined}
        onDismiss={dismissActionToast}
      />
    ) : null;

  return (
    <AppScreen testID="tasks-screen" overlay={toastOverlay}>
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

      {intro}
      {recommendationMode ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.secondaryActions}>
            {onOpenGoals ? (
              <ActionButton
                label="目標"
                variant="secondary"
                style={styles.pillAction}
                onPress={onOpenGoals}
              />
            ) : null}
            <ActionButton
              label={`完了済み（${completedTasks.length}）`}
              variant="secondary"
              style={styles.pillAction}
              onPress={() => {
                setTaskSelection(null);
                setBatchMessage('');
                setShowCompleted(true);
              }}
            />
          </View>
          {tasks.length > 0 ? (
            <View accessibilityRole="tablist" style={styles.filterRow}>
              {(
                [
                  { id: 'all', label: `すべて（${tasks.length}）` },
                  ...(overdueCount > 0
                    ? [{ id: 'overdue' as const, label: `期限切れ（${overdueCount}）` }]
                    : []),
                  ...(recurringCount > 0
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

      {!recommendationMode ? (
        <GoalOptionsNotice
          isLoading={isLoadingGoalOptions}
          message={goalOptionsError}
          onRetry={retryGoalOptions}
        />
      ) : null}

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
      ) : visibleTasks.length === 0 ? (
        <TaskStatePanel
          message="別のフィルターを選ぶと、ほかのタスクを確認できます。"
          testID="tasks-filter-empty-state"
          title="該当するタスクはありません"
        />
      ) : recommendationMode ? (
        <Card style={styles.listCard}>
          {visibleTasks.map((task, index) =>
            taskRow(task, false, index === visibleTasks.length - 1),
          )}
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

      {showCompleted ? (
        <ModalFrame
          title="完了済み"
          closeLabel="完了済みを閉じる"
          onClose={() => setShowCompleted(false)}
          closeDisabled={actionBusy}
          footer={
            taskSelection && finishedTasks.length ? (
              <View style={{ gap: spacing.xs }}>
                {recommendations?.undoBatch ? (
                  <ActionButton
                    label={`${selectedTasks.length}件を未完了に戻す`}
                    loading={actionBusy}
                    disabled={
                      !selectedTasks.length ||
                      initialLoading ||
                      !today ||
                      daily?.date !== today ||
                      !!dailyError ||
                      !!dayError
                    }
                    onPress={reopenSelected}
                  />
                ) : null}
                {repository?.removeCompleted ? (
                  <ActionButton
                    label={`${selectedTasks.length}件を削除`}
                    variant="ghost"
                    disabled={!selectedTasks.length || isMutating || initialLoading}
                    onPress={deleteSelected}
                  />
                ) : null}
              </View>
            ) : undefined
          }
        >
          {actionMessage || dailyError ? (
            <Notice tone="error" message={actionMessage || dailyError} />
          ) : null}
          {batchMessage ? <Notice tone="success" message={batchMessage} /> : null}
          {modalActionFeedback}
          {finishedTasks.length ? (
            <>
              <View style={styles.secondaryActions}>
                <SectionHeader compact title="完了したタスク" />
                {recommendations?.undoBatch || repository?.removeCompleted ? (
                  <ActionButton
                    label={taskSelection ? '選択をやめる' : '複数選択'}
                    variant="ghost"
                    disabled={isMutating || initialLoading}
                    onPress={() => {
                      setBatchMessage('');
                      setTaskSelection(taskSelection ? null : []);
                    }}
                  />
                ) : null}
              </View>
              <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
                {finishedTasks.map((task, index) =>
                  taskRow(task, !!taskSelection, index === finishedTasks.length - 1),
                )}
              </Card>
            </>
          ) : null}
          {!taskSelection && performedToday.length ? (
            <>
              <SectionHeader compact title="繰り返しタスクの今日の実施" />
              <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
                {performedToday.map((task, index) =>
                  taskRow(task, false, index === performedToday.length - 1),
                )}
              </Card>
            </>
          ) : null}
          {!completedTasks.length ? (
            <Text style={{ color: theme.colors.textSecondary }}>完了したタスクはありません。</Text>
          ) : null}
        </ModalFrame>
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
  pillAction: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill },
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
  addButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill },
});
