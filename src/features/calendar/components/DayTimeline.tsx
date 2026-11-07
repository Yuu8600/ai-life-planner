import { ActionButton } from '@/shared/components/ActionButton';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

import type { CalendarEventViewModel } from '../presentation';

type DayTimelineProps = {
  events: CalendarEventViewModel[];
  sourceLabel?: string;
  onEditBuffer?: (key: string) => void;
  editableKeys?: string[];
  individualKeys?: string[];
};

export function DayTimeline({
  events,
  onEditBuffer,
  editableKeys = [],
  individualKeys = [],
  sourceLabel = '端末カレンダー（読み取り専用）',
}: DayTimelineProps) {
  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.calendarDot]} />
          <Text style={styles.legendLabel}>{sourceLabel}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {events.map((event) => (
          <View accessibilityLabel={event.accessibilityLabel} key={event.key} style={styles.event}>
            <View style={styles.timeColumn}>
              <Text style={styles.eventTime}>{event.timeLabel}</Text>
              <Text style={styles.availability}>{event.availabilityLabel}</Text>
            </View>
            <View style={styles.eventBody}>
              <Text
                numberOfLines={2}
                style={[styles.eventTitle, event.isCanceled ? styles.canceled : null]}
              >
                {event.title}
              </Text>
              {event.calendarTitle ? (
                <Text numberOfLines={1} style={styles.metadata}>
                  {event.calendarTitle}
                </Text>
              ) : null}
              {event.location ? (
                <Text numberOfLines={1} style={styles.metadata}>
                  {event.location}
                </Text>
              ) : null}
              {individualKeys.includes(event.key) ? (
                <Text style={styles.metadata}>個別余白</Text>
              ) : null}
              {onEditBuffer && editableKeys.includes(event.key) ? (
                <ActionButton
                  label="余白を設定"
                  accessibilityLabel={`${event.title}の余白を設定`}
                  onPress={() => onEditBuffer(event.key)}
                  variant="secondary"
                />
              ) : null}
              {event.isCanceled ? <Text style={styles.canceledLabel}>キャンセル済み</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calendarDot: {
    backgroundColor: colors.calendar,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  list: {
    gap: spacing.sm,
  },
  event: {
    minHeight: 74,
    flexDirection: 'row',
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.calendar,
    borderRadius: radius.md,
    backgroundColor: colors.calendarSoft,
  },
  timeColumn: {
    width: 104,
    paddingRight: spacing.sm,
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  eventTime: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  availability: {
    marginTop: spacing.xs,
    color: colors.textSubtle,
    fontSize: 10,
  },
  metadata: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
  },
  canceled: {
    textDecorationLine: 'line-through',
  },
  canceledLabel: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
});
