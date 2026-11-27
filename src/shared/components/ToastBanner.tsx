import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

export type ToastBannerProps = {
  message: string;
  tone?: 'default' | 'error';
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  onDismiss?: () => void;
  durationMs?: number;
};

/** Floating bottom snackbar that communicates feedback with zero layout shift. */
export function ToastBanner({
  message,
  tone = 'default',
  actionLabel,
  actionDisabled = false,
  onAction,
  onDismiss,
  durationMs = 4500,
}: ToastBannerProps) {
  const { colors, controls, radius, spacing, typography } = useTheme();

  useEffect(() => {
    if (!onDismiss || durationMs <= 0) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  const backgroundColor = tone === 'error' ? colors.error : colors.toastSurface;

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        style={[
          styles.pill,
          {
            backgroundColor,
            borderRadius: radius.md,
            paddingLeft: spacing.lg,
            paddingRight: actionLabel ? spacing.sm : spacing.lg,
            paddingVertical: spacing.sm,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <Text
          style={[
            typography.secondary,
            styles.message,
            { color: tone === 'error' ? colors.onError : colors.onToast },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: actionDisabled }}
            disabled={actionDisabled}
            onPress={onAction}
            style={({ pressed }) => [
              styles.actionButton,
              {
                minHeight: controls.minimumTarget,
                borderRadius: radius.sm,
                backgroundColor: pressed ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)',
                opacity: actionDisabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                typography.label,
                styles.actionText,
                { color: tone === 'error' ? colors.onError : colors.onToast },
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    alignItems: 'center',
    zIndex: 50,
  },
  pill: {
    width: '100%',
    maxWidth: 520,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 24px rgba(15, 23, 42, 0.24)' } as object,
    }),
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
  actionButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '700',
  },
});
