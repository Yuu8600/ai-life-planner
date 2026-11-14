import { Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ItemActions } from '@/shared/components/ItemActions';
import { useTheme } from '@/shared/theme';
import type { TaskSummary } from '../types';

type TaskListItemProps = {
  disabled?: boolean;
  isDeleting?: boolean;
  isLast?: boolean;
  overdue?: boolean;
  onComplete?: () => void;
  onReplan?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  task: TaskSummary;
};
export function TaskListItem({
  disabled = false,
  isDeleting = false,
  overdue,
  onComplete,
  onReplan,
  onDelete,
  onEdit,
  task,
}: TaskListItemProps) {
  const { colors, spacing, typography } = useTheme();
  const tone =
    task.status === 'completed'
      ? 'success'
      : task.status === 'scheduled'
        ? 'info'
        : task.status === 'skipped'
          ? 'warning'
          : 'neutral';
  return (
    <Card testID={`task-card-${task.id}`} style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>{task.title}</Text>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'baseline' }}
      >
        <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
          所要時間 {task.estimatedMinutes}分
        </Text>
        <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
          {task.deadlineLabel}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: spacing.sm, flexGrow: 1, flexBasis: 160, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Badge label={task.statusLabel} tone={tone} />
            <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
              {task.priorityLabel}
            </Text>
          </View>
          {task.goalId !== null ? (
            <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
              {task.goalTitle}
            </Text>
          ) : null}
        </View>
        <ItemActions
          title={task.title}
          disabled={disabled}
          isDeleting={isDeleting}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </View>
      {overdue ? <Badge label="期限切れ・自動配置を保留" tone="warning" /> : null}
      {onComplete || onReplan ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {onComplete ? (
            <ActionButton
              label="タスクを完了にする"
              variant="ghost"
              disabled={disabled}
              onPress={onComplete}
            />
          ) : null}
          {overdue ? (
            <ActionButton label="期限を編集" variant="ghost" disabled={disabled} onPress={onEdit} />
          ) : null}
          {onReplan ? (
            <ActionButton
              label="再計画"
              variant="secondary"
              disabled={disabled}
              onPress={onReplan}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
