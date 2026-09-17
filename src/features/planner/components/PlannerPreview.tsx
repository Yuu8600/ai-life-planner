import { StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import type { PlannerPreviewViewModel } from '../plannerPreviewPresentation';

type PlannerPreviewProps = {
  preview: PlannerPreviewViewModel;
};

export function PlannerPreview({ preview }: PlannerPreviewProps) {
  return (
    <View style={styles.container} testID="planner-preview">
      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>プレビュー</Text>
        <Text style={styles.summary}>{preview.summary}</Text>
        <Text style={styles.temporary}>この計画はまだ保存されていません。</Text>
      </View>

      <SectionHeader detail={`${preview.actions.length}件`} title="予定に配置したTask" />
      {preview.actions.length === 0 ? (
        <View style={styles.emptyCard} testID="planner-actions-empty">
          <Text style={styles.emptyText}>配置されたActionはありません。</Text>
        </View>
      ) : (
        <View style={styles.list} testID="planner-actions-list">
          {preview.actions.map((action) => (
            <View key={action.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.time}>{action.timeRange}</Text>
                <Text style={styles.title}>{action.title}</Text>
              </View>
              <Text style={styles.reason}>{action.reason}</Text>
            </View>
          ))}
        </View>
      )}

      <SectionHeader detail={`${preview.unscheduled.length}件`} title="未配置のTask" />
      {preview.unscheduled.length === 0 ? (
        <View style={styles.emptyCard} testID="planner-unscheduled-empty">
          <Text style={styles.emptyText}>未配置のTaskはありません。</Text>
        </View>
      ) : (
        <View style={styles.list} testID="planner-unscheduled-list">
          {preview.unscheduled.map((task) => (
            <View key={task.taskId} style={styles.item}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.reason}>{task.reason}</Text>
            </View>
          ))}
        </View>
      )}

      {preview.warnings.length > 0 ? (
        <View style={styles.warningCard} testID="planner-warnings">
          <Text style={styles.warningTitle}>注意事項</Text>
          {preview.warnings.map((warning, index) => (
            <Text key={`${warning.code}-${warning.path}-${index}`} style={styles.warningText}>
              ・{warning.message}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
  },
  summaryCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summary: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  temporary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  item: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemHeader: {
    gap: spacing.xs,
  },
  time: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  reason: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
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
  warningCard: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
});
