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
      : c.primary;
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
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.button,
          borderWidth: controls.borderWidth,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: blocked
            ? c.borderControl
            : variant === 'primary'
              ? c.primary
              : variant === 'destructive'
                ? c.error
                : variant === 'secondary'
                  ? c.borderControl
                  : 'transparent',
          backgroundColor: blocked
            ? c.disabledSurface
            : variant === 'primary'
              ? pressed
                ? c.primaryPressed
                : c.primary
              : variant === 'destructive'
                ? pressed
                  ? c.errorPressed
                  : c.error
                : pressed
                  ? c.primarySoft
                  : variant === 'secondary'
                    ? c.surface
                    : 'transparent',
        },
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
