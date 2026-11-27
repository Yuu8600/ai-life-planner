import { useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { FormField } from './FormField';

export type OptionGroupProps = {
  disabled: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  selectedValue: string;
};

export function OptionGroup({
  disabled,
  error,
  label,
  onChange,
  options,
  selectedValue,
}: OptionGroupProps) {
  const { colors: c, controls, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState<string | null>(null);
  const segmented =
    options.length >= 2 &&
    options.length <= 4 &&
    options.every((option) => option.label.length <= 7);

  const activeShadow = Platform.select({
    ios: {
      shadowColor: c.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)' } as ViewStyle,
  });

  return (
    <FormField label={label} error={error}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={
          segmented
            ? {
                flexDirection: 'row',
                backgroundColor: c.surfaceSubtle,
                borderRadius: radius.control,
                padding: 3,
                gap: 3,
              }
            : { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }
        }
      >
        {options.map((option) => {
          const checked = selectedValue === option.value;
          const isFocused = focused === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onFocus={() => setFocused(option.value)}
              onBlur={() => setFocused(null)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                segmented
                  ? {
                      flex: 1,
                      minHeight: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: spacing.xs,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.sm,
                      borderWidth: isFocused ? 2 : 0,
                      borderColor: isFocused ? c.focusRing : 'transparent',
                      backgroundColor: disabled
                        ? checked
                          ? c.disabledSurface
                          : 'transparent'
                        : checked
                          ? c.surface
                          : pressed
                            ? 'rgba(255,255,255,0.5)'
                            : 'transparent',
                    }
                  : {
                      minHeight: controls.minimumTarget,
                      justifyContent: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderWidth: isFocused ? 2 : 1,
                      borderColor: checked || isFocused ? c.primaryBorder : c.borderSubtle,
                      borderRadius: radius.pill,
                      backgroundColor: disabled
                        ? c.disabledSurface
                        : checked || pressed
                          ? c.primarySoft
                          : c.surface,
                    },
                segmented && checked && !disabled ? activeShadow : null,
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  ...typography.label,
                  fontWeight: checked ? '700' : '500',
                  color: disabled ? c.disabledText : checked ? c.primary : c.textSecondary,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </FormField>
  );
}
