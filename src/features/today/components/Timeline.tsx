import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/shared/components/Badge';
import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing } from '@/shared/theme';

import type { TimelineItem } from '../types';
import type { ActionExecutionStatus } from '../repositories/PlannedActionExecutionRepository';
import type { ActionMutationState } from '../usePlannedActionExecution';

type TimelineProps = {
  items: TimelineItem[];
  executionDisabled?: boolean;
  mutations?: Record<string, ActionMutationState>;
  onExecute?: (id: string, status: ActionExecutionStatus) => void;
};

export function Timeline({
  items,
  executionDisabled = false,
  mutations = {},
  onExecute,
}: TimelineProps) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const mutation = mutations[item.id];
        const updating = mutation?.status === 'updating';
        return (
          <View
            accessibilityLabel={[
              item.start + 'から' + item.end,
              item.title,
              '予定アクション',
              item.taskTitle ? 'タスク ' + item.taskTitle : null,
              item.goalTitle ? 'Goal ' + item.goalTitle : null,
              item.reason ? '理由 ' + item.reason : null,
              item.statusLabel,
            ]
              .filter(Boolean)
              .join('、')}
            key={item.id}
            style={[styles.row, index === items.length - 1 ? styles.lastRow : null]}
          >
            <View style={styles.timeColumn}>
              <Text style={styles.startTime}>{item.start}</Text>
              <Text style={styles.endTime}>{item.end}</Text>
            </View>
            <View style={styles.rail}>
              <View style={[styles.dot, styles.plannedDot]} />
              {index < items.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.details}>
              <Text style={styles.title}>{item.title}</Text>
              {item.taskTitle ? <Text style={styles.relation}>Task: {item.taskTitle}</Text> : null}
              {item.goalTitle ? <Text style={styles.relation}>Goal: {item.goalTitle}</Text> : null}
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
              <View style={styles.meta}>
                <Text style={styles.source}>予定アクション</Text>
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
              {item.status === 'scheduled' && onExecute ? (
                <View style={styles.operations}>
                  <ActionButton
                    accessibilityLabel={`${item.title}を完了する`}
                    disabled={executionDisabled || updating}
                    label={updating ? '更新中…' : '完了'}
                    onPress={() => onExecute(item.id, 'completed')}
                    variant="secondary"
                  />
                  <ActionButton
                    accessibilityLabel={`${item.title}をスキップする`}
                    disabled={executionDisabled || updating}
                    label="スキップ"
                    onPress={() => onExecute(item.id, 'skipped')}
                    variant="ghost"
                  />
                </View>
              ) : null}
              {mutation?.status === 'error' && item.status === 'scheduled' ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {mutation.message}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.sm,
  },
  row: {
    minHeight: 88,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  timeColumn: {
    width: 58,
    paddingTop: spacing.md,
  },
  startTime: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  endTime: {
    marginTop: 3,
    color: colors.textSubtle,
    fontSize: 12,
  },
  rail: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    zIndex: 1,
    width: 10,
    height: 10,
    marginTop: 17,
    borderRadius: 5,
  },
  plannedDot: {
    backgroundColor: colors.accent,
  },
  line: {
    position: 'absolute',
    top: 24,
    bottom: -17,
    width: 1,
    backgroundColor: colors.border,
  },
  details: {
    flex: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  relation: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
  },
  reason: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  source: {
    color: colors.textMuted,
    fontSize: 12,
  },
  operations: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.warning, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
