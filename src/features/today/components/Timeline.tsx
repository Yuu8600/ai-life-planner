import type { ReactNode } from 'react';
import { selectNextAction } from '../nextAction';
import { Card } from '@/shared/components/Card';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CalendarTimelineCard } from '@/features/calendar';
import { SelectionPanel, type PanelAnchor } from '@/shared/components/timeSelection/SelectionPanel';
import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing, radius } from '@/shared/theme';
import { formatPlanningTime } from '../planningTime';
import {
  axisPosition,
  axisTicks,
  AXIS_TAP_HEIGHT,
  layoutTimeAxis,
  resolveAxisWindow,
  type AxisWindow,
} from '../timeAxis';
import { TimelineDetails, type TimelineProps } from './TimelineDetails';

const AXIS_TOP_INSET = 12;

export function Timeline(
  props: TimelineProps & {
    completedActions?: number;
    totalActions?: number;
    supplement?: ReactNode;
    window?: AxisWindow;
    now?: Date;
    freeSlots?: readonly AxisWindow[];
    availabilityMessage?: string;
    focusScroll?: { isPending: () => boolean; consume: () => void };
    isLoading?: boolean;
  },
) {
  const {
    items,
    calendarEvents = [],
    localDate = '2000-01-01',
    timezone = 'UTC',
    now = new Date(),
    freeSlots = [],
    availabilityMessage,
    focusScroll,
    isLoading,
  } = props;
  const { fontScale } = useWindowDimensions();
  const tapHeight = Math.max(AXIS_TAP_HEIGHT, Math.ceil(38 * fontScale + 8));
  const startAt = props.window?.startAt,
    endAt = props.window?.endAt;
  const window = useMemo(
    () => (startAt && endAt ? { startAt, endAt } : resolveAxisWindow(localDate, timezone)),
    [startAt, endAt, localDate, timezone],
  );
  const entries = useMemo(
    () => [
      ...items.map((item) => ({
        id: `action:${item.id}`,
        startAt: item.startAt,
        endAt: item.endAt,
        title: item.title,
        kind: 'action' as const,
        item,
      })),
      ...calendarEvents
        .filter((event) => !event.allDay)
        .map((event, index) => ({ id: `calendar:${index}`, ...event, kind: 'calendar' as const })),
    ],
    [items, calendarEvents],
  );
  const layout = useMemo(
    () => layoutTimeAxis(window, entries, tapHeight),
    [window, entries, tapHeight],
  );
  const ticks = useMemo(
    () => axisTicks(window, localDate, timezone),
    [window, localDate, timezone],
  );
  const [width, setWidth] = useState(320);
  const [selected, setSelected] = useState<{ id: string; anchor: PanelAnchor } | null>(null);
  const closeSelection = useCallback(() => setSelected(null), []);
  const scroll = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const entry = entries.find((item) => item.id === selected?.id);
  const selection = selectNextAction(items, now);
  const next = selection?.item;
  const chartWidth = Math.max(width, 82 + layout.laneCount * 156);
  const laneWidth = (chartWidth - 82) / layout.laneCount;
  const currentY = axisPosition(now.getTime(), window);
  const showNow = currentY >= 0 && currentY < layout.height;
  const scrollToNow = useCallback(
    (animated: boolean) => {
      const view = scroll.current;
      if (!view) return;
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const y =
        currentY >= layout.height
          ? maxOffset
          : Math.min(maxOffset, Math.max(0, currentY + AXIS_TOP_INSET - 120));
      view.scrollTo({ y, animated });
    },
    [contentHeight, currentY, layout.height, viewportHeight],
  );
  useEffect(() => {
    if (!focusScroll?.isPending() || isLoading || !viewportHeight || !contentHeight) return;
    const frame = requestAnimationFrame(() => {
      if (!focusScroll.isPending()) return;
      focusScroll.consume();
      scrollToNow(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusScroll, isLoading, viewportHeight, contentHeight, scrollToNow]);

  const cancelFocusScroll = () => {
    focusScroll?.consume();
  };
  const open = (id: string) =>
    setSelected({ id, anchor: { x: 24, y: 40, width: 300, height: 44 } });
  return (
    <View style={styles.root}>
      {props.totalActions !== undefined ? (
        <Text
          accessibilityLabel={`この計画の完了数 ${props.completedActions ?? 0}件、全${props.totalActions}件`}
          style={styles.helper}
        >
          完了 {props.completedActions ?? 0}/{props.totalActions}
          {!next && props.totalActions > 0
            ? ' ・ 未実行のActionはありません'
            : props.totalActions === 0
              ? ' ・ Actionはありません'
              : ''}
        </Text>
      ) : null}
      {next ? (
        <Card testID="today-action-focus" style={{ padding: 12, gap: 4 }}>
          <Text style={styles.helper}>
            {selection?.label} · {next.statusLabel}
          </Text>
          <Text style={styles.heading}>{next.title}</Text>
          <Text style={styles.helper}>
            {formatPlanningTime(next.startAt, localDate, timezone)}–
            {formatPlanningTime(next.endAt, localDate, timezone)}
          </Text>
          <ActionButton
            accessibilityLabel={`次のActionを確認: ${next.title}`}
            label="詳細を開く"
            onPress={() => open(`action:${next.id}`)}
            variant="ghost"
          />
        </Card>
      ) : null}
      {calendarEvents.some((event) => event.allDay) ? (
        <View testID="today-all-day">
          <Text accessibilityRole="header">終日予定</Text>
          {calendarEvents
            .filter((event) => event.allDay)
            .map((event, index) => (
              <CalendarTimelineCard
                key={index}
                event={event}
                localDate={localDate}
                timezone={timezone}
              />
            ))}
        </View>
      ) : null}
      <View style={styles.axisHeading}>
        <Text accessibilityRole="header" style={styles.heading}>
          一日の時間軸
        </Text>
        {showNow ? (
          <ActionButton
            label="現在時刻へ"
            variant="ghost"
            onPress={() => {
              cancelFocusScroll();
              scrollToNow(true);
            }}
          />
        ) : null}
      </View>
      {chartWidth > width + 1 ? (
        <Text style={styles.helper}>重なる予定は横にスクロールできます。</Text>
      ) : null}
      <View
        testID="today-axis-container"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scroll}
          nestedScrollEnabled
          style={styles.viewport}
          contentContainerStyle={{ minHeight: 320 }}
          testID="today-axis-scroll"
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setContentHeight(height)}
          onScrollBeginDrag={cancelFocusScroll}
          onScroll={Platform.OS === 'web' ? cancelFocusScroll : undefined}
          scrollEventThrottle={16}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator testID="today-axis-horizontal">
            <View
              testID="today-time-axis"
              style={{
                width: chartWidth,
                height: layout.height + tapHeight + 8,
                marginTop: AXIS_TOP_INSET,
              }}
            >
              {ticks.map((tick) => (
                <View
                  key={tick.instant}
                  testID="today-hour-tick"
                  style={[styles.tick, { top: tick.top }]}
                >
                  <Text style={styles.tickLabel}>{tick.label}</Text>
                  <View style={styles.tickLine} />
                </View>
              ))}
              {freeSlots.map((slot, index) => {
                const start = Math.max(Date.parse(slot.startAt), Date.parse(window.startAt)),
                  end = Math.min(Date.parse(slot.endAt), Date.parse(window.endAt));
                if (start >= end) return null;
                const top = axisPosition(start, window);
                return (
                  <View
                    key={index}
                    testID="today-available-slot"
                    accessibilityLabel={`配置可能な空き時間 ${formatPlanningTime(new Date(start).toISOString(), localDate, timezone)}から${formatPlanningTime(new Date(end).toISOString(), localDate, timezone)}`}
                    style={[
                      styles.free,
                      {
                        left: 82,
                        top,
                        height: axisPosition(end, window) - top,
                        width: chartWidth - 86,
                      },
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.freeLabel}>
                      配置可能 {Math.floor((end - start) / 60_000)}分
                    </Text>
                  </View>
                );
              })}
              {layout.blocks.map((block, index) => {
                const source = entries.find((item) => item.id === block.id)!;
                const action = source.kind === 'action';
                const time = `${formatPlanningTime(source.startAt, localDate, timezone)}–${formatPlanningTime(source.endAt, localDate, timezone)}`;
                return (
                  <Pressable
                    key={block.id}
                    testID={`today-axis-${block.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${source.title}、${time}、${action ? 'Action・' + source.item.statusLabel : 'Calendar'}の詳細を開く`}
                    onPress={() => open(block.id)}
                    style={[
                      styles.block,
                      {
                        top: block.top,
                        left: 82 + block.lane * laneWidth,
                        width: laneWidth - 4,
                        height: Math.max(tapHeight, block.height),
                      },
                    ]}
                  >
                    <View
                      pointerEvents="none"
                      testID={`today-axis-duration-${block.id}`}
                      style={[
                        styles.duration,
                        {
                          height: block.height,
                          backgroundColor: action ? colors.accentSoft : colors.calendarSoft,
                          borderLeftColor: action ? colors.accent : colors.calendar,
                          borderBottomWidth: block.height >= 2 ? 1 : 0,
                          borderBottomColor: colors.surface,
                        },
                      ]}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.blockTitle,
                        { color: action ? colors.accent : colors.calendar },
                      ]}
                    >
                      {index + 1}. {source.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.blockTime}>
                      {time} · {action ? `Action・${source.item.statusLabel}` : 'Calendar'}
                    </Text>
                  </Pressable>
                );
              })}
              {showNow ? (
                <View
                  pointerEvents="none"
                  testID="today-current-time"
                  accessibilityLabel={`現在時刻 ${formatPlanningTime(now.toISOString(), localDate, timezone)}`}
                  style={[styles.now, { top: currentY }]}
                >
                  <Text style={styles.nowLabel}>
                    {formatPlanningTime(now.toISOString(), localDate, timezone)}
                  </Text>
                  <View style={styles.nowLine} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
      <Text style={styles.legend}>Calendar＝グレー　Action＝ブルー　配置可能＝グリーン</Text>
      <Text style={styles.helper}>
        {formatPlanningTime(window.startAt, localDate, timezone)}〜
        {formatPlanningTime(window.endAt, localDate, timezone)}（{timezone}）
      </Text>
      {availabilityMessage ? (
        <Text testID="today-capacity-status" style={styles.helper}>
          {availabilityMessage}
        </Text>
      ) : null}
      {props.supplement}
      <Text style={styles.helper}>
        カードをタップすると短い予定の全文・時刻・操作を確認できます。色の帯の高さが実際の長さです。
      </Text>
      <View testID="today-details-list">
        <Text accessibilityRole="header" style={styles.heading}>
          予定の詳細・操作
        </Text>
        <TimelineDetails
          {...props}
          nextActionId={next?.id ?? null}
          calendarEvents={calendarEvents.filter((event) => !event.allDay)}
        />
      </View>
      {entry && selected ? (
        <SelectionPanel title="予定の詳細" anchor={selected.anchor} onCancel={closeSelection}>
          {entry.kind === 'action' ? (
            <TimelineDetails
              {...props}
              items={[entry.item]}
              calendarEvents={[]}
              nextActionId={next?.id ?? null}
            />
          ) : (
            <CalendarTimelineCard event={entry} localDate={localDate} timezone={timezone} />
          )}
          <ActionButton label="閉じる" onPress={closeSelection} variant="ghost" />
        </SelectionPanel>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: spacing.md, marginTop: spacing.md },
  legend: { color: colors.textMuted, fontSize: 13 },
  helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  axisHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  viewport: {
    maxHeight: 560,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tick: {
    height: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickLabel: {
    position: 'absolute',
    left: 0,
    top: -8,
    width: 78,
    fontSize: 11,
    color: colors.textMuted,
    paddingLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  tickLine: {
    position: 'absolute',
    left: 82,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  block: { position: 'absolute', paddingHorizontal: 6, paddingTop: 4 },
  duration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  blockTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  blockTime: { fontSize: 11, lineHeight: 16, color: colors.textMuted },
  free: {
    position: 'absolute',
    backgroundColor: colors.availableSoft,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.availableBorder,
    overflow: 'hidden',
  },
  freeLabel: { fontSize: 11, color: colors.available, padding: 4 },
  now: {
    height: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
  },
  nowLabel: {
    position: 'absolute',
    left: 0,
    top: -8,
    width: 78,
    fontSize: 11,
    color: colors.nowIndicator,
    backgroundColor: colors.surface,
    fontWeight: '700',
    paddingLeft: 4,
  },
  nowLine: {
    position: 'absolute',
    left: 82,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: colors.nowIndicator,
  },
});
