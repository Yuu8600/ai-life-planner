import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { colors, spacing } from '@/shared/theme';

import type { TaskSummary } from '../types';

type TaskListItemProps = {
  isLast?: boolean;
  task: TaskSummary;
};

export function TaskListItem({ isLast = false, task }: TaskListItemProps) {
  const tone =
    task.status === 'completed' ? 'accent' : task.status === 'unscheduled' ? 'warning' : 'neutral';

  return (
    <View style={[styles.container, isLast ? styles.lastItem : null]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.goal}>{task.goalTitle}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.minutes}>{task.estimatedMinutes}分</Text>
        <Badge label={task.statusLabel} tone={tone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  minutes: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
