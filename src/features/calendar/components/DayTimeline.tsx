import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, spacing, typography } from '@/shared/theme';
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
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 768 && fontScale < 1.4;
  return (
    <View style={styles.container}>
      <SectionHeader compact title="選択日の予定" detail={`${events.length}件・${sourceLabel}`} />
      {events.map((event) => (
        <Card key={event.key} style={styles.event}>
          <View style={[styles.layout, columns && styles.columns]}>
            <Text style={[styles.time, columns && styles.timeColumn]}>{event.timeLabel}</Text>
            <View style={styles.body}>
              <Text style={[styles.title, event.isCanceled && styles.canceled]}>{event.title}</Text>
              <View style={styles.badges}>
                <Badge label={event.availabilityLabel} tone="neutral" />
                {event.isCanceled ? <Badge label="キャンセル済み" tone="warning" /> : null}
                {individualKeys.includes(event.key) ? (
                  <Badge label="個別余白" tone="accent" />
                ) : null}
              </View>
              {event.calendarTitle ? (
                <Text style={styles.metadata}>{event.calendarTitle}</Text>
              ) : null}
              {event.location ? <Text style={styles.metadata}>{event.location}</Text> : null}
              {onEditBuffer && editableKeys.includes(event.key) ? (
                <ActionButton
                  label="余白を設定"
                  accessibilityLabel={`${event.title}の余白を設定`}
                  onPress={() => onEditBuffer(event.key)}
                  variant="ghost"
                  style={styles.edit}
                />
              ) : null}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: spacing.md },
  event: { borderLeftWidth: 3, borderLeftColor: colors.calendar },
  layout: { gap: spacing.sm },
  columns: { flexDirection: 'row', gap: spacing.lg },
  timeColumn: { flexBasis: 180, flexShrink: 1 },
  body: { flex: 1, minWidth: 0, gap: spacing.sm },
  time: { ...typography.bodyStrong, color: colors.calendar, fontVariant: ['tabular-nums'] },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  metadata: { ...typography.secondary, color: colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  canceled: { textDecorationLine: 'line-through' },
  edit: { alignSelf: 'flex-start', maxWidth: '100%' },
});
