import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { colors, radius, spacing } from '@/shared/theme';

import type { GoalSummary } from '../types';

type GoalListItemProps = {
  goal: GoalSummary;
  isLast?: boolean;
};

export function GoalListItem({ goal, isLast = false }: GoalListItemProps) {
  const progressWidth = `${goal.progress}%` as `${number}%`;

  return (
    <View style={[styles.container, isLast ? styles.lastItem : null]}>
      <View style={styles.heading}>
        <Text style={styles.title}>{goal.title}</Text>
        <Badge label={goal.priorityLabel} tone={goal.priority === 'high' ? 'accent' : 'neutral'} />
      </View>

      <View style={styles.values}>
        <View>
          <Text style={styles.valueLabel}>現在</Text>
          <Text style={styles.value}>
            {goal.currentValue}
            <Text style={styles.unit}>{goal.unit}</Text>
          </Text>
        </View>
        <Text accessibilityElementsHidden style={styles.arrow}>
          →
        </Text>
        <View>
          <Text style={styles.valueLabel}>目標</Text>
          <Text style={styles.value}>
            {goal.targetValue}
            <Text style={styles.unit}>{goal.unit}</Text>
          </Text>
        </View>
        <View style={styles.progressValue}>
          <Text style={styles.valueLabel}>進捗</Text>
          <Text style={styles.progressText}>{goal.progress}%</Text>
        </View>
      </View>

      <View
        accessibilityLabel={'進捗 ' + goal.progress + '%'}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: goal.progress }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <Text style={styles.deadline}>期限 {goal.deadline}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  values: {
    flexDirection: 'row',
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
  unit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
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
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 13,
  },
});
