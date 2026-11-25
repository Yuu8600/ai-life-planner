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
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 25,
          height: 25,
          borderRadius: radius.sm,
          borderWidth: 2,
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
            style={{ color: colors.surface, fontWeight: '700' }}
          >
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
