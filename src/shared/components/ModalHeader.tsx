import { Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { ActionButton } from './ActionButton';
export function ModalHeader({
  title,
  description,
  closeLabel = 'パネルを閉じる',
  disabled = false,
  onClose,
}: {
  title: string;
  description?: string;
  closeLabel?: string;
  disabled?: boolean;
  onClose: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1, minWidth: 120, gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={{ ...typography.dialogTitle, color: colors.textPrimary }}
        >
          {title}
        </Text>
        {description ? (
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            {description}
          </Text>
        ) : null}
      </View>
      <ActionButton
        accessibilityLabel={closeLabel}
        disabled={disabled}
        label="閉じる"
        onPress={onClose}
        variant="ghost"
      />
    </View>
  );
}
