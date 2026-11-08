import { cloneElement, forwardRef, isValidElement, useId, useState, type ReactNode } from 'react';
import {
  Platform,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/theme';
export type FormInputProps = TextInputProps & { invalid?: boolean };
export const FormInput = forwardRef<TextInput, FormInputProps>(function FormInput(
  { invalid, style, editable, onFocus, onBlur, accessibilityState, ...props },
  ref,
) {
  const { colors: c, controls, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      ref={ref}
      editable={editable}
      accessibilityState={{ ...accessibilityState, disabled: editable === false }}
      placeholderTextColor={props.placeholderTextColor ?? c.textPlaceholder}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        {
          minHeight: controls.inputHeight,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderWidth: controls.borderWidth,
          borderColor: invalid ? c.error : focused ? c.focusRing : c.borderControl,
          borderRadius: radius.control,
          backgroundColor: editable === false ? c.disabledSurface : c.surface,
          ...typography.body,
          color: editable === false ? c.disabledText : c.textPrimary,
        },
        style,
        focused
          ? Platform.select({
              web: {
                outlineColor: c.focusRing,
                outlineWidth: controls.focusWidth,
                outlineStyle: 'solid',
                outlineOffset: controls.focusOffset,
              },
            })
          : null,
      ]}
    />
  );
});
export function FormField({
  label,
  error,
  helper,
  children,
  style,
}: {
  label: string;
  error?: string;
  helper?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c, spacing, typography } = useTheme();
  const id = useId();
  const input =
    isValidElement<FormInputProps>(children) && children.type === FormInput
      ? cloneElement(children, {
          accessibilityLabel: children.props.accessibilityLabel ?? label,
          accessibilityHint:
            children.props.accessibilityHint ?? [helper, error].filter(Boolean).join('、'),
          'aria-labelledby': children.props.accessibilityLabel
            ? children.props['aria-labelledby']
            : `${id}-label`,
          invalid: Boolean(error),
        })
      : children;
  return (
    <View style={[{ minWidth: 0, gap: spacing.sm }, style]}>
      <Text nativeID={`${id}-label`} style={{ ...typography.label, color: c.textPrimary }}>
        {label}
      </Text>
      {input}
      {helper ? (
        <Text style={{ ...typography.secondary, color: c.textSecondary }}>{helper}</Text>
      ) : null}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ ...typography.secondary, color: c.error }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
