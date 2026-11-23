import { getLocalDate } from '@/features/today';
import type {
  RecommendationRepository,
  RecommendationResult,
} from '@/features/recommendations/repository';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { getTaskErrorMessage } from './errors';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { spacing, useTheme } from '@/shared/theme';

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
    retry,
    retryGoalOptions,
    tasks,
    updateTask,
  } = useTasks(repository, refreshToken);
  const [mountedAt] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>(initialFilter ?? 'all');
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
  const visibleTasks = recommendationMode
    ? [...tasks]
    : tasks.filter((task) => matchesTaskFilter(task, activeFilter, now));
  const completedTasks = recommendationMode ? tasks.filter(isComplete) : [];
  const finishedTasks = completedTasks.filter((task) => task.status === 'completed');
  const performedToday = completedTasks.filter((task) => task.status !== 'completed');
  const selectedTasks = finishedTasks.filter((task) => taskSelection?.includes(task.id));
  if (recommendationMode && initialFilter === 'overdue') {
    visibleTasks.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));
  }
  const isMutating = pendingMutation !== null || actionBusy || (recommendationMode && isLoading);
  const isSaving = pendingMutation === 'create' || pendingMutation?.startsWith('update:') === true;

  async function toggle(task: Task) {
    if (!recommendations || !today || daily?.date !== today || actionLock.current || isMutating)
      return;
    const outcome = results.get(task.id);
    actionLock.current = true;
    setActionBusy(true);
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
      retry();
      actionLock.current = false;
      setActionBusy(false);
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
      retry();
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

  function taskRow(task: Task, selecting = false) {
    const deadline = deadlineOf(task);
    const checked = isComplete(task);
    const skipped = !checked && results.get(task.id) === 'skipped';
    const recurring = (task.recurrence?.kind ?? 'once') !== 'once';
    const dailyCheck = recurring && (!checked || results.get(task.id) === 'completed');
    const detail = [
      !checked && isOverdue(task) ? `期限切れ ${deadline}` : deadline ? `期限 ${deadline}` : null,
      checked ? (dailyCheck ? '今日の実施済み' : '完了') : recurring ? '繰り返し' : null,
      skipped ? 'あとで' : null,
    ]
      .filter(Boolean)
      .join(' ・ ');
    return (
      <View
        key={task.id}
        style={[styles.taskRow, { borderColor: theme.colors.borderSubtle }]}
        testID={`task-card-${task.id}`}
      >
        {selecting ? (
          <CompletionCheckbox
            checked={taskSelection?.includes(task.id) ?? false}
            label={`${task.title}を選択`}
            disabled={isMutating || isLoading}
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
          <Text
            style={[
              { ...theme.typography.bodyStrong, color: theme.colors.textPrimary },
              checked && {
                color: theme.colors.textSecondary,
                textDecorationLine: 'line-through',
              },
            ]}
          >
            {task.title}
          </Text>
          {detail ? (
            <Text style={{ ...theme.typography.secondary, color: theme.colors.textSecondary }}>
              {detail}
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
  const actionFeedback =
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

  return (
    <AppScreen testID="tasks-screen">
      <ScreenHeader
        title="タスク"
        action={
          repository && !isLoading && !loadError ? (
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
        <View style={styles.secondaryActions}>
          <ActionButton
            label={`完了済み（${completedTasks.length}）`}
            variant="ghost"
            onPress={() => {
              setTaskSelection(null);
              setBatchMessage('');
              setShowCompleted(true);
            }}
          />
          {onOpenGoals ? <ActionButton label="目標" variant="ghost" onPress={onOpenGoals} /> : null}
        </View>
      ) : (
        <TaskFilters
          activeFilter={activeFilter}
          filters={TASK_FILTERS}
          onChange={setActiveFilter}
        />
      )}
      {recommendationMode && (dayError || dailyError || actionMessage) ? (
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
      ) : null}

      {!recommendationMode ? (
        <GoalOptionsNotice
          isLoading={isLoadingGoalOptions}
          message={goalOptionsError}
          onRetry={retryGoalOptions}
        />
      ) : null}

      {isLoading && (!recommendationMode || !tasks.length) ? (
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
      ) : (
        <View style={recommendationMode ? styles.compactList : styles.list}>
          {visibleTasks.map((task, index) => {
            const deadline = deadlineOf(task);
            const overdue =
              task.status !== 'completed' && !!(today && deadline && deadline < today);
            if (recommendationMode) return taskRow(task);
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

      {!showCompleted ? actionFeedback : null}
      {mutationError && editingTask === undefined ? (
        <Notice tone="error" message={mutationError} />
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
                      isLoading ||
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
                    disabled={!selectedTasks.length || isMutating || isLoading}
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
          {actionFeedback}
          {finishedTasks.length ? (
            <>
              <View style={styles.secondaryActions}>
                <SectionHeader compact title="完了したタスク" />
                {recommendations?.undoBatch || repository?.removeCompleted ? (
                  <ActionButton
                    label={taskSelection ? '選択をやめる' : '複数選択'}
                    variant="ghost"
                    disabled={isMutating || isLoading}
                    onPress={() => {
                      setBatchMessage('');
                      setTaskSelection(taskSelection ? null : []);
                    }}
                  />
                ) : null}
              </View>
              {finishedTasks.map((task) => taskRow(task, !!taskSelection))}
            </>
          ) : null}
          {!taskSelection && performedToday.length ? (
            <>
              <SectionHeader compact title="繰り返しタスクの今日の実施" />
              {performedToday.map((task) => taskRow(task))}
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
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  compactList: { marginTop: spacing.sm, minWidth: 0 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  rowTitle: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  addButton: { minHeight: 48 },
});
