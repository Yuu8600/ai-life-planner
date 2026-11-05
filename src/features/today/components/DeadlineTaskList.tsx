import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { colors, radius, spacing } from '@/shared/theme';

import type { DeadlineTaskItem } from '../types';

type DeadlineTaskListProps = {
  items: readonly DeadlineTaskItem[];
};

export function DeadlineTaskList({ items }: DeadlineTaskListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.empty} testID="today-deadline-tasks-empty">
        <Text style={styles.emptyText}>今日が期限のタスクはありません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.list} testID="today-deadline-tasks">
      {items.map((item, index) => (
        <View
          accessibilityLabel={[
            item.title,
            '今日が期限のTask',
            item.goalTitle ? `Goal ${item.goalTitle}` : null,
            item.statusLabel,
          ]
            .filter(Boolean)
            .join('、')}
          key={item.id}
          style={[styles.item, index === items.length - 1 ? styles.lastItem : null]}
        >
          <View style={styles.copy}>
            <Text style={styles.title}>{item.title}</Text>
            {item.goalTitle ? <Text style={styles.goal}>Goal: {item.goalTitle}</Text> : null}
          </View>
          <Badge
            label={item.statusLabel}
            tone={
              item.status === 'completed'
                ? 'accent'
                : item.status === 'skipped'
                  ? 'warning'
                  : 'neutral'
            }
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
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
    fontSize: 15,
    fontWeight: '700',
  },
  goal: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
