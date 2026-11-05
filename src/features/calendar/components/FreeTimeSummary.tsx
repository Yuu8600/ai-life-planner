import { StyleSheet, Text, View } from 'react-native';

import type { FreeTimeCalculationResult } from '@/features/planner';
import { formatLocalTimeJa } from '@/features/today';
import { colors, radius, spacing } from '@/shared/theme';

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
    <View style={styles.container} testID="calendar-free-time">
      <Text style={styles.title}>空き時間</Text>
      <Text style={styles.total}>
        {result.freeSlots.length}枠・合計
        {formatDuration(result.freeSlots.reduce((total, slot) => total + slot.durationMinutes, 0))}
        分
      </Text>
      <Text style={styles.subtitle}>
        Plannerがタスクを配置できる時間帯。今日の計画はPlannerタブで作成できます。
      </Text>

      {result.freeSlots.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>条件を満たす空き時間はありません。</Text>
          <Text style={styles.subtitle}>Todayの設定から活動時間と最小空き時間を見直せます。</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {result.freeSlots.map((slot) => {
            const timeLabel = `${formatLocalTimeJa(slot.startAt, timezone)}–${formatLocalTimeJa(
              slot.endAt,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
  },
  total: { color: colors.accent, fontSize: 19, fontWeight: '700', marginBottom: spacing.sm },
  duration: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  list: {
    gap: spacing.sm,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  subtitle: {
    lineHeight: 20,
    marginBottom: spacing.md,
    color: colors.textMuted,
    fontSize: 13,
  },
  time: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginBottom: spacing.xs,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
