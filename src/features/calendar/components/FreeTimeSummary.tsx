import { StyleSheet, Text, View } from 'react-native';

import type { FreeTimeCalculationResult } from '@/features/planner';
import { formatPlanningTime, getLocalDate } from '@/features/today';
import { colors, spacing, typography } from '@/shared/theme';
import { Card } from '@/shared/components/Card';

type FreeTimeSummaryProps = {
  result: FreeTimeCalculationResult;
  timezone: string;
};

function formatDuration(durationMinutes: number): string {
  return Number.isInteger(durationMinutes)
    ? String(durationMinutes)
    : durationMinutes.toFixed(1).replace(/\.0$/, '');
}

export function FreeTimeSummary({ result, timezone }: FreeTimeSummaryProps) {
  return (
    <Card style={styles.container} testID="calendar-free-time">
      <Text accessibilityRole="header" style={styles.title}>
        配置可能な空き時間
      </Text>
      <Text style={styles.total}>
        {result.freeSlots.length}枠・合計
        {formatDuration(result.freeSlots.reduce((total, slot) => total + slot.durationMinutes, 0))}
        分
      </Text>
      <Text style={styles.subtitle}>
        Calendar予定・余白・最小空き時間に基づく候補です。Todayと異なり、保存済みActionと過去の時間は差し引いていません。
      </Text>

      <Text style={styles.subtitle}>
        活動時間{' '}
        {formatPlanningTime(
          result.planningWindow.startAt,
          getLocalDate(result.planningWindow.startAt, timezone),
          timezone,
        )}
        –
        {formatPlanningTime(
          result.planningWindow.endAt,
          getLocalDate(result.planningWindow.startAt, timezone),
          timezone,
        )}
      </Text>
      {result.freeSlots.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>条件を満たす空き時間はありません。</Text>
          <Text style={styles.subtitle}>Settingsで活動時間と最小空き時間を見直せます。</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {result.freeSlots.map((slot) => {
            const timeLabel = `${formatPlanningTime(slot.startAt, getLocalDate(result.planningWindow.startAt, timezone), timezone)}–${formatPlanningTime(
              slot.endAt,
              getLocalDate(result.planningWindow.startAt, timezone),
              timezone,
            )}`;
            const durationLabel = `${formatDuration(slot.durationMinutes)}分`;

            return (
              <View
                accessibilityLabel={`${timeLabel}、${durationLabel}`}
                key={`${slot.startAt}:${slot.endAt}`}
                style={styles.slot}
              >
                <Text style={styles.time}>{timeLabel}</Text>
                <Text style={styles.duration}>{durationLabel}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  total: { ...typography.bodyStrong, color: colors.available },
  subtitle: { ...typography.secondary, color: colors.textSecondary },
  emptyCard: { gap: spacing.sm, paddingVertical: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary },
  list: { gap: spacing.sm },
  slot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  time: {
    ...typography.bodyStrong,
    color: colors.available,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  duration: { ...typography.secondary, color: colors.textSecondary },
});
