import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/shared/theme';

export function CompletionCheckbox({
  checked,
  disabled,
  label,
  onPress,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors, controls, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: controls.minimumTarget,
        minHeight: controls.minimumTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        transform: !disabled && pressed ? [{ scale: 0.92 }] : undefined,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.pill,
          borderWidth: checked ? 0 : 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: checked ? colors.primary : colors.borderControl,
          backgroundColor: checked ? colors.primary : colors.surface,
        }}
      >
        {checked ? (
          <Text
            accessible={false}
            allowFontScaling={false}
            style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '800' }}
          >
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
