import { CalendarTimelineCard } from '@/features/calendar';
import { orderDailyTimeline } from '@/shared/types/dailyTimeline';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing, typography } from '@/shared/theme';
import { Badge } from '@/shared/components/Badge';
import { Notice } from '@/shared/components/Notice';

import type { PlannerPreviewViewModel } from '../plannerPreviewPresentation';

type PlannerPreviewProps = {
  isSaved?: boolean;
  children?: ReactNode;
  preview: PlannerPreviewViewModel;
};

export function PlannerPreview({ isSaved = false, preview, children }: PlannerPreviewProps) {
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
        <Badge
          label={isSaved ? '保存済み' : 'プレビュー・未保存'}
          tone={isSaved ? 'success' : 'accent'}
        />
        <Text style={styles.count}>配置されたAction {preview.actions.length}件</Text>
        <Text style={styles.summary}>{preview.summary}</Text>
        <Text style={styles.temporary}>
          {isSaved
            ? 'この計画は保存済みです。'
            : '内容を確認し、下の「この計画を保存」でTodayに反映します。'}
        </Text>
      </View>

      <SectionHeader
        compact
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
              <View key={`action-${index}`} style={[styles.item, styles.action]}>
                <Text style={styles.time}>Action</Text>
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

      {children}
      <SectionHeader compact detail={`${preview.unscheduled.length}件`} title="未配置のタスク" />
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
          <Notice
            tone="warning"
            title="注意事項"
            message={preview.warnings.map((warning) => warning.message).join('\n')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  summaryCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  count: { ...typography.bodyStrong, color: colors.action },
  summary: { ...typography.sectionTitle, color: colors.textPrimary },
  temporary: { ...typography.secondary, color: colors.textSecondary },
  list: { gap: spacing.sm },
  item: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  action: {
    borderLeftWidth: 3,
    borderLeftColor: colors.action,
    backgroundColor: colors.actionSoft,
  },
  itemHeader: { gap: spacing.xs },
  time: { ...typography.secondary, color: colors.action, fontVariant: ['tabular-nums'] },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  reason: { ...typography.secondary, color: colors.textSecondary },
  emptyCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
  warningCard: { minWidth: 0 },
});
