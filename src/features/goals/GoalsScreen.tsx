import { Notice } from '@/shared/components/Notice';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  TaskFormModal,
  useTasks,
  type Task,
  type TaskRepository,
  type CreateTaskInput,
} from '@/features/tasks';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { spacing } from '@/shared/theme';

import type { Goal, GoalRepository } from './repositories/GoalRepository';
import { toGoalListItemModel } from './presentation';
import { useGoals } from './useGoals';
import type { GoalFormInput } from './validation';
import { GoalFormModal } from './components/GoalFormModal';
import { GoalListItem } from './components/GoalListItem';
import { GoalStatePanel } from './components/GoalStatePanel';

type GoalsScreenProps = {
  repository: GoalRepository | null;
  taskRepository?: TaskRepository | null;
  planningTimezone?: string;
  intro?: ReactNode;
  compactActions?: boolean;
  refreshToken?: number;
  onOpenAI?: (goal: Goal) => void;
  onBack?: () => void;
};

export function GoalsScreen({
  repository,
  compactActions = false,
  refreshToken = 0,
  onOpenAI,
  onBack,
  taskRepository,
  planningTimezone,
  intro,
}: GoalsScreenProps) {
  const {
    clearMutationError,
    createGoal,
    deleteGoal,
    goals,
    isLoading,
    loadError,
    mutationError,
    pendingMutation,
    retry,
    updateGoal,
  } = useGoals(repository, refreshToken);
  const taskState = useTasks(taskRepository ?? null, refreshToken);
  const [editingTask, setEditingTask] = useState<Task | null | undefined>();
  const [taskGoalId, setTaskGoalId] = useState<string>();
  const [goalClosing, setGoalClosing] = useState(false);
  const afterGoalClose = useRef<(() => void) | undefined>(undefined);
  const openTask = (goalId: string, task: Task | null = null) => {
    taskState.clearMutationError();
    setTaskGoalId(goalId);
    setEditingTask(task);
  };
  const transition = (action: () => void) => {
    if (Platform.OS !== 'ios') {
      setEditingGoal(undefined);
      action();
      return;
    }
    afterGoalClose.current = action;
    setGoalClosing(true);
  };
  const finishGoalClose = () => {
    setEditingGoal(undefined);
    setGoalClosing(false);
    const action = afterGoalClose.current;
    afterGoalClose.current = undefined;
    action?.();
  };
  async function saveTask(input: CreateTaskInput, keepAdding = false) {
    const { status: _status, ...editable } = input;
    const saved = editingTask
      ? await taskState.updateTask(editingTask.id, editable)
      : await taskState.createTask(input);
    if (saved && !keepAdding) {
      setEditingTask(undefined);
      setTaskGoalId(undefined);
    }
    return saved;
  }
  const [editingGoal, setEditingGoal] = useState<Goal | null | undefined>(undefined);
  const isMutating = pendingMutation !== null || taskState.pendingMutation !== null || goalClosing;
  const initialLoading = isLoading && !goals.length;
  const isSaving = pendingMutation === 'create' || pendingMutation?.startsWith('update:') === true;

  const openCreateForm = () => {
    if (isMutating || !repository) return;
    clearMutationError();
    setEditingGoal(null);
  };

  const openEditForm = (goal: Goal) => {
    if (isMutating) return;
    clearMutationError();
    setEditingGoal(goal);
  };

  const saveGoal = async (input: GoalFormInput): Promise<boolean> => {
    const saved = editingGoal
      ? await updateGoal(editingGoal.id, input)
      : await createGoal({ ...input, currentValue: null, targetValue: null, unit: null });

    if (saved) setEditingGoal(undefined);
    return saved;
  };

  const confirmDelete = (goal: Goal) => {
    if (isMutating) return;

    appAlert.alert(
      '目標を削除しますか？',
      `「${goal.title}」を削除します。この操作は取り消せません。`,
      [
        { style: 'cancel', text: 'キャンセル' },
        {
          onPress: () => void deleteGoal(goal.id),
          style: 'destructive',
          text: '削除',
        },
      ],
    );
  };

  return (
    <AppScreen
      testID="goals-screen"
      header={
        <ScreenHeader
          title="目標"
          backAction={
            onBack
              ? { label: 'タスク', accessibilityLabel: 'タスクに戻る', onPress: onBack }
              : undefined
          }
          action={
            repository && !initialLoading ? (
              <ActionButton
                accessibilityLabel="新しい目標を作成する"
                disabled={isMutating}
                label={compactActions ? '目標を追加' : '＋ 追加'}
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
      {taskRepository && taskState.loadError ? (
        <Notice
          tone="warning"
          message="関連タスクを読み込めませんでした。進捗は確認できません。"
          action={
            <ActionButton
              label="関連タスクを再読み込み"
              variant="secondary"
              onPress={taskState.retry}
            />
          }
        />
      ) : null}
      {initialLoading ? (
        <GoalStatePanel
          isLoading
          message="登録した目標を読み込んでいます。"
          testID="goals-loading-state"
          title="読み込み中"
        />
      ) : loadError ? (
        <GoalStatePanel
          actionLabel={repository ? '再読み込み' : undefined}
          message={loadError}
          onPressAction={repository ? retry : undefined}
          testID="goals-error-state"
          title={repository ? '目標を読み込めませんでした' : 'ログインが必要です'}
        />
      ) : goals.length === 0 ? (
        <GoalStatePanel
          message="「目標を追加」から、達成したいことを登録しましょう。タスクの編集画面から目標に紐付けられます。"
          testID="goals-empty-state"
          title="まだ目標がありません"
        />
      ) : (
        <View style={styles.list}>
          {goals.map((goal, index) => (
            <GoalListItem
              disabled={isMutating}
              compactActions={compactActions}
              goal={toGoalListItemModel(goal)}
              isDeleting={pendingMutation === `delete:${goal.id}`}
              isLast={index === goals.length - 1}
              key={goal.id}
              onDelete={() => confirmDelete(goal)}
              onEdit={() => openEditForm(goal)}
              relatedTasks={
                taskRepository && !taskState.loadError && !taskState.isLoading
                  ? taskState.tasks.filter((task) => task.goalId === goal.id)
                  : undefined
              }
              onAddTask={taskRepository ? () => openTask(goal.id) : undefined}
              onEditTask={taskRepository ? (task) => openTask(goal.id, task) : undefined}
            />
          ))}
        </View>
      )}

      {mutationError && editingGoal === undefined ? (
        <Notice tone="error" message={mutationError} />
      ) : null}

      {editingGoal !== undefined ? (
        <GoalFormModal
          visible={!goalClosing}
          onDismiss={finishGoalClose}
          planningTimezone={planningTimezone}
          errorMessage={mutationError}
          goal={editingGoal}
          isSubmitting={isSaving}
          onClose={() => setEditingGoal(undefined)}
          onSubmit={saveGoal}
          onAddTask={
            editingGoal && taskRepository
              ? () => transition(() => openTask(editingGoal.id))
              : undefined
          }
          onOpenAI={
            editingGoal && onOpenAI
              ? () => {
                  transition(() => onOpenAI(editingGoal));
                }
              : undefined
          }
        />
      ) : null}
      {editingTask !== undefined ? (
        <TaskFormModal
          task={editingTask}
          initialGoalId={editingTask ? undefined : taskGoalId}
          planningTimezone={planningTimezone}
          recommendationMode
          errorMessage={taskState.mutationError}
          isSubmitting={taskState.pendingMutation !== null}
          goalOptions={goals.map((goal) => ({ id: goal.id, title: goal.title }))}
          goalOptionsError={loadError}
          isLoadingGoalOptions={isLoading}
          onRetryGoalOptions={retry}
          onSubmit={saveTask}
          onClose={() => {
            setEditingTask(undefined);
            setTaskGoalId(undefined);
          }}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, minWidth: 0 },
  addButton: { minHeight: 48 },
});
