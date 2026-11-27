import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/theme';

export type ActionButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  expanded?: boolean;
  loading?: boolean;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
};
export function ActionButton({
  accessibilityLabel,
  disabled = false,
  expanded,
  loading = false,
  label,
  onPress,
  style,
  variant = 'primary',
}: ActionButtonProps) {
  const { colors: c, controls, radius, spacing, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const solid = variant === 'primary' || variant === 'destructive';
  const foreground = blocked
    ? c.disabledText
    : solid
      ? variant === 'destructive'
        ? c.onError
        : c.onPrimary
      : variant === 'secondary'
        ? c.textPrimary
        : c.primary;

  const primaryShadow =
    !blocked && variant === 'primary'
      ? Platform.select({
          ios: {
            shadowColor: c.primary,
            shadowOpacity: 0.22,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
          },
          android: { elevation: 2 },
          web: { boxShadow: '0 3px 10px rgba(79, 70, 229, 0.22)' } as ViewStyle,
        })
      : undefined;

  return (
    <Pressable
      {...(Platform.OS === 'web'
        ? { 'aria-busy': loading, ...(expanded === undefined ? {} : { 'aria-expanded': expanded }) }
        : {})}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{
        disabled: blocked,
        busy: loading,
        ...(expanded === undefined ? {} : { expanded }),
      }}
      disabled={blocked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: controls.buttonHeight,
          minWidth: controls.minimumTarget,
          maxWidth: '100%',
          flexShrink: 1,
          paddingHorizontal: variant === 'ghost' ? spacing.md : spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.button,
          borderWidth: variant === 'secondary' ? controls.borderWidth : 0,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: blocked
            ? c.borderSubtle
            : variant === 'secondary'
              ? c.borderSubtle
              : 'transparent',
          backgroundColor: blocked
            ? variant === 'ghost'
              ? 'transparent'
              : c.disabledSurface
            : variant === 'primary'
              ? pressed
                ? c.primaryPressed
                : c.primary
              : variant === 'destructive'
                ? pressed
                  ? c.errorPressed
                  : c.error
                : variant === 'secondary'
                  ? pressed
                    ? c.surfaceSubtle
                    : c.surface
                  : pressed
                    ? c.primarySoft
                    : 'transparent',
          transform: !blocked && pressed ? [{ scale: 0.985 }] : undefined,
        },
        primaryShadow,
        style,
        focused && !blocked
          ? Platform.select({
              web: {
                outlineColor: c.focusRing,
                outlineStyle: 'solid',
                outlineWidth: controls.focusWidth,
                outlineOffset: controls.focusOffset,
              },
              default: { borderColor: c.focusRing, borderWidth: controls.focusWidth },
            })
          : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel="処理中" color={foreground} size="small" />
      ) : null}
      <Text
        key={fontScale}
        style={{
          ...typography.button,
          color: foreground,
          flexShrink: 1,
          minWidth: 0,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
