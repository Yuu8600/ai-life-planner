import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { colors, radius, spacing } from '@/shared/theme';

import type { CreateGoalInput, Goal, GoalRepository } from './repositories/GoalRepository';
import { toGoalListItemModel } from './presentation';
import { useGoals } from './useGoals';
import { GoalFormModal } from './components/GoalFormModal';
import { GoalListItem } from './components/GoalListItem';
import { GoalStatePanel } from './components/GoalStatePanel';

type GoalsScreenProps = {
  repository: GoalRepository | null;
};

export function GoalsScreen({ repository }: GoalsScreenProps) {
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
  } = useGoals(repository);
  const [editingGoal, setEditingGoal] = useState<Goal | null | undefined>(undefined);
  const isMutating = pendingMutation !== null;
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

  const saveGoal = async (input: CreateGoalInput): Promise<boolean> => {
    const saved = editingGoal ? await updateGoal(editingGoal.id, input) : await createGoal(input);

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
    <AppScreen testID="goals-screen">
      <ScreenHeader subtitle="目標を決めたら、Tasksで取り組む行動に分けましょう。" title="目標" />

      {repository && !isLoading ? (
        <ActionButton
          accessibilityLabel="新しい目標を作成する"
          disabled={isMutating}
          label="＋ 目標を追加"
          onPress={openCreateForm}
          style={styles.addButton}
          variant="primary"
        />
      ) : null}

      {isLoading ? (
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
          message="「目標を追加」から、達成したいことを登録しましょう。次にTasksで具体的な行動を登録します。"
          testID="goals-empty-state"
          title="まだ目標がありません"
        />
      ) : (
        <View style={styles.list}>
          {goals.map((goal, index) => (
            <GoalListItem
              disabled={isMutating}
              goal={toGoalListItemModel(goal)}
              isDeleting={pendingMutation === `delete:${goal.id}`}
              isLast={index === goals.length - 1}
              key={goal.id}
              onDelete={() => confirmDelete(goal)}
              onEdit={() => openEditForm(goal)}
            />
          ))}
        </View>
      )}

      {mutationError && editingGoal === undefined ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {mutationError}
        </Text>
      ) : null}

      {editingGoal !== undefined ? (
        <GoalFormModal
          errorMessage={mutationError}
          goal={editingGoal}
          isSubmitting={isSaving}
          onClose={() => setEditingGoal(undefined)}
          onSubmit={saveGoal}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.xl,
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
