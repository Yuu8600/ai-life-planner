import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, PanResponder, Platform, View, useWindowDimensions } from 'react-native';
import { ActionButton } from './ActionButton';
import { useTheme } from '@/shared/theme';

export function shouldCaptureSwipe(dx: number, dy: number, startX: number, width: number) {
  return (
    startX > 24 && startX < width - 24 && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.8
  );
}
/** Reveals existing actions; a swipe never executes a destructive operation. */
export function SwipeActions({
  children,
  label,
  disabled = false,
  onLater,
  onDelete,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onLater?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [screenReader, setScreenReader] = useState(true);
  const { width } = useWindowDimensions();
  const { spacing } = useTheme();
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(
      (value) => {
        if (active) setScreenReader(value);
      },
      () => {},
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (event, gesture) =>
          Platform.OS !== 'web' &&
          !disabled &&
          !screenReader &&
          shouldCaptureSwipe(gesture.dx, gesture.dy, event.nativeEvent.pageX - gesture.dx, width),
        onPanResponderRelease: (_, gesture) => {
          if (!disabled && Math.abs(gesture.dx) > 50) setOpen(gesture.dx < 0);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [disabled, screenReader, width],
  );
  return (
    <View {...responder.panHandlers} testID={`swipe-actions-${label}`}>
      {children}
      {open && !disabled ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.sm }}
        >
          {onLater ? (
            <ActionButton
              label="あとで"
              accessibilityLabel={`${label}をスワイプ操作であとでにする`}
              variant="secondary"
              onPress={() => {
                setOpen(false);
                onLater();
              }}
            />
          ) : null}
          {onDelete ? (
            <ActionButton
              label="削除"
              accessibilityLabel={`${label}をスワイプ操作で削除する`}
              variant="destructive"
              onPress={() => {
                setOpen(false);
                onDelete();
              }}
            />
          ) : null}
          <ActionButton label="操作を閉じる" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </View>
  );
}
