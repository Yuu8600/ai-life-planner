import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

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
  refreshToken?: number;
  repository: TaskRepository | null;
};

export function TasksScreen({ refreshToken = 0, repository }: TasksScreenProps) {
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
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>('all');
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const visibleTasks = useMemo(
    () => tasks.filter((task) => matchesTaskFilter(task, activeFilter)),
    [activeFilter, tasks],
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

    Alert.alert(
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
        subtitle="目標につながる次の行動を、所要時間と一緒に確認します。"
        title="タスク"
      />

      <TaskFilters activeFilter={activeFilter} filters={TASK_FILTERS} onChange={setActiveFilter} />

      <GoalOptionsNotice
        isLoading={isLoadingGoalOptions}
        message={goalOptionsError}
        onRetry={retryGoalOptions}
      />

      {isLoading ? (
        <TaskStatePanel
          isLoading
          message="Supabaseからタスクを取得しています。"
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
          message="最初のタスクを登録すると、ここで次の行動を確認できます。"
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
          {visibleTasks.map((task, index) => (
            <TaskListItem
              disabled={isMutating}
              isDeleting={pendingMutation === `delete:${task.id}`}
              isLast={index === visibleTasks.length - 1}
              key={task.id}
              onDelete={() => confirmDelete(task)}
              onEdit={() => openEditForm(task)}
              task={toTaskSummary(task, goalOptions)}
            />
          ))}
        </View>
      )}

      {mutationError && editingTask === undefined ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {mutationError}
        </Text>
      ) : null}

      {repository && !isLoading && !loadError ? (
        <ActionButton
          accessibilityLabel="新しいタスクを作成する"
          disabled={isMutating}
          label="＋ タスクを追加"
          onPress={openCreateForm}
          style={styles.addButton}
          variant="secondary"
        />
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
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  addButton: {
    marginTop: spacing.lg,
  },
  error: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
});
