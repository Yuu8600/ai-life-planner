import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { TimeInterval } from '../index';
import { colors, radius, spacing } from '@/shared/theme';

export function SessionDrag({
  window,
  session,
  onDrop,
}: {
  window: TimeInterval;
  session: TimeInterval;
  onDrop: (interval: TimeInterval) => void;
}) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(0);
  const from = Date.parse(window.startAt);
  const span = Date.parse(window.endAt) - from;
  const start = Date.parse(session.startAt);
  const length = Date.parse(session.endAt) - start;
  const blockWidth = Math.max(44, (width * length) / span);
  const left = Math.min(Math.max(0, width - blockWidth), (width * (start - from)) / span);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) >= 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => setDrag(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          setDrag(0);
          if (!width) return;
          const offset = Math.round(((gesture.dx / width) * span) / 300_000) * 300_000;
          if (!offset) return;
          const next = Math.min(from + span - length, Math.max(from, start + offset));
          onDrop({
            startAt: new Date(next).toISOString(),
            endAt: new Date(next + length).toISOString(),
          });
        },
        onPanResponderTerminate: () => setDrag(0),
        onPanResponderTerminationRequest: () => false,
      }),
    [width, span, from, start, length, onDrop],
  );
  return (
    <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View
        {...responder.panHandlers}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.block,
          {
            width: blockWidth,
            left: Math.min(Math.max(0, width - blockWidth), Math.max(0, left + drag)),
          },
        ]}
      >
        <Text style={styles.label}>↔</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  track: {
    height: 44,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  block: {
    position: 'absolute',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  label: { color: colors.onPrimary, fontWeight: '700' },
});
