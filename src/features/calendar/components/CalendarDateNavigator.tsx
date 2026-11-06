import { StyleSheet, Text, View } from 'react-native';

import type { LocalDate } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing, typography } from '@/shared/theme';

import { getCalendarDateLabel } from '../presentation';

type CalendarDateNavigatorProps = {
  selectedDate: LocalDate;
  timeZone: string;
  isToday: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
};

export function CalendarDateNavigator({
  selectedDate,
  timeZone,
  isToday,
  onNext,
  onPrevious,
  onToday,
}: CalendarDateNavigatorProps) {
  return (
    <View style={styles.container}>
      <View accessibilityLabel="日付ナビゲーション" accessibilityRole="toolbar" style={styles.row}>
        <ActionButton
          accessibilityLabel="前の日を表示"
          label="←"
          onPress={onPrevious}
          style={styles.button}
          variant="secondary"
        />
        <Text accessibilityRole="header" style={styles.date}>
          {getCalendarDateLabel(selectedDate, timeZone)}
        </Text>
        <ActionButton
          accessibilityLabel="次の日を表示"
          label="→"
          onPress={onNext}
          style={styles.button}
          variant="secondary"
        />
      </View>
      {isToday ? (
        <Text style={styles.today}>今日</Text>
      ) : (
        <ActionButton label="今日に戻る" onPress={onToday} variant="ghost" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  button: {
    width: 48,
    paddingHorizontal: spacing.sm,
  },
  date: {
    ...typography.sectionTitle,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  today: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    minHeight: 48,
    paddingVertical: spacing.md,
  },
});
