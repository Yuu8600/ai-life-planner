import { addLocalDays, getLocalDate } from '@/features/today';
import { Notice } from '@/shared/components/Notice';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { spacing } from '@/shared/theme';

import { GoalOptionsNotice } from './components/GoalOptionsNotice';
import { TaskFilters } from './components/TaskFilters';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskListItem } from './components/TaskListItem';
import { TaskStatePanel } from './components/TaskStatePanel';
import { TASK_FILTERS } from './filters';
import { matchesTaskFilter, toTaskSummary } from './presentation';
import type { CreateTaskInput, Task, TaskRepository } from './repositories/TaskRepository';
import type { TaskFilter, TaskFilterId } from './types';
import { useTasks } from './useTasks';

type TasksScreenProps = {
  intro?: ReactNode;
  recommendationMode?: boolean;
  initialFilter?: TaskFilterId;
  onOpenSteps?: (taskId: string) => void;
  onOpenGoals?: () => void;
  planningTimezone?: string;
  onReplanTask?: (taskId: string, date: string) => void;
  now?: Date;
  refreshToken?: number;
  repository: TaskRepository | null;
};

const recommendationFilters: readonly TaskFilter[] = [
  { id: 'open', label: '未完了' },
  { id: 'near', label: '期限が近い' },
  { id: 'recurring', label: '繰り返し' },
  { id: 'overdue', label: '期限切れ' },
  { id: 'all', label: 'すべて' },
];

export function TasksScreen({
  intro,
  recommendationMode = false,
  initialFilter,
  onOpenSteps,
  onOpenGoals,
  now,
  planningTimezone,
  onReplanTask,
  refreshToken = 0,
  repository,
}: TasksScreenProps) {
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
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>(
    initialFilter ?? (recommendationMode ? 'open' : 'all'),
  );
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const today = planningTimezone ? getLocalDate(now ?? mountedAt, planningTimezone) : undefined;
  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!recommendationMode || activeFilter === 'all')
          return matchesTaskFilter(task, activeFilter, now);
        if (task.status === 'completed' || task.status === 'skipped') return false;
        if (activeFilter === 'open') return true;
        if (activeFilter === 'recurring')
          return Boolean(task.recurrence && task.recurrence.kind !== 'once');
        const deadline =
          task.localDeadline ??
          (task.deadline && planningTimezone
            ? getLocalDate(task.deadline, planningTimezone)
            : null);
        if (!deadline || !today) return false;
        if (activeFilter === 'overdue')
          return (task.recurrence?.kind ?? 'once') === 'once' && deadline < today;
        return deadline >= today && deadline <= addLocalDays(today, 7);
      }),
    [tasks, activeFilter, recommendationMode, now, planningTimezone, today],
  );
  const isMutating = pendingMutation !== null;
  const isSaving = pendingMutation === 'create' || pendingMutation?.startsWith('update:') === true;

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
    const saved = editingTask ? await updateTask(editingTask.id, input) : await createTask(input);

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
          onPress: () => void deleteTask(task.id),
          style: 'destructive',
          text: '削除',
        },
      ],
    );
  };

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
      {onOpenGoals ? (
        <ActionButton label="目標を見る" variant="secondary" onPress={onOpenGoals} />
      ) : null}
      <TaskFilters
        activeFilter={activeFilter}
        filters={recommendationMode ? recommendationFilters : TASK_FILTERS}
        onChange={setActiveFilter}
      />

      <GoalOptionsNotice
        isLoading={isLoadingGoalOptions}
        message={goalOptionsError}
        onRetry={retryGoalOptions}
      />

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
          message="別のフィルターを選ぶと、ほかのタスクを確認できます。"
          testID="tasks-filter-empty-state"
          title="該当するタスクはありません"
        />
      ) : (
        <View style={styles.list}>
          {visibleTasks.map((task, index) => {
            const deadline =
              task.localDeadline ??
              (task.deadline && planningTimezone
                ? getLocalDate(task.deadline, planningTimezone)
                : null);
            const overdue =
              task.status !== 'completed' &&
              Boolean(today && deadline && deadline < today) &&
              (!recommendationMode || (task.recurrence?.kind ?? 'once') === 'once');
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

      {editingTask !== undefined ? (
        <TaskFormModal
          errorMessage={mutationError}
          goalOptions={goalOptions}
          goalOptionsError={goalOptionsError}
          isLoadingGoalOptions={isLoadingGoalOptions}
          isSubmitting={isSaving}
          onClose={() => setEditingTask(undefined)}
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
  addButton: { minHeight: 48 },
});
