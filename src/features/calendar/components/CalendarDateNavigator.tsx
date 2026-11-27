import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalDate } from '@/features/today';
import { Card } from '@/shared/components/Card';
import { colors, controls, radius, spacing, typography } from '@/shared/theme';

import { getCalendarDateLabel } from '../presentation';

type CalendarDateNavigatorProps = {
  selectedDate: LocalDate;
  timeZone: string;
  isToday: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onSelectDate?: () => void;
};

export function CalendarDateNavigator({
  selectedDate,
  timeZone,
  isToday,
  onNext,
  onPrevious,
  onToday,
  onSelectDate,
}: CalendarDateNavigatorProps) {
  const dateLabel = getCalendarDateLabel(selectedDate, timeZone);

  return (
    <Card style={styles.card}>
      <View accessibilityLabel="日付ナビゲーション" accessibilityRole="toolbar" style={styles.row}>
        <Pressable
          accessibilityLabel="前の日を表示"
          accessibilityRole="button"
          onPress={onPrevious}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <Text style={styles.navIcon} accessible={false}>
            ‹
          </Text>
        </Pressable>

        {onSelectDate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`日付を選ぶ。表示中は${dateLabel}`}
            onPress={onSelectDate}
            style={({ pressed }) => [styles.dateButton, pressed && styles.datePressed]}
          >
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.dateHint} accessible={false}>
              日付を変更 ▾
            </Text>
          </Pressable>
        ) : (
          <View style={styles.dateButton}>
            <Text accessibilityRole="header" style={styles.dateText}>
              {dateLabel}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityLabel="次の日を表示"
          accessibilityRole="button"
          onPress={onNext}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <Text style={styles.navIcon} accessible={false}>
            ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.todaySlot}>
        {isToday ? (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>今日</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="今日に戻る"
            onPress={onToday}
            style={({ pressed }) => [styles.backTodayPill, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backTodayText}>今日に戻る</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  navButton: {
    width: controls.minimumTarget,
    height: controls.minimumTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.94 }],
  },
  navIcon: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateButton: {
    flex: 1,
    minHeight: controls.minimumTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  datePressed: {
    backgroundColor: colors.primarySoft,
  },
  dateText: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  dateHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  todaySlot: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  todayPillText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  backTodayPill: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  backTodayText: {
    ...typography.label,
    color: colors.primary,
  },
});
