import { Text, View } from 'react-native';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ItemActions } from '@/shared/components/ItemActions';
import { useTheme } from '@/shared/theme';
import type { TaskSummary } from '../types';

type TaskListItemProps = {
  disabled?: boolean;
  isDeleting?: boolean;
  isLast?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  task: TaskSummary;
};
export function TaskListItem({
  disabled = false,
  isDeleting = false,
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
    </Card>
  );
}
