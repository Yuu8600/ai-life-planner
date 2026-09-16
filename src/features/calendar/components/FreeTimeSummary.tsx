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
      <Text style={styles.subtitle}>AIが行動を配置できる時間帯</Text>

      {result.freeSlots.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>条件を満たす空き時間はありません。</Text>
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
  duration: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
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
    marginBottom: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
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
