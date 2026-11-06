import { CalendarTimelineCard } from '@/features/calendar';
import { orderDailyTimeline } from '@/shared/types/dailyTimeline';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import type { PlannerPreviewViewModel } from '../plannerPreviewPresentation';

type PlannerPreviewProps = {
  isSaved?: boolean;
  preview: PlannerPreviewViewModel;
};

export function PlannerPreview({ isSaved = false, preview }: PlannerPreviewProps) {
  const calendarRows = preview.calendarEvents.map((event, index) => ({
    allDay: event.allDay,
    startAt: event.startAt,
    value: (
      <CalendarTimelineCard
        key={`calendar-${index}`}
        event={event}
        localDate={preview.localDate}
        timezone={preview.timezone}
      />
    ),
  }));
  return (
    <View style={styles.container} testID="planner-preview">
      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>プレビュー</Text>
        <Text style={styles.summary}>{preview.summary}</Text>
        <Text style={styles.temporary}>
          {isSaved
            ? 'この計画は保存済みです。'
            : '内容を確認し、下の「この計画を保存」でTodayに反映します。'}
        </Text>
      </View>

      <SectionHeader
        detail={`Action ${preview.actions.length}件・Calendar ${preview.calendarEvents.length}件`}
        title="1日の流れ"
      />
      {preview.calendarEvents.length > 0 ? (
        <Text style={styles.temporary}>Calendar予定は生成時点の参考情報です。</Text>
      ) : null}
      {preview.actions.length === 0 ? (
        <View style={styles.emptyCard} testID="planner-actions-empty">
          <Text style={styles.emptyText}>
            配置できるタスクがありません。Tasksの所要時間やCalendarの空き時間を確認してください。
          </Text>
        </View>
      ) : null}
      <View style={styles.list} testID="planner-actions-list">
        {orderDailyTimeline<ReactNode>([
          ...calendarRows,
          ...preview.actions.map((action, index) => ({
            allDay: false,
            startAt: action.startAt,
            value: (
              <View key={`action-${index}`} style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.time}>{action.timeRange}</Text>
                  <Text style={styles.title}>{action.title}</Text>
                </View>
                <Text style={styles.reason}>{action.reason}</Text>
              </View>
            ),
          })),
        ])}
      </View>

      <SectionHeader detail={`${preview.unscheduled.length}件`} title="未配置のタスク" />
      {preview.unscheduled.length === 0 ? (
        <View style={styles.emptyCard} testID="planner-unscheduled-empty">
          <Text style={styles.emptyText}>未配置のタスクはありません。</Text>
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
