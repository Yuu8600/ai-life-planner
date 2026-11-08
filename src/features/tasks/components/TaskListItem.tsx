import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { colors, spacing } from '@/shared/theme';

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
  isLast = false,
  onDelete,
  onEdit,
  task,
}: TaskListItemProps) {
  const tone =
    task.status === 'completed' ? 'success' : task.status === 'pending' ? 'warning' : 'neutral';

  return (
    <View style={[styles.container, isLast ? styles.lastItem : null]}>
      <View style={styles.heading}>
        <View style={styles.copy}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.goal}>{task.goalTitle}</Text>
        </View>
        <View style={styles.badges}>
          <Badge label={task.statusLabel} tone={tone} />
          <Badge
            label={task.priorityLabel}
            tone={task.priority === 'high' ? 'accent' : 'neutral'}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.meta}>
          <Text style={styles.minutes}>所要時間 {task.estimatedMinutes}分</Text>
          <Text style={styles.deadline}>{task.deadlineLabel}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={`${task.title}を編集する`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onEdit}
            style={({ pressed }) => [styles.action, pressed && !disabled ? styles.pressed : null]}
          >
            <Text style={styles.editLabel}>編集</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`${task.title}を削除する`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onDelete}
            style={({ pressed }) => [styles.action, pressed && !disabled ? styles.pressed : null]}
          >
            <Text style={styles.deleteLabel}>{isDeleting ? '削除中…' : '削除'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  copy: {
    flex: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  badges: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  goal: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
  },
  meta: {
    flex: 1,
    gap: spacing.xs,
  },
  minutes: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  deadline: {
    color: colors.textMuted,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  editLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteLabel: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});
