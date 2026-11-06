import { StyleSheet, Text, View } from 'react-native';
import { formatLocalTimeJa, getLocalDate } from '@/features/today';
import { colors, radius, spacing, typography } from '@/shared/theme';

export type CalendarTimelineEvent = {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  canceled?: boolean;
};

export function CalendarTimelineCard({
  event,
  localDate,
  timezone,
}: {
  event: CalendarTimelineEvent;
  localDate: string;
  timezone: string;
}) {
  const endpoint = (instant: string) => {
    const date = getLocalDate(instant, timezone);
    const time = formatLocalTimeJa(instant, timezone);
    return date === localDate ? time : `${date} ${time}`;
  };
  const time = event.allDay ? '終日' : `${endpoint(event.startAt)}–${endpoint(event.endAt)}`;
  const source = event.canceled
    ? 'Calendar・キャンセル済み・読み取り専用'
    : 'Calendar・読み取り専用';
  return (
    <View
      accessibilityLabel={`${time}、${event.title}、${source}`}
      style={styles.card}
      testID="calendar-timeline-event"
    >
      <Text style={styles.source}>{source}</Text>
      <Text style={styles.time}>{time}</Text>
      <Text style={[styles.title, event.canceled && styles.canceled]}>{event.title}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.calendarSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  source: { ...typography.caption, color: colors.calendar },
  time: { ...typography.caption, color: colors.calendar, fontVariant: ['tabular-nums'] },
  title: { ...typography.body, color: colors.calendar },
  canceled: { textDecorationLine: 'line-through' },
});
