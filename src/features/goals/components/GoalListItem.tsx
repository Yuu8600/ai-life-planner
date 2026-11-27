import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ItemActions } from '@/shared/components/ItemActions';
import { useTheme } from '@/shared/theme';
import type { Task } from '@/features/tasks';
import type { GoalListItemModel } from '../types';

type GoalListItemProps = {
  disabled?: boolean;
  compactActions?: boolean;
  goal: GoalListItemModel;
  isDeleting?: boolean;
  isLast?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  relatedTasks?: readonly Task[];
  onAddTask?: () => void;
  onEditTask?: (task: Task) => void;
};
export function GoalListItem({
  disabled = false,
  compactActions = false,
  goal,
  isDeleting = false,
  onDelete,
  onEdit,
  relatedTasks,
  onAddTask,
  onEditTask,
}: GoalListItemProps) {
  const { colors, controls, spacing, typography } = useTheme();
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const longDescription = Boolean(
    goal.description && (goal.description.length > 80 || goal.description.split('\n').length > 2),
  );
  return (
    <Card testID={`goal-card-${goal.id}`} style={{ gap: spacing.sm }}>
      {compactActions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${goal.title}を編集する`}
          disabled={disabled}
          onPress={onEdit}
          style={({ pressed }) => ({
            minHeight: controls.minimumTarget,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            opacity: disabled || pressed ? 0.65 : 1,
          })}
        >
          <Text
            style={{
              ...typography.sectionTitle,
              color: colors.textPrimary,
              flex: 1,
            }}
          >
            {goal.title}
          </Text>
          <Text
            style={{ ...typography.sectionTitle, color: colors.textSecondary }}
            accessible={false}
          >
            ›
          </Text>
        </Pressable>
      ) : (
        <Text
          style={{
            ...typography.sectionTitle,
            color: colors.textPrimary,
            flexShrink: 1,
            maxWidth: '100%',
          }}
        >
          {goal.title}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs + 2,
          alignItems: 'center',
        }}
      >
        <Badge label={goal.statusLabel} tone={goal.status === 'completed' ? 'success' : 'accent'} />
        <Badge label={`期限 ${goal.deadlineLabel}`} tone="neutral" />
        <Badge label={goal.priorityLabel} tone="neutral" />
      </View>
      {goal.description ? (
        <View style={{ gap: spacing.xs }}>
          <Text
            numberOfLines={longDescription && !descriptionExpanded ? 2 : undefined}
            style={{ ...typography.secondary, color: colors.textSecondary }}
          >
            {goal.description}
          </Text>
          {longDescription ? (
            <ActionButton
              label={descriptionExpanded ? '説明を閉じる' : '説明を全文表示'}
              accessibilityLabel={`${goal.title}の説明を切り替える`}
              expanded={descriptionExpanded}
              disabled={disabled}
              onPress={() => setDescriptionExpanded((value) => !value)}
              variant="ghost"
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            />
          ) : null}
        </View>
      ) : null}
      {relatedTasks ? (
        <>
          <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
            関連タスク {relatedTasks.filter((task) => task.status === 'completed').length} /{' '}
            {relatedTasks.length} 件完了
          </Text>
          <ActionButton
            label={`関連タスクを見る（${relatedTasks.length}件）`}
            accessibilityLabel={`${goal.title}の関連タスクを${tasksExpanded ? '閉じる' : '見る'}`}
            variant="ghost"
            expanded={tasksExpanded}
            disabled={disabled}
            onPress={() => setTasksExpanded((value) => !value)}
          />
          {tasksExpanded ? (
            relatedTasks.length ? (
              relatedTasks.map((task) => (
                <ActionButton
                  key={task.id}
                  label={`${task.status === 'completed' ? '✓ ' : ''}${task.title}`}
                  accessibilityLabel={`${task.title}を編集する`}
                  variant="ghost"
                  disabled={disabled}
                  onPress={() => onEditTask?.(task)}
                />
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>関連タスクはまだありません。</Text>
            )
          ) : null}
        </>
      ) : null}
      {onAddTask ? (
        <ActionButton
          label="この目標のタスクを追加"
          accessibilityLabel={`${goal.title}のタスクを追加`}
          variant="secondary"
          disabled={disabled}
          onPress={onAddTask}
        />
      ) : null}
      <ItemActions
        title={goal.title}
        hideEdit={compactActions}
        disabled={disabled}
        isDeleting={isDeleting}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Card>
  );
}
