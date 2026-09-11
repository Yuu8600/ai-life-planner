import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

import type { CalendarItem } from '../types';

const START_HOUR = 8;
const END_HOUR = 19;
const HOUR_HEIGHT = 64;
const TIME_COLUMN_WIDTH = 52;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

type DayTimelineProps = {
  items: CalendarItem[];
};

function getItemLayout(item: CalendarItem) {
  const dayStartMinutes = START_HOUR * 60;
  const top = ((item.startMinutes - dayStartMinutes) / 60) * HOUR_HEIGHT;
  const durationHeight = ((item.endMinutes - item.startMinutes) / 60) * HOUR_HEIGHT;

  return {
    height: Math.max(durationHeight, 34),
    top,
  };
}

export function DayTimeline({ items }: DayTimelineProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
    return START_HOUR + index;
  });

  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.calendarDot]} />
          <Text style={styles.legendLabel}>Calendar Event</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.plannedDot]} />
          <Text style={styles.legendLabel}>AI Planned Action</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {hours.map((hour, index) => (
          <View key={hour} style={[styles.hourRow, { top: index * HOUR_HEIGHT }]}>
            <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        <View style={styles.eventsColumn}>
          {items.map((item) => {
            const isCalendar = item.kind === 'calendar';

            return (
              <View
                accessibilityLabel={`${item.startTime}から${item.endTime}、${item.title}、${
                  isCalendar ? 'カレンダー予定' : 'AIプラン'
                }`}
                key={item.id}
                style={[
                  styles.event,
                  isCalendar ? styles.calendarEvent : styles.plannedEvent,
                  getItemLayout(item),
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.eventTitle, isCalendar ? styles.calendarTitle : null]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.eventTime, isCalendar ? styles.calendarTime : null]}>
                  {item.startTime}–{item.endTime}
                </Text>
              </View>
            );
          })}
        </View>
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
  plannedDot: {
    backgroundColor: colors.accent,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  timeline: {
    height: TIMELINE_HEIGHT + 20,
  },
  hourRow: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: TIME_COLUMN_WIDTH,
    marginTop: -7,
    color: colors.textSubtle,
    fontSize: 11,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  eventsColumn: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: TIME_COLUMN_WIDTH,
  },
  event: {
    position: 'absolute',
    right: 0,
    left: spacing.sm,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  calendarEvent: {
    borderLeftColor: colors.calendar,
    backgroundColor: colors.calendarSoft,
  },
  plannedEvent: {
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  eventTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarTitle: {
    color: colors.text,
  },
  eventTime: {
    marginTop: 2,
    color: colors.accent,
    fontSize: 11,
  },
  calendarTime: {
    color: colors.textMuted,
  },
});
