import { Pressable, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '@/shared/theme';
import type { PanelAnchor } from './SelectionPanel';
export function SelectionRow({
  label,
  value,
  disabled,
  onOpen,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onOpen: (anchor: PanelAnchor) => void;
}) {
  const { colors: c, spacing, typography } = useTheme();
  const large = useWindowDimensions().fontScale > 1.4;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}、${value}`}
      accessibilityHint="タップして選択"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onOpen({ x: 0, y: 0, width: 0, height: 0 })}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingVertical: spacing.md,
        flexDirection: large ? 'column' : 'row',
        alignItems: large ? 'stretch' : 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: c.borderSubtle,
        backgroundColor: pressed ? c.primarySoft : 'transparent',
      })}
    >
      <Text
        style={{
          ...typography.body,
          flex: large ? undefined : 1,
          color: disabled ? c.disabledText : c.textPrimary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...typography.bodyStrong,
          color: disabled ? c.disabledText : c.primary,
          flexShrink: 1,
          textAlign: large ? 'right' : undefined,
        }}
      >
        {value}{' '}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ color: c.textSecondary }}
        >
          ›
        </Text>
      </Text>
    </Pressable>
  );
}
