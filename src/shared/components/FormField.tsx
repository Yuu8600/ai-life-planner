import { cloneElement, forwardRef, isValidElement, useId, useState, type ReactNode } from 'react';
import {
  Platform,
  InputAccessoryView,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/theme';
export type FormInputProps = TextInputProps & {
  invalid?: boolean;
  keyboardDismissAccessory?: boolean;
};
export const FormInput = forwardRef<TextInput, FormInputProps>(function FormInput(
  {
    invalid,
    style,
    editable,
    onFocus,
    onBlur,
    accessibilityState,
    keyboardDismissAccessory = true,
    ...props
  },
  ref,
) {
  const { colors: c, controls, radius, spacing, typography } = useTheme();
  const accessoryId = useId();
  const showAccessory =
    Platform.OS === 'ios' &&
    keyboardDismissAccessory &&
    !props.inputAccessoryViewID &&
    (props.multiline ||
      ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'].includes(props.keyboardType ?? ''));
  const [focused, setFocused] = useState(false);
  return (
    <>
      <TextInput
        {...props}
        inputAccessoryViewID={showAccessory ? accessoryId : props.inputAccessoryViewID}
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
            borderWidth: focused || invalid ? 1.5 : controls.borderWidth,
            borderColor: invalid ? c.error : focused ? c.focusRing : c.borderSubtle,
            borderRadius: radius.control,
            backgroundColor:
              editable === false ? c.disabledSurface : focused ? c.surface : '#F8FAFC',
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
      {showAccessory ? (
        <InputAccessoryView nativeID={accessoryId} backgroundColor={c.surface}>
          <View
            style={{
              alignItems: 'flex-end',
              borderTopWidth: 1,
              borderColor: c.borderSubtle,
              paddingHorizontal: spacing.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="完了、キーボードを閉じる"
              onPress={() => Keyboard.dismiss()}
              style={{
                minHeight: controls.minimumTarget,
                minWidth: controls.minimumTarget,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
              }}
            >
              <Text style={{ ...typography.button, color: c.primary }}>完了</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
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
  const hasFormInput = isValidElement<FormInputProps>(children) && children.type === FormInput;
  const input = hasFormInput
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
    <View style={[{ minWidth: 0, gap: spacing.xs + 2 }, style]}>
      <Text
        accessible={Platform.OS === 'web' || !hasFormInput}
        nativeID={`${id}-label`}
        style={{ ...typography.label, color: c.textSecondary }}
      >
        {label}
      </Text>
      {input}
      {helper ? (
        <Text style={{ ...typography.caption, color: c.textSecondary }}>{helper}</Text>
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
