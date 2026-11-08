import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { colors, radius, spacing } from '@/shared/theme';

import type { GoalListItemModel } from '../types';

type GoalListItemProps = {
  disabled?: boolean;
  goal: GoalListItemModel;
  isDeleting?: boolean;
  isLast?: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

export function GoalListItem({
  disabled = false,
  goal,
  isDeleting = false,
  isLast = false,
  onDelete,
  onEdit,
}: GoalListItemProps) {
  const progressWidth = `${goal.progress ?? 0}%` as `${number}%`;

  return (
    <View style={[styles.container, isLast ? styles.lastItem : null]}>
      <View style={styles.heading}>
        <Text style={styles.title}>{goal.title}</Text>
        <View style={styles.badges}>
          <Badge
            label={goal.priorityLabel}
            tone={goal.priority === 'high' ? 'accent' : 'neutral'}
          />
          <Badge
            label={goal.statusLabel}
            tone={goal.status === 'completed' ? 'success' : 'neutral'}
          />
        </View>
      </View>

      {goal.description ? (
        <Text numberOfLines={2} style={styles.description}>
          {goal.description}
        </Text>
      ) : null}

      <View style={styles.values}>
        <View>
          <Text style={styles.valueLabel}>現在</Text>
          <Text style={styles.value}>{goal.currentValueLabel}</Text>
        </View>
        <Text accessibilityElementsHidden style={styles.arrow}>
          →
        </Text>
        <View>
          <Text style={styles.valueLabel}>目標</Text>
          <Text style={styles.value}>{goal.targetValueLabel}</Text>
        </View>
        <View style={styles.progressValue}>
          <Text style={styles.valueLabel}>進捗</Text>
          <Text style={styles.progressText}>
            {goal.progress === null ? '—' : `${goal.progress}%`}
          </Text>
        </View>
      </View>

      <View
        accessibilityLabel={goal.progress === null ? '進捗 未設定' : `進捗 ${goal.progress}%`}
        accessibilityRole={goal.progress === null ? undefined : 'progressbar'}
        accessibilityValue={
          goal.progress === null ? undefined : { min: 0, max: 100, now: goal.progress }
        }
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.deadline}>期限 {goal.deadlineLabel}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={`${goal.title}を編集する`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onEdit}
            style={({ pressed }) => [styles.action, pressed && !disabled ? styles.pressed : null]}
          >
            <Text style={styles.editLabel}>編集</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`${goal.title}を削除する`}
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
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  badges: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  description: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  valueLabel: {
    marginBottom: 2,
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  arrow: {
    paddingBottom: 3,
    color: colors.textSubtle,
    fontSize: 16,
  },
  progressValue: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  progressText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    marginTop: spacing.md,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  deadline: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
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
