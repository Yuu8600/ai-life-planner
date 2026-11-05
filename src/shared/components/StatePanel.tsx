import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { colors, radius, spacing, typography } from '@/shared/theme';

export type StatePanelProps = {
  actionLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  message: string;
  onPressAction?: () => void;
  testID: string;
  title: string;
};

export function StatePanel({
  actionLabel,
  disabled = false,
  isLoading = false,
  loadingLabel = '読み込み中',
  message,
  onPressAction,
  testID,
  title,
}: StatePanelProps) {
  return (
    <View style={styles.container} testID={testID}>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel={loadingLabel} color={colors.accent} />
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onPressAction ? (
        <ActionButton
          disabled={disabled}
          label={actionLabel}
          onPress={onPressAction}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  title: { ...typography.sectionTitle, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
