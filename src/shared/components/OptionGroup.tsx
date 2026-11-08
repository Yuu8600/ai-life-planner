import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  return (
    <FormField label={label} error={error}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {options.map((option) => {
          const checked = selectedValue === option.value;
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
              style={({ pressed }) => ({
                minHeight: controls.minimumTarget,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: focused === option.value ? 2 : 1,
                borderColor:
                  checked || focused === option.value ? c.primaryBorder : c.borderControl,
                borderRadius: radius.control,
                backgroundColor: disabled
                  ? c.disabledSurface
                  : checked || pressed
                    ? c.primarySoft
                    : c.surface,
              })}
            >
              <Text
                style={{
                  ...typography.label,
                  color: disabled ? c.disabledText : checked ? c.primary : c.textPrimary,
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
