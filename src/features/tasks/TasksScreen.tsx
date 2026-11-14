import { getLocalDate } from '@/features/today';
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
import type { TaskFilterId } from './types';
import { useTasks } from './useTasks';

type TasksScreenProps = {
  intro?: ReactNode;
  planningTimezone?: string;
  onReplanTask?: (taskId: string, date: string) => void;
  now?: Date;
  refreshToken?: number;
  repository: TaskRepository | null;
};

export function TasksScreen({
  intro,
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
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>('all');
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const visibleTasks = useMemo(
    () => tasks.filter((task) => matchesTaskFilter(task, activeFilter, now)),
    [activeFilter, tasks, now],
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
              label="＋ 追加"
              onPress={openCreateForm}
              style={styles.addButton}
              variant="primary"
            />
          ) : null
        }
      />

      {intro}
      <TaskFilters activeFilter={activeFilter} filters={TASK_FILTERS} onChange={setActiveFilter} />

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
          message="「タスクを追加」から、取り組む行動と所要時間を登録しましょう。登録したタスクはPlannerで計画にできます。"
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
            const today = planningTimezone
              ? getLocalDate(now ?? mountedAt, planningTimezone)
              : undefined;
            const deadline =
              task.localDeadline ??
              (task.deadline && planningTimezone
                ? getLocalDate(task.deadline, planningTimezone)
                : null);
            const overdue =
              task.status !== 'completed' && Boolean(today && deadline && deadline < today);
            return (
              <TaskListItem
                disabled={isMutating}
                isDeleting={pendingMutation === `delete:${task.id}`}
                isLast={index === visibleTasks.length - 1}
                key={task.id}
                onDelete={() => confirmDelete(task)}
                onEdit={() => openEditForm(task)}
                task={toTaskSummary(task, goalOptions)}
                overdue={overdue}
                onComplete={
                  planningTimezone && task.status !== 'completed'
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
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, minWidth: 0 },
  addButton: { minHeight: 48 },
});
