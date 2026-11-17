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
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const today = planningTimezone ? getLocalDate(now ?? mountedAt, planningTimezone) : undefined;
  const [daily, setDaily] = useState<{ date: string; results: RecommendationResult[] }>();
  const [dailyError, setDailyError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
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
  const visibleTasks = tasks.filter((task) => {
    if (!recommendationMode) return matchesTaskFilter(task, activeFilter, now);
    return !isComplete(task);
  });
  const completedTasks = recommendationMode ? tasks.filter(isComplete) : [];
  if (recommendationMode && initialFilter === 'overdue') {
    visibleTasks.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));
  }
  const isMutating = pendingMutation !== null || actionBusy;
  const isSaving = pendingMutation === 'create' || pendingMutation?.startsWith('update:') === true;

  async function toggle(task: Task) {
    if (!recommendations || !today || daily?.date !== today || actionLock.current || isMutating)
      return;
    const outcome = results.get(task.id);
    actionLock.current = true;
    setActionBusy(true);
    setActionMessage('');
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
        await recommendations.record(today, 'task', task.id, 'completed');
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

  function taskRow(task: Task) {
    const deadline = deadlineOf(task);
    const checked = isComplete(task);
    const skipped = !checked && results.get(task.id) === 'skipped';
    const recurring = (task.recurrence?.kind ?? 'once') !== 'once';
    const detail = [
      !checked && isOverdue(task) ? `期限切れ ${deadline}` : deadline ? `期限 ${deadline}` : null,
      recurring ? (checked ? '今日の実施済み' : '繰り返し') : null,
      skipped ? '今日の見送り' : null,
    ]
      .filter(Boolean)
      .join(' ・ ');
    return (
      <View
        key={task.id}
        style={[styles.taskRow, { borderColor: theme.colors.borderSubtle }]}
        testID={`task-card-${task.id}`}
      >
        {skipped ? (
          <ActionButton
            label="戻す"
            accessibilityLabel={`${task.title}の見送りを取り消す`}
            variant="ghost"
            disabled={isMutating || !!dailyError || !!dayError}
            onPress={() => void toggle(task)}
          />
        ) : (
          <CompletionCheckbox
            checked={checked}
            label={`${task.title}を${checked ? '未完了に戻す' : '完了'}`}
            disabled={!today || daily?.date !== today || isMutating || !!dailyError || !!dayError}
            onPress={() => void toggle(task)}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}を編集する`}
          disabled={isMutating}
          onPress={() => {
            setShowCompleted(false);
            openEditForm(task);
          }}
          style={({ pressed }) => [styles.rowTitle, pressed && { opacity: 0.65 }]}
        >
          <Text style={{ ...theme.typography.bodyStrong, color: theme.colors.textPrimary }}>
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
            onPress={() => setShowCompleted(true)}
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

      {isLoading ? (
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
          message={
            recommendationMode
              ? '完了したタスクは「完了済み」で確認できます。'
              : '別のフィルターを選ぶと、ほかのタスクを確認できます。'
          }
          testID="tasks-filter-empty-state"
          title={recommendationMode ? '未完了のタスクはありません' : '該当するタスクはありません'}
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

      {mutationError && editingTask === undefined ? (
        <Notice tone="error" message={mutationError} />
      ) : null}

      {showCompleted ? (
        <ModalFrame
          title="完了済み"
          closeLabel="完了済みを閉じる"
          onClose={() => setShowCompleted(false)}
        >
          {actionMessage || dailyError ? (
            <Notice tone="error" message={actionMessage || dailyError} />
          ) : null}
          {completedTasks.length ? (
            completedTasks.map(taskRow)
          ) : (
            <Text style={{ color: theme.colors.textSecondary }}>完了したタスクはありません。</Text>
          )}
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
