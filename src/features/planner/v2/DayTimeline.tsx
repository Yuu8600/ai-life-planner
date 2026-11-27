import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  axisPosition,
  axisTicks,
  formatPlanningTime,
  layoutTimeAxis,
  type AxisWindow,
} from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { radius, spacing, typography, useThemeColors } from '@/shared/theme';
import { moveByPixels, sessionLabel, type TimelineEntry } from './timelineEntries';

export const createTimelineKinds = (colors: ReturnType<typeof useThemeColors>) =>
  ({
    task: { label: '作業枠', ink: colors.action, fill: colors.actionSoft },
    fixed: { label: '固定予定', ink: colors.warning, fill: colors.warningSoft },
    device: { label: 'iPhone予定', ink: colors.calendar, fill: colors.calendarSoft },
    lifestyle: { label: '生活予定', ink: colors.success, fill: colors.successSoft },
    leisure: { label: '自由時間', ink: colors.available, fill: colors.availableSoft },
    travel: { label: '移動・余白', ink: colors.warning, fill: colors.surfaceSubtle },
  }) as const;

const AXIS_PADDING = 16;
const EDGE = 110;

type Drag = {
  entry: Extract<TimelineEntry, { kind: 'task' }>;
  finger: number;
  initialFinger: number;
  initialScroll: number;
  scrollY: number;
  frame: number | null;
  interval: AxisWindow;
};

export function DayTimeline({
  window,
  workWindow,
  date,
  timezone,
  now,
  entries,
  scroll,
  scrollY,
  onOpen,
  onMove,
  onDragging,
  onBrowse,
  showFullDay,
  onToggleFullDay,
}: {
  window: AxisWindow;
  workWindow: AxisWindow;
  date: string;
  timezone: string;
  now: number;
  entries: TimelineEntry[];
  scroll: RefObject<ScrollView | null>;
  scrollY: RefObject<number>;
  onOpen: (entry: TimelineEntry) => void;
  onMove: (id: string, interval: AxisWindow) => void;
  onDragging: (active: boolean) => void;
  onBrowse?: () => void;
  showFullDay: boolean;
  onToggleFullDay: () => void;
}) {
  const colors = useThemeColors();
  const timelineKinds = createTimelineKinds(colors);
  const styles = createStyles(colors);
  const { fontScale, height: screenHeight } = useWindowDimensions();
  const scale = Math.max(1, fontScale);
  const labelWidth = Math.ceil(55 * scale);
  const { blocks, laneCount, height } = useMemo(() => {
    const layout = layoutTimeAxis(window, entries, 44 / scale);
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return {
      ...layout,
      blocks: layout.blocks.map((block) => ({ ...byId.get(block.id)!, ...block })),
    };
  }, [window, entries, scale]);
  const ticks = useMemo(() => axisTicks(window, date, timezone), [window, date, timezone]);
  const nowY = axisPosition(now, window) * scale;
  const showNow = nowY >= 0 && nowY < height * scale;
  const [width, setWidth] = useState(320);
  const chartWidth = Math.max(width, labelWidth + laneCount * Math.max(105, 88 * scale));
  const laneWidth = (chartWidth - labelWidth) / laneCount;
  const origin = useRef({ section: 0, chart: 0 });
  const drag = useRef<Drag | null>(null);
  const fingerStart = useRef<number | null>(null);
  const [moving, setMoving] = useState<{ id: string; interval: AxisWindow }>();
  useEffect(
    () => () => {
      const frame = drag.current?.frame;
      if (frame != null) cancelAnimationFrame(frame);
      drag.current = null;
      onDragging(false);
    },
    [onDragging],
  );

  const time = (at: string) => formatPlanningTime(at, date, timezone);
  const range = (item: AxisWindow) => `${time(item.startAt)}〜${time(item.endAt)}`;

  function setTarget(active: Drag) {
    const displacement =
      active.finger - active.initialFinger + active.scrollY - active.initialScroll;
    const target = moveByPixels(active.entry, workWindow, displacement, scale);
    if (active.interval.startAt === target.startAt) return;
    active.interval = target;
    setMoving({ id: active.entry.id, interval: target });
  }

  function moveFinger(event: GestureResponderEvent) {
    const active = drag.current;
    if (!active || event.nativeEvent.touches?.length > 1) return;
    active.finger = event.nativeEvent.pageY;
    setTarget(active);
    if (active.frame !== null) return;
    const autoScroll = () => {
      if (drag.current !== active) return;
      active.frame = null;
      const step = active.finger < EDGE ? -9 : active.finger > screenHeight - EDGE ? 9 : 0;
      if (!step) return;
      const top = origin.current.section + origin.current.chart;
      const next = Math.max(0, Math.min(top + height * scale - 200, active.scrollY + step));
      if (next === active.scrollY) return;
      const nextTarget = moveByPixels(
        active.entry,
        workWindow,
        active.finger - active.initialFinger + next - active.initialScroll,
        scale,
      );
      if (
        nextTarget.startAt === active.interval.startAt &&
        ((step < 0 && Date.parse(nextTarget.startAt) === Date.parse(workWindow.startAt)) ||
          (step > 0 && Date.parse(nextTarget.endAt) === Date.parse(workWindow.endAt)))
      )
        return;
      active.scrollY = next;
      scroll.current?.scrollTo({ y: next, animated: false });
      setTarget(active);
      active.frame = requestAnimationFrame(autoScroll);
    };
    active.frame = requestAnimationFrame(autoScroll);
  }

  function finish(commit: boolean) {
    const active = drag.current;
    fingerStart.current = null;
    if (!active) return;
    if (active.frame !== null) cancelAnimationFrame(active.frame);
    drag.current = null;
    setMoving(undefined);
    onDragging(false);
    if (commit && active.interval.startAt !== active.entry.startAt)
      onMove(active.entry.session.id, active.interval);
  }

  function jumpToTime() {
    const upcoming = blocks.find((item) => item.kind === 'task' && Date.parse(item.endAt) > now);
    const position = showNow
      ? nowY
      : (upcoming?.top ?? axisPosition(workWindow.startAt, window)) * scale;
    scroll.current?.scrollTo({
      y: Math.max(0, origin.current.section + origin.current.chart + position - 55),
      animated: true,
    });
  }

  return (
    <View
      style={styles.section}
      onLayout={({ nativeEvent }) => {
        origin.current.section = nativeEvent.layout.y;
      }}
    >
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          タイムライン
        </Text>
        <ActionButton
          label={showNow ? '現在時刻へ' : '活動時間へ'}
          onPress={jumpToTime}
          variant="ghost"
        />
        {onBrowse ? <ActionButton label="作業枠を探す" onPress={onBrowse} variant="ghost" /> : null}
      </View>
      <ActionButton
        label={showFullDay ? '予定の時間帯だけ表示' : '一日全体を表示'}
        variant="ghost"
        expanded={showFullDay}
        onPress={onToggleFullDay}
        style={styles.displayRange}
      />
      {entries.some((item) => item.kind === 'task' && item.session.status === 'scheduled') ? (
        <Text style={styles.caption}>
          タップで詳細。開始前の作業枠は長押しして上下に移動できます。
        </Text>
      ) : null}
      {chartWidth > width + 1 ? (
        <Text style={styles.caption}>重なる予定は横にスクロールできます。</Text>
      ) : null}
      <View
        onLayout={({ nativeEvent }) => {
          setWidth(nativeEvent.layout.width);
          origin.current.chart = nativeEvent.layout.y;
        }}
      >
        <ScrollView
          horizontal
          scrollEnabled={!moving && chartWidth > width + 1}
          showsHorizontalScrollIndicator={chartWidth > width + 1}
        >
          <View
            testID="v2-day-timeline"
            style={[styles.axis, { width: chartWidth, height: height * scale + AXIS_PADDING * 2 }]}
          >
            {ticks.map((tick) => (
              <View
                key={tick.instant}
                style={[styles.tick, { top: tick.top * scale + AXIS_PADDING }]}
              >
                <Text style={[styles.tickLabel, { width: labelWidth }]}>{tick.label}</Text>
                <View style={styles.tickLine} />
              </View>
            ))}
            {blocks.map((item) => {
              const tone = timelineKinds[item.kind];
              const label = item.kind === 'task' ? sessionLabel(item.session, now) : tone.label;
              const draggable =
                item.kind === 'task' &&
                item.session.status === 'scheduled' &&
                Date.parse(item.startAt) > now;
              const visualHeight = item.height * scale;
              const left = labelWidth + item.lane * laneWidth;
              return (
                <Pressable
                  key={item.id}
                  testID={`timeline-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}、${range(item)}、${label}`}
                  accessibilityHint={
                    draggable
                      ? '詳細を開きます。時刻の変更は詳細からも行えます。'
                      : '詳細を開きます。'
                  }
                  style={[
                    styles.blockTarget,
                    {
                      top: item.touchTop * scale + AXIS_PADDING,
                      left,
                      width: laneWidth - 4,
                      height: item.touchHeight * scale,
                    },
                  ]}
                  onPress={() => onOpen(item)}
                  onTouchStart={
                    draggable
                      ? (event) => {
                          fingerStart.current = event.nativeEvent.pageY;
                        }
                      : undefined
                  }
                  onLongPress={
                    draggable
                      ? (event) => {
                          const initial = fingerStart.current ?? event.nativeEvent.pageY;
                          const offset = scrollY.current;
                          drag.current = {
                            entry: item,
                            finger: initial,
                            initialFinger: initial,
                            initialScroll: offset,
                            scrollY: offset,
                            frame: null,
                            interval: item,
                          };
                          onDragging(true);
                          setMoving({ id: item.id, interval: item });
                        }
                      : undefined
                  }
                  onTouchMove={draggable ? moveFinger : undefined}
                  onTouchEnd={draggable ? () => finish(true) : undefined}
                  onTouchCancel={draggable ? () => finish(false) : undefined}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.block,
                      {
                        top: (item.top - item.touchTop) * scale,
                        height: visualHeight,
                        justifyContent: visualHeight < 34 * scale ? 'center' : 'flex-start',
                        backgroundColor: tone.fill,
                        borderLeftColor: tone.ink,
                        opacity: moving?.id === item.id ? 0.45 : 1,
                      },
                    ]}
                  >
                    {visualHeight >= 21 * scale ? (
                      <Text numberOfLines={1} style={[styles.blockTitle, { color: tone.ink }]}>
                        {item.title}
                      </Text>
                    ) : null}
                    {visualHeight >= 34 * scale ? (
                      <Text numberOfLines={1} style={styles.blockTime}>
                        {time(item.startAt)} · {label}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {showNow ? (
              <View
                pointerEvents="none"
                style={[styles.now, { top: nowY + AXIS_PADDING, left: labelWidth }]}
              >
                <Text style={styles.nowLabel}>現在 {time(new Date(now).toISOString())}</Text>
                <View style={styles.nowLine} />
              </View>
            ) : null}
            {moving ? (
              <View
                testID="timeline-drop-time"
                pointerEvents="none"
                style={[
                  styles.dropLine,
                  {
                    left: labelWidth,
                    height:
                      (axisPosition(moving.interval.endAt, window) -
                        axisPosition(moving.interval.startAt, window)) *
                      scale,
                    top: axisPosition(moving.interval.startAt, window) * scale + AXIS_PADDING,
                  },
                ]}
              >
                <Text style={styles.dropLabel}>{range(moving.interval)}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    section: { gap: spacing.xs },
    header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.xs },
    heading: { ...typography.sectionTitle, color: colors.textPrimary, flexGrow: 1 },
    displayRange: { alignSelf: 'flex-start', paddingHorizontal: 0 },
    caption: { ...typography.caption, color: colors.textSecondary },
    axis: { backgroundColor: colors.surface, borderRadius: radius.md },
    tick: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    tickLabel: {
      ...typography.caption,
      paddingHorizontal: 5,
      color: colors.textSecondary,
      marginTop: -8,
    },
    tickLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle },
    blockTarget: { position: 'absolute' },
    block: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderRadius: radius.sm,
      borderLeftWidth: 3,
      paddingHorizontal: 6,
      overflow: 'hidden',
    },
    blockTitle: { ...typography.caption, lineHeight: 16, fontWeight: '700' },
    blockTime: { ...typography.caption, lineHeight: 16, color: colors.textSecondary },
    now: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' },
    nowLabel: {
      ...typography.caption,
      color: colors.nowIndicator,
      backgroundColor: colors.surface,
    },
    nowLine: { height: 1, backgroundColor: colors.nowIndicator, flex: 1 },
    dropLine: {
      position: 'absolute',
      right: 0,
      borderTopWidth: 2,
      backgroundColor: colors.overlaySubtle,
      borderColor: colors.primary,
      alignItems: 'flex-start',
    },
    dropLabel: {
      ...typography.bodyStrong,
      color: colors.onPrimary,
      backgroundColor: colors.primary,
      padding: 4,
      borderRadius: radius.sm,
    },
  });
