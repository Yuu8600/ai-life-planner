import { Pressable, Text } from 'react-native';
import { colors, spacing } from '@/shared/theme';
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>
        {value}
      </Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: colors.textMuted }}
      >
        ›
      </Text>
    </Pressable>
  );
}
