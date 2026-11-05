import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

type PlanSummaryProps = {
  completedActions: number;
  summary: string;
  totalActions: number;
};

export function PlanSummary({ completedActions, summary, totalActions }: PlanSummaryProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.label}>今日のプラン</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      <View
        accessibilityLabel={'この計画の完了数 ' + completedActions + '件、全' + totalActions + '件'}
        style={styles.count}
      >
        <Text style={styles.countValue}>
          {completedActions}/{totalActions}
        </Text>
        <Text style={styles.countLabel}>この計画の完了</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  copy: {
    flexGrow: 1,
    flexBasis: 160,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  summary: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  count: {
    minWidth: 80,
    alignItems: 'center',
  },
  countValue: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  countLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
